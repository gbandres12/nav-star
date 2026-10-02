import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, CircleCheck } from "lucide-react";
import { CancelarBilhete } from "@/components/agencia/cancelar-bilhete";
import { PrintButton } from "@/components/print-button";
import { QR } from "@/components/qr";
import { Badge, Logo } from "@/components/ui";
import { bilheteDaAgencia } from "@/lib/agencia/dados";
import { agenciaAtual } from "@/lib/agencia/sessao";
import { dateTime, label, money } from "@/lib/format";

export const metadata = { title: "Bilhete", robots: { index: false } };

export default async function BilheteAgencia({ params, searchParams }: PageProps<"/agencia/painel/bilhetes/[id]">) {
  const ag = await agenciaAtual();
  if (!ag) redirect("/agencia");
  const { id } = await params;
  const sp = await searchParams;
  const b = await bilheteDaAgencia(ag.id, id);
  if (!b) notFound();
  const valido = b.status !== "CANCELADO"; // EMITIDO ou TRANSFERIDO (titular trocado pela empresa)

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/agencia/painel/bilhetes" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
          <ChevronLeft size={16} /> Meus bilhetes
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {b.podeCancelar && <CancelarBilhete id={b.id} />}
          {valido && <PrintButton />}
        </div>
      </div>

      {sp.novo === "1" && valido && (
        <p role="status" className="no-print mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          <CircleCheck size={16} /> Bilhete emitido. Imprima ou salve em PDF e entregue ao passageiro.
        </p>
      )}

      <article className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:max-w-none print:border-slate-400 print:shadow-none">
        <div className="flex items-center justify-between">
          <Logo />
          <Badge status={b.status} />
        </div>
        {!valido && <p className="mt-3 rounded-lg bg-red-50 p-2 text-center text-sm font-bold text-red-700">BILHETE CANCELADO — SEM VALIDADE</p>}
        <p className="mt-4 font-mono text-sm text-slate-500">{b.numero}</p>
        <p className="mt-1 text-2xl font-black text-rio-950">{b.origem} → {b.destino}</p>
        <p className="text-sm text-slate-500">{b.linha}</p>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="col-span-2"><dt className="text-xs uppercase text-slate-400">Passageiro</dt><dd className="font-semibold">{b.passageiro}</dd></div>
          <div><dt className="text-xs uppercase text-slate-400">Documento</dt><dd className="font-mono">{b.documento}</dd></div>
          <div><dt className="text-xs uppercase text-slate-400">Categoria</dt><dd>{label(b.tipo)}</dd></div>
          <div><dt className="text-xs uppercase text-slate-400">Embarque</dt><dd className="font-semibold">{dateTime(b.embarque)}</dd></div>
          <div><dt className="text-xs uppercase text-slate-400">Valor</dt><dd className="font-semibold">{money(b.valorCobrado + b.taxa)}{b.taxa > 0 && <span className="block text-xs font-normal text-slate-500">inclui taxa de embarque {money(b.taxa)}</span>}</dd></div>
        </dl>

        {valido && (
          <div className="mt-6 flex flex-col items-center gap-2 border-t border-dashed border-slate-300 pt-5">
            <QR value={b.codigo} size={160} />
            <p className="font-mono text-sm font-bold tracking-wider">{b.codigo}</p>
            <p className="text-xs text-slate-500">Código de validação · apresente no embarque</p>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-slate-400">Emitido por {ag.nome} em {dateTime(b.criadoEm)}</p>
      </article>
    </>
  );
}
