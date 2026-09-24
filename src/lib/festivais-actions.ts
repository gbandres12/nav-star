"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Estado } from "./admin-actions";
import * as dados from "./data/festivais";
import { exigirPapel } from "./sessao";
import type { Festival } from "./types";

// Ações da tela de festivais (cadastro, viagens e fotos). Gravam no Supabase; ADMIN e GERENTE.

type Resultado = { ok: true } | { ok: false; erro: string };

async function soGestao() {
  const a = await exigirPapel("ADMIN", "GERENTE");
  return a.erro ? { erro: a.erro } : null;
}

function concluir(r: Resultado, ok: string): Estado {
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin/festivais", "layout");
  revalidatePath("/", "layout");
  return { ok };
}

export async function salvarFestivalAction(_: Estado, form: FormData): Promise<Estado> {
  const bloqueio = await soGestao();
  if (bloqueio) return bloqueio;
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const cor = (["rubro", "rio", "sol", "emerald"].includes(s("cor")) ? s("cor") : "rio") as Festival["cor"];
  const r = await dados.salvarFestival({
    id: s("id") || undefined,
    slug: s("slug"),
    nome: s("nome"),
    chamada: s("chamada"),
    descricao: s("descricao"),
    cidadeId: s("cidadeId"),
    inicio: s("inicio"),
    fim: s("fim"),
    acrescimoPercentual: Number(s("acrescimoPercentual").replace(",", ".")) || 0,
    cor,
    publicado: form.get("publicado") === "on",
  });
  if (r.ok && !s("id")) {
    revalidatePath("/admin/festivais", "layout");
    redirect(`/admin/festivais/${r.id}`);
  }
  return concluir(r, "Festival salvo.");
}

export async function vincularViagemAction(_: Estado, form: FormData): Promise<Estado> {
  const bloqueio = await soGestao();
  if (bloqueio) return bloqueio;
  const vincular = form.get("acao") !== "remover";
  const r = await dados.vincularViagem(String(form.get("festivalId")), String(form.get("viagemId")), vincular);
  return concluir(r, vincular ? "Viagem incluída no festival." : "Viagem retirada do festival.");
}

/** Chamada pelo navegador depois de enviar o arquivo ao Storage */
export async function registrarFotoAction(festivalId: string, caminho: string): Promise<Estado> {
  const bloqueio = await soGestao();
  if (bloqueio) return bloqueio;
  return concluir(await dados.registrarFoto(festivalId, caminho), "Foto adicionada.");
}

export async function removerFotoAction(fotoId: string): Promise<Estado> {
  const bloqueio = await soGestao();
  if (bloqueio) return bloqueio;
  return concluir(await dados.removerFoto(fotoId), "Foto removida.");
}

export async function usarComoCapaAction(fotoId: string): Promise<Estado> {
  const bloqueio = await soGestao();
  if (bloqueio) return bloqueio;
  return concluir(await dados.usarComoCapa(fotoId), "Capa atualizada.");
}
