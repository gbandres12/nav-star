import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { ActionForm, Campo } from "@/components/admin/action-form";
import { FestivalForm } from "@/components/admin/festival-form";
import { Badge, Empty, OccupancyBar, PageHeader } from "@/components/ui";
import { vincularViagemAction, viagemExtraFestivalAction } from "@/lib/admin-actions";
import { garantirAcesso } from "@/lib/sessao";
import { cidade, db, embarcacao, festivalDaViagem, linha, ocupacaoViagem, passagensDaViagem, porto, viagem } from "@/lib/store";
import { dateShort, localDayKey, money, time, weekday } from "@/lib/format";

export const metadata = { title: "Festival" };

export default async function FestivalAdmin({ params }: PageProps<"/admin/festivais/[id]">) {
  await garantirAcesso("/admin/festivais");
  const { id } = await params;
  const f = db().festivais.find((x) => x.id === id);
  if (!f) notFound();
  const c = cidade(f.cidadeId);
  const agora = new Date();
  const passaNaCidade = (linhaId: string) => linha(linhaId).paradas.some((p) => porto(p.portoId).cidadeId === f.cidadeId);
  const vinculadas = f.viagemIds.map((x) => viagem(x)).filter((v) => !!v).sort((a, b) => a!.partida.localeCompare(b!.partida));
  const candidatas = db().viagens.filter(
    (v) => new Date(v.partida) > agora && v.status !== "CANCELADA" && passaNaCidade(v.linhaId) && !festivalDaViagem(v.id),
  );
  const linhas = db().linhas.filter((l) => l.ativa && passaNaCidade(l.id));
  const vespera = localDayKey(new Date(new Date(f.inicio + "T12:00:00Z").getTime() - 86_400_000));

  return (
    <>
      <Link href="/admin/festivais" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Festivais</Link>
      <PageHeader
        title={f.nome}
        subtitle={`${c.nome}/${c.uf} · ${f.viagemIds.length} viagem(ns)`}
        actions={f.publicado && <Link href={`/festivais/${f.slug}`} target="_blank" className="btn-ghost"><ExternalLink size={15} /> Ver no site</Link>}
      />

      <div className="card p-6"><FestivalForm f={f} cidades={db().cidades.map(({ id, nome }) => ({ id, nome }))} /></div>

      <div className="card mt-6 overflow-x-auto">
        <div className="p-5">
          <h2 className="font-bold">Viagens do festival</h2>
          <p className="text-sm text-slate-500">
            No site aparecem os trechos que chegam a {c.nome} (ida) e os que saem de lá (volta).
            {f.acrescimoPercentual > 0 && ` O preço destas viagens tem +${f.acrescimoPercentual}% sobre a tabela da linha.`}
          </p>
        </div>
        {vinculadas.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Nenhuma viagem incluída ainda.</Empty></div>
        ) : (
          <table className="table-base">
            <thead><tr><th>Viagem</th><th>Saída</th><th>Linha</th><th>Embarcação</th><th>Status</th><th>Lotação</th><th className="text-right">Vendido</th><th /></tr></thead>
            <tbody>
              {vinculadas.map((v) => {
                const pas = passagensDaViagem(v!.id).filter((p) => p.status !== "RESERVADA");
                return (
                  <tr key={v!.id}>
                    <td><Link href={`/admin/viagens/${v!.id}`} className="font-mono text-xs font-bold text-rio-700 hover:underline">{v!.id}</Link></td>
                    <td className="whitespace-nowrap">{weekday(v!.partida)} {dateShort(v!.partida)} · {time(v!.partida)}</td>
                    <td className="whitespace-nowrap">{linha(v!.linhaId).nome}</td>
                    <td>{embarcacao(v!.embarcacaoId).nome}</td>
                    <td><Badge status={v!.status} /></td>
                    <td><OccupancyBar pct={ocupacaoViagem(v!).pct} /></td>
                    <td className="text-right tabular-nums">{money(pas.reduce((s, p) => s + p.valor, 0))}</td>
                    <td>
                      <ActionForm action={vincularViagemAction} submit="Retirar" botaoClassName="btn-ghost py-1 text-xs" className="[&>div]:mt-0">
                        <input type="hidden" name="festivalId" value={f.id} />
                        <input type="hidden" name="viagemId" value={v!.id} />
                        <input type="hidden" name="acao" value="remover" />
                      </ActionForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-1 font-bold">Criar viagem extra</h2>
          <p className="mb-4 text-sm text-slate-500">Saída fora da programação, já incluída no festival.</p>
          {linhas.length === 0 ? (
            <Empty>Nenhuma linha ativa passa por {c.nome}.</Empty>
          ) : (
            <ActionForm action={viagemExtraFestivalAction} submit="Criar e incluir">
              <input type="hidden" name="festivalId" value={f.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Linha" className="sm:col-span-2">
                  <select name="linhaId" className="input">{linhas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
                </Campo>
                <Campo label="Embarcação" className="sm:col-span-2">
                  <select name="embarcacaoId" className="input">
                    {db().embarcacoes.filter((e) => e.status === "ATIVA").map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </Campo>
                <Campo label="Data da saída"><input name="dia" type="date" required defaultValue={vespera} className="input" /></Campo>
                <Campo label="Hora (Manaus)"><input name="hora" type="time" required defaultValue="03:00" className="input" /></Campo>
              </div>
            </ActionForm>
          )}
        </div>
        <div className="card p-5">
          <h2 className="mb-1 font-bold">Incluir viagem da programação</h2>
          <p className="mb-4 text-sm text-slate-500">
            Viagens futuras que passam por {c.nome}.{f.acrescimoPercentual > 0 && " Com reajuste de preço, só entram viagens ainda sem passagens vendidas."}
          </p>
          {candidatas.length === 0 ? (
            <Empty>Nenhuma viagem disponível.</Empty>
          ) : (
            <ActionForm action={vincularViagemAction} submit="Incluir no festival">
              <input type="hidden" name="festivalId" value={f.id} />
              <Campo label="Viagem">
                <select name="viagemId" className="input">
                  {candidatas.slice(0, 80).map((v) => (
                    <option key={v.id} value={v.id}>
                      {dateShort(v.partida)} {time(v.partida)} · {linha(v.linhaId).nome} · {passagensDaViagem(v.id).length} vendidas
                    </option>
                  ))}
                </select>
              </Campo>
            </ActionForm>
          )}
        </div>
      </div>
    </>
  );
}
