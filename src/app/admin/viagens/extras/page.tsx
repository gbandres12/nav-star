import Link from "next/link";
import { Plus } from "lucide-react";
import { MonthNav } from "@/components/admin/month-nav";
import { Badge, PageHeader, Stat } from "@/components/ui";
import { listarViagensExtras } from "@/lib/data/viagens-extras";
import { dateTime, money } from "@/lib/format";
import { periodoMes } from "@/lib/periodo";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Viagens extras" };

export default async function ViagensExtras({ searchParams }: PageProps<"/admin/viagens/extras">) {
  await garantirAcesso("/admin/viagens/extras");
  const { mes } = await searchParams;
  const per = periodoMes(mes);
  const lista = await listarViagensExtras(per.inicio, per.fim);

  const validas = lista.filter((v) => v.status !== "CANCELADA");
  const fretes = validas.filter((v) => v.tipo === "FRETAMENTO");
  const extras = validas.filter((v) => v.tipo === "EXTRA");
  const soma = (xs: typeof lista, f: (v: (typeof lista)[number]) => number) => xs.reduce((t, v) => t + f(v), 0);
  const receita = soma(validas, (v) => v.valorTotal);
  const recebido = soma(validas, (v) => v.valorRecebido);

  return (
    <>
      <PageHeader
        title="Viagens extras"
        subtitle="Fretamentos e viagens fora das linhas, com ida e volta. Acompanhamento de receita e passageiros; não vende passagem no sistema."
        actions={<><Link href="/admin/viagens" className="btn-ghost">Viagens regulares</Link><MonthNav base="/admin/viagens/extras" {...per} /><Link href="/admin/viagens/extras/nova" className="btn-primary"><Plus size={16} /> Nova viagem extra</Link></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Viagens no mês" value={validas.length} hint={`${fretes.length} fretamento(s) · ${extras.length} extra(s)`} />
        <Stat label="Receita" value={money(receita)} hint={`fretes ${money(soma(fretes, (v) => v.valorTotal))} · extras ${money(soma(extras, (v) => v.valorTotal))}`} />
        <Stat label="A receber" value={money(Math.max(0, receita - recebido))} hint={`${money(recebido)} já recebido`} />
        <Stat label="Passageiros informados" value={soma(validas, (v) => v.passageiros ?? 0)} />
      </div>

      <div className="card mt-6 overflow-x-auto">
        {lista.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Nenhuma viagem extra em {per.nome}.</p>
        ) : (
          <table className="table-base">
            <thead><tr><th>Trajeto</th><th>Tipo</th><th>Ida</th><th>Volta</th><th>Embarcação</th><th className="text-right">Valor</th><th className="text-right">A receber</th><th>Situação</th></tr></thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.id} className={v.status === "CANCELADA" ? "opacity-50" : undefined}>
                  <td className="font-semibold whitespace-nowrap">
                    <Link href={`/admin/viagens/extras/${v.id}`} className="text-rio-700 hover:underline">{v.origem} → {v.destino}</Link>
                    {v.clienteNome && <span className="block text-xs font-normal text-slate-500">{v.clienteNome}</span>}
                  </td>
                  <td>{v.tipo === "FRETAMENTO" ? "Fretamento" : "Extra"}</td>
                  <td className="whitespace-nowrap tabular-nums">{dateTime(v.saidaIda)}</td>
                  <td className="whitespace-nowrap tabular-nums">{v.saidaVolta ? dateTime(v.saidaVolta) : "—"}</td>
                  <td className="whitespace-nowrap">{v.embarcacaoNome}</td>
                  <td className="text-right tabular-nums">{money(v.valorTotal)}</td>
                  <td className="text-right tabular-nums">{money(Math.max(0, v.valorTotal - v.valorRecebido))}</td>
                  <td><Badge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
