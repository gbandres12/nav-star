import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { Badge, Empty, OccupancyBar, PageHeader } from "@/components/ui";
import { operadorAtual } from "@/lib/sessao";
import { embarcacoes as listarEmbarcacoes, linhas as listarLinhas } from "@/lib/data/catalogo";
import { listaViagens } from "@/lib/data/viagens-gestao";
import { dateShort, money, time, weekday } from "@/lib/format";

export const metadata = { title: "Viagens" };

export default async function Viagens({ searchParams }: PageProps<"/admin/viagens">) {
  const sp = await searchParams;
  const aba = sp.aba === "anteriores" ? "anteriores" : "proximas";
  const linhaId = typeof sp.linha === "string" ? sp.linha : "";
  const [lista, linhas, embarcacoes, op] = await Promise.all([
    listaViagens({ aba, linhaId: linhaId || undefined }),
    listarLinhas(),
    listarEmbarcacoes(),
    operadorAtual(),
  ]);
  const admin = op.papel === "ADMIN";
  const vende = op.papel !== "CONFERENTE";
  const nomeLinha = (id: string) => linhas.find((l) => l.id === id)?.nome ?? "";
  const ultimaParada = (id: string) => Math.max(1, (linhas.find((l) => l.id === id)?.paradas.length ?? 2) - 1);
  const lotacao = (id: string) => embarcacoes.find((e) => e.id === id)?.capacidadePassageiros ?? 0;

  const tab = (a: string, l: string) => (
    <Link href={`/admin/viagens?aba=${a}${linhaId ? `&linha=${linhaId}` : ""}`} className={`rounded-lg px-4 py-2 text-sm font-semibold ${aba === a ? "bg-white text-rio-800 shadow" : "text-slate-500 hover:text-slate-800"}`}>
      {l}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Viagens"
        subtitle="A programação semanal de cada linha é gerada automaticamente todo dia, 60 dias à frente. Viagens avulsas entram por aqui."
        actions={admin && <Link href="/admin/viagens/nova" className="btn-primary"><Plus size={16} /> Viagem avulsa</Link>}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
          {tab("proximas", "Próximas")}
          {tab("anteriores", "Realizadas")}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {[{ id: "", nome: "Todas as linhas" }, ...linhas].map((l) => (
            <Link key={l.id} href={`/admin/viagens?aba=${aba}${l.id ? `&linha=${l.id}` : ""}`} className={`rounded-full border px-3 py-1.5 ${linhaId === l.id ? "border-rio-600 bg-rio-50 font-semibold text-rio-800" : "border-slate-200 bg-white text-slate-600"}`}>
              {l.nome}
            </Link>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <Empty>{aba === "proximas" ? "Nenhuma viagem programada." : "Nenhuma viagem realizada ainda."}</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Saída</th><th>Linha</th><th>Embarcação</th><th>Status</th><th>Lotação máx.</th><th className="text-right">Receita</th><th /></tr>
            </thead>
            <tbody>
              {lista.map(({ viagem: v, pico, receita }) => {
                const cap = lotacao(v.embarcacaoId);
                const podeVender = vende && v.vendasAbertas && (v.status === "PROGRAMADA" || v.status === "EMBARQUE") && new Date(v.partida) > new Date();
                return (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`/admin/viagens/${v.id}`} className="font-semibold text-rio-700 hover:underline">
                        <span>{weekday(v.partida)}</span> {dateShort(v.partida)} · {time(v.partida)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{nomeLinha(v.linhaId)}</td>
                    <td className="whitespace-nowrap">{embarcacoes.find((e) => e.id === v.embarcacaoId)?.nome}</td>
                    <td className="whitespace-nowrap">
                      <Badge status={v.status} />
                      {!v.vendasAbertas && v.status !== "CONCLUIDA" && v.status !== "CANCELADA" && <span className="ml-1 text-xs text-slate-500">vendas fechadas</span>}
                      {v.avulsa && <span className="ml-1 text-xs text-sol-600">avulsa</span>}
                    </td>
                    <td title={`${pico} de ${cap} no trecho mais cheio`}><OccupancyBar pct={cap ? Math.round((pico / cap) * 100) : 0} /></td>
                    <td className="text-right font-semibold tabular-nums">{money(receita)}</td>
                    <td>
                      {podeVender && (
                        <Link href={`/admin/vender/${v.id}?o=0&d=${ultimaParada(v.linhaId)}`} className="btn bg-emerald-500 py-1.5 text-xs text-white hover:bg-emerald-600">
                          <ShoppingCart size={14} /> Vender
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
