import Link from "next/link";
import { MonthNav } from "@/components/admin/month-nav";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { dateTime, money } from "@/lib/format";
import { periodoMes } from "@/lib/periodo";
import { listarCancelamentos } from "@/lib/data/cancelamentos";

export const metadata = { title: "Cancelamentos" };

export default async function Cancelamentos({ searchParams }: PageProps<"/admin/cancelamentos">) {
  const op = await garantirAcesso("/admin/cancelamentos");
  const { mes } = await searchParams;
  const per = periodoMes(mes);
  
  const cancelamentos = await listarCancelamentos(per.inicio, per.fim);
  const lista = cancelamentos.filter((c) => op.papel !== "VENDEDOR" || c.usuarioId === op.id);

  return (
    <>
      <PageHeader
        title="Cancelamentos"
        subtitle={op.papel === "VENDEDOR" ? "Cancelamentos feitos por você. Para cancelar, abra o pedido." : "Passagens canceladas no período. Para cancelar, abra o pedido."}
        actions={<MonthNav base="/admin/cancelamentos" {...per} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Cancelamentos" value={lista.length} hint={`${lista.reduce((s, c) => s + c.passagemIds.length, 0)} passagens`} />
        <Stat label="Reembolsado" value={money(lista.reduce((s, c) => s + c.reembolso, 0))} />
        <Stat label="Multas retidas" value={money(lista.reduce((s, c) => s + c.multa, 0))} />
      </div>
      <div className="card overflow-x-auto">
        {lista.length === 0 ? (
          <div className="p-5"><Empty>Nenhum cancelamento em {per.nome}.</Empty></div>
        ) : (
          <table className="table-base">
            <thead><tr><th>Data</th><th>Pedido</th><th>Comprador</th><th>Motivo</th><th>Por</th><th className="text-right">Pago</th><th className="text-right">Multa</th><th className="text-right">Reembolso</th></tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">{dateTime(c.createdAt)}</td>
                  <td><Link href={`/admin/pedidos/${c.pedido?.codigo}`} className="font-mono text-xs font-bold text-rio-700 hover:underline">{c.pedido?.codigo}</Link></td>
                  <td>{c.pedido?.compradorNome}</td>
                  <td className="text-slate-600">{c.motivo}</td>
                  <td className="whitespace-nowrap">{c.usuario?.nome ?? "—"}</td>
                  <td className="text-right tabular-nums">{money(c.valorPago)}</td>
                  <td className="text-right tabular-nums">{money(c.multa)}</td>
                  <td className="text-right font-semibold tabular-nums">{money(c.reembolso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
