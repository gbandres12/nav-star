import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EncomendaTimeline } from "@/components/encomenda-timeline";
import { PrintButton } from "@/components/print-button";
import { QR } from "@/components/qr";
import { AvancarButton } from "@/components/admin/avancar-button";
import { Badge } from "@/components/ui";
import { dateShort, dateTime, label, money, time } from "@/lib/format";
import { cidade, encomendaPorCodigo, linha, viagem } from "@/lib/data";
import type { StatusEncomenda } from "@/lib/types";

export const metadata = { title: "Encomenda" };

const FLUXO_ENCOMENDA: StatusEncomenda[] = ["RECEBIDA", "EMBARCADA", "EM_TRANSITO", "DISPONIVEL_RETIRADA", "ENTREGUE"];

export default async function EncomendaDetalhe({ params }: PageProps<"/admin/encomendas/[codigo]">) {
  const { codigo } = await params;
  const e = await encomendaPorCodigo(codigo);
  if (!e) notFound();
  
  const v = e.viagemId ? await viagem(e.viagemId) : undefined;
  const i = FLUXO_ENCOMENDA.indexOf(e.status);
  const proximo = i >= 0 && i < FLUXO_ENCOMENDA.length - 1 ? FLUXO_ENCOMENDA[i + 1] : undefined;
  
  const o = await cidade(e.origemCidadeId);
  const d = await cidade(e.destinoCidadeId);
  if (!o || !d) notFound();

  const l = v ? await linha(v.linhaId) : null;

  return (
    <>
      <Link href="/admin/encomendas" className="no-print mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Encomendas
      </Link>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold">{e.codigo}</h1>
          <Badge status={e.status} />
        </div>
        <div className="flex gap-2">
          <PrintButton label="Imprimir etiqueta" />
          {proximo && <AvancarButton codigo={e.codigo} proximo={label(proximo)} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="no-print space-y-6">
          <div className="card grid gap-6 p-6 sm:grid-cols-2">
            <div>
              <p className="label">Remetente</p>
              <p className="font-semibold">{e.remetenteNome}</p>
              <p className="text-sm text-slate-500">{e.remetenteDoc} · {e.remetenteTel}</p>
            </div>
            <div>
              <p className="label">Destinatário</p>
              <p className="font-semibold">{e.destinatarioNome}</p>
              <p className="text-sm text-slate-500">{e.destinatarioTel}</p>
            </div>
            <div>
              <p className="label">Conteúdo</p>
              <p className="font-semibold">{e.descricao}</p>
              <p className="text-sm text-slate-500">
                {e.volumes} volume(s) · {e.pesoKg.toLocaleString("pt-BR")} kg{e.valorDeclarado ? ` · declarado ${money(e.valorDeclarado)}` : ""}
              </p>
            </div>
            <div>
              <p className="label">Frete</p>
              <p className="font-semibold">{money(e.frete)} · {label(e.pagador)}</p>
              <p className={`text-sm ${e.fretePago ? "text-emerald-600" : "text-amber-700"}`}>{e.fretePago ? "Pago" : "A receber na retirada"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="label">Viagem</p>
              {v ? (
                <Link href={`/admin/viagens/${v.id}`} className="font-semibold text-rio-700 hover:underline">
                  {l?.nome || "Linha"} · {dateShort(v.partida)} {time(v.partida)}
                </Link>
              ) : (
                <p className="text-sm text-slate-500">Ainda não vinculada</p>
              )}
            </div>
          </div>
          <div className="card p-6">
            <h2 className="mb-4 font-bold">Rastreamento</h2>
            <EncomendaTimeline e={e} />
          </div>
        </div>

        {/* Etiqueta — é o que sai na impressão */}
        <div className="h-fit rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 print:border-solid">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">São Tomé Expresso</p>
              <p className="font-mono text-2xl font-extrabold">{e.codigo}</p>
            </div>
            <QR value={e.codigo} size={84} />
          </div>
          <div className="my-4 rounded-xl bg-slate-900 p-4 text-center text-white">
            <p className="text-xs tracking-widest uppercase opacity-70">Destino</p>
            <p className="text-3xl font-extrabold">{d.nome.toUpperCase()}/{d.uf}</p>
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Origem</dt><dd className="font-semibold">{o.nome}/{o.uf}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Para</dt><dd className="font-semibold">{e.destinatarioNome}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Tel.</dt><dd>{e.destinatarioTel}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Volumes / peso</dt><dd>{e.volumes} · {e.pesoKg.toLocaleString("pt-BR")} kg</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Frete</dt><dd className="font-semibold">{e.fretePago ? "PAGO" : `A COBRAR ${money(e.frete)}`}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Recebida</dt><dd>{dateTime(e.createdAt)}</dd></div>
          </dl>
        </div>
      </div>
    </>
  );
}
