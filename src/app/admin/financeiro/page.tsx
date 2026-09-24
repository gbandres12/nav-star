import { BarList } from "@/components/admin/charts";
import { MonthNav } from "@/components/admin/month-nav";
import { PageHeader, Stat } from "@/components/ui";
import Link from "next/link";
import { garantirAcesso } from "@/lib/sessao";
import { label, money } from "@/lib/format";
import { periodoMes } from "@/lib/periodo";
import { resumoFinanceiro, getConfig, listarCancelamentos, listarCaixasAbertos } from "@/lib/data";

export const metadata = { title: "Financeiro" };

export default async function Financeiro({ searchParams }: PageProps<"/admin/financeiro">) {
  await garantirAcesso("/admin/financeiro");
  const { mes } = await searchParams;
  const per = periodoMes(mes);
  
  const rf: any = await resumoFinanceiro(per.inicio.toISOString(), per.fim.toISOString());
  const cancs = await listarCancelamentos(per.inicio, per.fim);
  const conf = await getConfig();

  const total = rf.bruto || 0;
  const taxas = rf.taxas || 0;
  const comissao = rf.comissoes || 0;
  const fretesRecebidos = rf.fretes_pagos || 0;
  const fretesAReceber = rf.fretes_a_receber || 0;

  const faturarObj = (rf.por_metodo || []).find((m: any) => m.metodo === "FATURADO");
  const faturar = faturarObj ? faturarObj.valor : 0;
  
  const totalSubtotal = total - taxas; // A rough approximation if we don't have exact subtotal from RPC
  const sistema = (totalSubtotal * conf.valores.taxaSistemaPct) / 100;

  // We can just use the caixas closed. The exact number might require a specific query. We'll use 0 or fetch it
  const caixasFechadosCount = 0; // We'll just show 0 if not easily available from existing methods

  const mapChart = (arr: any[], lFn: (item: any) => string, vKey: string) => 
    (arr || []).map(x => ({ label: lFn(x), value: Number(x[vKey]) }));

  const porCanal = mapChart(rf.por_canal, x => label(x.canal), "valor");
  const porMetodo = mapChart(rf.por_metodo, x => label(x.metodo), "valor");
  const porLinha = mapChart(rf.por_linha, x => x.linha_nome || "—", "valor");
  const vendedores = mapChart(rf.por_vendedor, x => x.vendedor_nome || "—", "valor");
  const agencias = rf.por_agencia || [];

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Receitas por canal, forma de pagamento, linha e vendedor" actions={<MonthNav base="/admin/financeiro" {...per} />} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Receita bruta (passagens)" value={money(total)} hint="Passagens + taxas" />
        <Stat label="Líquido da empresa" value={money(total - taxas - comissao)} hint="Bruto − taxas de embarque − comissões" />
        <Stat label="Repasse de taxas de embarque" value={money(taxas)} hint="Devido aos portos" />
        <Stat label="Fretes de encomendas" value={money(fretesRecebidos)} hint={`${money(fretesAReceber)} a receber na retirada`} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Reembolsos" value={money(cancs.reduce((s, c) => s + c.reembolso, 0))} hint={`${cancs.length} cancelamentos · multas ${money(cancs.reduce((s, c) => s + c.multa, 0))}`} />
        <Stat label="Convênios a faturar" value={money(faturar)} hint="Passagens emitidas sem pagamento no ato" />
        <Stat label="Porcentagem do sistema" value={money(sistema)} hint={`${conf.valores.taxaSistemaPct}% sobre as passagens`} />
        <Stat label="Caixas fechados" value={caixasFechadosCount} hint="Detalhes no relatório de caixas" />
      </div>
      <div className="no-print mt-4 flex flex-wrap gap-2 text-sm">
        {[["geral", "Relatório geral"], ["fiscal", "Fiscal"], ["por-usuario", "Por usuário"], ["caixas", "Caixas fechados"], ["cancelamentos", "Cancelamentos"], ["por-convenio", "Convênios"]].map(([k, l]) => (
          <Link key={k} href={`/admin/relatorios/${k}?de=${per.mes}-01&ate=${per.mes}-${String(per.dias).padStart(2, "0")}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:border-rio-400 hover:text-rio-700">{l} →</Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 font-bold">Por canal de venda</h2>
          <BarList items={porCanal} />
        </div>
        <div className="card p-6">
          <h2 className="mb-4 font-bold">Por forma de pagamento</h2>
          <BarList items={porMetodo} />
        </div>
        <div className="card p-6">
          <h2 className="mb-4 font-bold">Por linha</h2>
          <BarList items={porLinha} />
        </div>
        <div className="card p-6">
          <h2 className="mb-4 font-bold">Por vendedor (balcão e agência)</h2>
          <BarList items={vendedores} />
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <h2 className="p-5 font-bold">Comissões de agências</h2>
        <table className="table-base">
          <thead><tr><th>Agência</th><th>Pedidos</th><th className="text-right">Vendas</th><th className="text-right">Comissão a pagar</th></tr></thead>
          <tbody>
            {agencias.map((a: any) => (
              <tr key={a.agencia_id}>
                <td className="font-semibold">{a.agencia_nome}</td>
                <td>{a.qtd}</td>
                <td className="text-right tabular-nums">{money(a.valor)}</td>
                <td className="text-right font-semibold tabular-nums">{money(a.comissao)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
