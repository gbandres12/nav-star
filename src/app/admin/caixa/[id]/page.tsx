import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AutoPrint } from "@/components/auto-print";
import { PrintButton } from "@/components/print-button";
import { dateTime, label, money } from "@/lib/format";
import { garantirAcesso } from "@/lib/sessao";
import { resumoCaixa } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/data/utils";

export const metadata = { title: "Fechamento de caixa" };

/** Comprovante de fechamento para a impressora térmica (80 mm) */
export default async function ComprovanteCaixa({ params, searchParams }: PageProps<"/admin/caixa/[id]">) {
  const op = await garantirAcesso("/admin/caixa");
  const { id } = await params;
  const sp = await searchParams;
  
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("caixa_sessoes")
    .select("*, perfis(nome)")
    .eq("id", id)
    .single();

  if (!c || (c.usuario_id !== op.id && op.papel !== "ADMIN" && op.papel !== "GERENTE")) notFound();
  
  const r = await resumoCaixa(id);
  const linhas: [string, string][] = [
    ["Troco inicial", money(c.valor_abertura)],
    ...r.porMetodo.map((m: any): [string, string] => [`${label(m.metodo)} (${m.qtd})`, money(m.valor)]),
    ["Suprimentos", `+${money(r.suprimentos)}`],
    ["Sangrias", `−${money(r.sangrias)}`],
  ];

  const config = await getConfig();

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/admin/caixa" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Caixa</Link>
        <PrintButton label="Imprimir comprovante" />
      </div>
      <article className="bilhete mx-auto w-[80mm] bg-white p-[4mm] font-[Arial,Helvetica,sans-serif] text-[11px] text-black shadow-lg print:shadow-none">
        <p className="text-center text-[13px] font-bold">{config.empresa.nome.toUpperCase()}</p>
        <p className="text-center text-[9px]">CNPJ {config.empresa.cnpj}</p>
        <p className="mt-2 border-y border-dashed border-black py-1 text-center font-bold">FECHAMENTO DE CAIXA</p>
        <dl className="mt-2 space-y-0.5">
          <Linha k="Operador" v={c.perfis?.nome ?? "—"} />
          <Linha k="Abertura" v={dateTime(c.aberto_em)} />
          <Linha k="Fechamento" v={c.fechado_em ? dateTime(c.fechado_em) : "EM ABERTO"} />
        </dl>
        <div className="my-2 border-t border-dashed border-black" />
        <dl className="space-y-0.5">{linhas.map(([k, v]) => <Linha key={k} k={k} v={v} />)}</dl>
        <div className="my-2 border-t border-dashed border-black" />
        <dl className="space-y-0.5 font-bold">
          <Linha k="Total vendido" v={money(r.vendido)} />
          <Linha k="Dinheiro esperado" v={money(r.esperado)} />
          <Linha k="Dinheiro contado" v={c.valor_fechamento === null ? "—" : money(c.valor_fechamento)} />
          <Linha k="Diferença" v={r.diferenca === undefined ? "—" : money(r.diferenca)} />
        </dl>
        {c.observacao && <p className="mt-2 text-[10px]">Obs.: {c.observacao}</p>}
        <div className="mt-8 border-t border-black pt-1 text-center text-[9px]">Assinatura do operador</div>
        <div className="mt-6 border-t border-black pt-1 text-center text-[9px]">Conferido por</div>
      </article>
      {sp.imprimir === "1" && <AutoPrint />}
    </>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </div>
  );
}
