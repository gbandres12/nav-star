import { BarList } from "@/components/admin/charts";
import { MonthNav } from "@/components/admin/month-nav";
import { PageHeader, Stat } from "@/components/ui";
import { db, linha, passagensDoPedido, pedidosPagos, viagem } from "@/lib/store";
import { label, money } from "@/lib/format";
import { periodoMes } from "@/lib/periodo";

export const metadata = { title: "Financeiro" };

function agrupar<T>(itens: T[], chave: (t: T) => string, valor: (t: T) => number) {
  const m = new Map<string, number>();
  for (const i of itens) m.set(chave(i), (m.get(chave(i)) ?? 0) + valor(i));
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export default async function Financeiro({ searchParams }: PageProps<"/admin/financeiro">) {
  const { mes } = await searchParams;
  const per = periodoMes(mes);
  const pedidos = pedidosPagos(per.inicio, per.fim);
  const total = pedidos.reduce((s, p) => s + p.total, 0);
  const taxas = pedidos.reduce((s, p) => s + p.taxas, 0);
  const comissao = pedidos.reduce((s, p) => s + p.comissaoAgencia, 0);
  const encomendas = db().encomendas.filter((e) => new Date(e.createdAt) >= per.inicio && new Date(e.createdAt) < per.fim);
  const fretesRecebidos = encomendas.filter((e) => e.fretePago).reduce((s, e) => s + e.frete, 0);
  const fretesAReceber = encomendas.filter((e) => !e.fretePago).reduce((s, e) => s + e.frete, 0);

  const porCanal = agrupar(pedidos, (p) => label(p.canal), (p) => p.total);
  const porMetodo = agrupar(pedidos, (p) => label(p.pagamentos[0].metodo), (p) => p.total);
  const porLinha = agrupar(
    pedidos,
    (p) => {
      const pas = passagensDoPedido(p.id)[0];
      return pas ? linha(viagem(pas.viagemId)!.linhaId).nome : "—";
    },
    (p) => p.total,
  );
  const vendedores = agrupar(
    pedidos.filter((p) => p.vendedorId),
    (p) => db().usuarios.find((u) => u.id === p.vendedorId)?.nome ?? "—",
    (p) => p.total,
  );
  const agencias = db().agencias.map((a) => {
    const ps = pedidos.filter((p) => p.agenciaId === a.id);
    return { a, vendas: ps.reduce((s, p) => s + p.total, 0), comissao: ps.reduce((s, p) => s + p.comissaoAgencia, 0), qtd: ps.length };
  });

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Receitas por canal, forma de pagamento, linha e vendedor" actions={<MonthNav base="/admin/financeiro" {...per} />} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Receita bruta (passagens)" value={money(total)} hint={`${pedidos.length} pedidos`} />
        <Stat label="Líquido da empresa" value={money(total - taxas - comissao)} hint="Bruto − taxas de embarque − comissões" />
        <Stat label="Repasse de taxas de embarque" value={money(taxas)} hint="Devido aos portos" />
        <Stat label="Fretes de encomendas" value={money(fretesRecebidos)} hint={`${money(fretesAReceber)} a receber na retirada`} />
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
          <thead><tr><th>Agência</th><th>Comissão</th><th>Pedidos</th><th className="text-right">Vendas</th><th className="text-right">Comissão a pagar</th></tr></thead>
          <tbody>
            {agencias.map(({ a, vendas, comissao: c, qtd }) => (
              <tr key={a.id}>
                <td className="font-semibold">{a.nome}</td>
                <td>{a.comissaoPercentual}%</td>
                <td>{qtd}</td>
                <td className="text-right tabular-nums">{money(vendas)}</td>
                <td className="text-right font-semibold tabular-nums">{money(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
