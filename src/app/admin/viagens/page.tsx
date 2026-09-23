import Link from "next/link";
import { Plus } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { Badge, OccupancyBar, PageHeader } from "@/components/ui";
import { gerarViagensAction } from "@/lib/admin-actions";
import { operadorAtual } from "@/lib/sessao";
import { db, embarcacao, linha, ocupacaoViagem, viagensAdmin } from "@/lib/store";
import { dateShort, money, time, weekday } from "@/lib/format";

export const metadata = { title: "Viagens" };

export default async function Viagens({ searchParams }: PageProps<"/admin/viagens">) {
  const sp = await searchParams;
  const aba = sp.aba === "anteriores" ? "anteriores" : "proximas";
  const linhaId = typeof sp.linha === "string" ? sp.linha : "";
  const lista = viagensAdmin({ aba, linhaId: linhaId || undefined });
  const op = await operadorAtual();
  const gestor = op.papel === "ADMIN" || op.papel === "GERENTE";

  const tab = (a: string, l: string) => (
    <Link href={`/admin/viagens?aba=${a}${linhaId ? `&linha=${linhaId}` : ""}`} className={`rounded-lg px-4 py-2 text-sm font-semibold ${aba === a ? "bg-white text-rio-800 shadow" : "text-slate-500 hover:text-slate-800"}`}>
      {l}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Viagens"
        subtitle="Geradas a partir da programação semanal de cada linha, mais as viagens avulsas"
        actions={
          gestor && (
            <>
              <ActionForm action={gerarViagensAction} submit="Gerar viagens (60 dias)" botaoClassName="btn-ghost" className="[&>div]:mt-0">
                <input type="hidden" name="dias" value="60" />
              </ActionForm>
              <Link href="/admin/viagens/nova" className="btn-primary"><Plus size={16} /> Viagem avulsa</Link>
            </>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
          {tab("proximas", "Próximas 30 dias")}
          {tab("anteriores", "Realizadas")}
        </div>
        <div className="flex gap-2 text-sm">
          {[{ id: "", nome: "Todas as linhas" }, ...db().linhas].map((l) => (
            <Link key={l.id} href={`/admin/viagens?aba=${aba}${l.id ? `&linha=${l.id}` : ""}`} className={`rounded-full border px-3 py-1.5 ${linhaId === l.id ? "border-rio-600 bg-rio-50 font-semibold text-rio-800" : "border-slate-200 bg-white text-slate-600"}`}>
              {l.nome}
            </Link>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>Código</th><th>Saída</th><th>Linha</th><th>Embarcação</th><th>Status</th><th>Lotação máx.</th><th className="text-right">Receita</th></tr>
          </thead>
          <tbody>
            {lista.map((v) => {
              const oc = ocupacaoViagem(v);
              const receita = db().passagens.filter((p) => p.viagemId === v.id && p.status !== "CANCELADA" && p.status !== "RESERVADA").reduce((s, p) => s + p.valor, 0);
              return (
                <tr key={v.id}>
                  <td><Link href={`/admin/viagens/${v.id}`} className="font-mono text-xs font-bold text-rio-700 hover:underline">{v.id}</Link></td>
                  <td className="whitespace-nowrap"><span>{weekday(v.partida)}</span> {dateShort(v.partida)} · <b>{time(v.partida)}</b></td>
                  <td className="whitespace-nowrap">{linha(v.linhaId).nome}</td>
                  <td className="whitespace-nowrap">{embarcacao(v.embarcacaoId).nome}</td>
                  <td className="whitespace-nowrap">
                    <Badge status={v.status} />
                    {!v.vendasAbertas && v.status !== "CONCLUIDA" && v.status !== "CANCELADA" && <span className="ml-1 text-xs text-slate-500">vendas fechadas</span>}
                    {v.avulsa && <span className="ml-1 text-xs text-sol-600">avulsa</span>}
                  </td>
                  <td><OccupancyBar pct={oc.pct} /></td>
                  <td className="text-right font-semibold tabular-nums">{money(receita)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
