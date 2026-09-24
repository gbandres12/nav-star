"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { Mensagem } from "./action-form";
import type { Estado } from "@/lib/admin-actions";
import { registrarFotoAction, removerFotoAction, usarComoCapaAction } from "@/lib/festivais-actions";
import { createClient } from "@/lib/supabase/client";
import type { FotoFestival } from "@/lib/types";

const LADO_MAXIMO = 1920;

/** Reduz para no máximo 1920 px no lado maior e recomprime (WebP; JPEG onde o navegador não gera WebP, como o Safari) */
async function prepararImagem(arquivo: File): Promise<{ blob: Blob; extensao: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(arquivo).catch(() => {
    throw new Error(`"${arquivo.name}" não é uma imagem que o navegador consiga abrir. Use JPG, PNG ou WebP.`);
  });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const gerar = (tipo: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, 0.82));
  const webp = await gerar("image/webp");
  if (webp?.type === "image/webp") return { blob: webp, extensao: "webp" };
  const jpeg = await gerar("image/jpeg");
  if (!jpeg) throw new Error(`Não foi possível processar "${arquivo.name}".`);
  return { blob: jpeg, extensao: "jpg" };
}

export function FotosFestival({ festivalId, fotos }: { festivalId: string; fotos: FotoFestival[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  async function enviar(arquivos: FileList) {
    const supabase = createClient();
    const lista = Array.from(arquivos);
    let enviadas = 0;
    setEstado(undefined);
    try {
      for (const [i, arquivo] of lista.entries()) {
        setEnviando(`Enviando ${i + 1} de ${lista.length}…`);
        const { blob, extensao } = await prepararImagem(arquivo);
        const caminho = `${festivalId}/${crypto.randomUUID()}.${extensao}`;
        const { error } = await supabase.storage.from("festivais").upload(caminho, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (error) throw new Error(`Falha ao enviar "${arquivo.name}": ${error.message}`);
        const r = await registrarFotoAction(festivalId, caminho);
        if (r?.erro) {
          await supabase.storage.from("festivais").remove([caminho]);
          throw new Error(r.erro);
        }
        enviadas++;
      }
      setEstado({ ok: enviadas === 1 ? "Foto adicionada." : `${enviadas} fotos adicionadas.` });
    } catch (e) {
      const prefixo = enviadas ? `${enviadas} foto(s) enviada(s). ` : "";
      setEstado({ erro: prefixo + (e instanceof Error ? e.message : "Erro ao enviar as fotos.") });
    } finally {
      setEnviando(null);
      if (input.current) input.current.value = "";
    }
  }

  const agir = (acao: () => Promise<Estado>) => startTransition(async () => setEstado(await acao()));
  const ocupado = !!enviando || pendente;

  return (
    <div>
      {fotos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Nenhuma foto ainda. A primeira foto vira a capa do festival no site.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((foto, i) => (
            <li key={foto.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="relative aspect-[4/3]">
                <Image src={foto.url} alt={`Foto ${i + 1} do festival`} fill sizes="(min-width: 1024px) 240px, 50vw" className="object-cover" />
                {i === 0 && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-xs font-semibold text-rio-800">
                    <Star size={12} className="fill-sol-500 text-sol-500" /> Capa
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                {i > 0 ? (
                  <button type="button" disabled={ocupado} onClick={() => agir(() => usarComoCapaAction(foto.id))} className="btn-ghost px-2 py-1 text-xs">
                    <Star size={13} /> Usar como capa
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  disabled={ocupado}
                  aria-label={`Remover foto ${i + 1}`}
                  onClick={() => window.confirm("Remover esta foto do site?") && agir(() => removerFotoAction(foto.id))}
                  className="btn-ghost px-2 py-1 text-xs text-red-700"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => e.target.files?.length && enviar(e.target.files)}
        />
        <button type="button" disabled={ocupado} onClick={() => input.current?.click()} className="btn-primary">
          {ocupado ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          {enviando ?? "Adicionar fotos"}
        </button>
        <Mensagem state={estado} />
      </div>
      <p className="mt-2 text-xs text-slate-500">JPG, PNG ou WebP. As fotos são reduzidas automaticamente antes do envio.</p>
    </div>
  );
}
