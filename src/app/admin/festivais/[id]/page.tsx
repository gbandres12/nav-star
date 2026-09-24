import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { ActionForm, Campo } from "@/components/admin/action-form";
import { FestivalForm } from "@/components/admin/festival-form";
import { FotosFestival } from "@/components/admin/fotos-festival";
import { Badge, Empty, OccupancyBar, PageHeader } from "@/components/ui";
import { vincularViagemAction } from "@/lib/festivais-actions";
import { garantirAcesso } from "@/lib/sessao";
import { cidades as listarCidades, embarcacoes as listarEmbarcacoes, linhas as listarLinhas } from "@/lib/data/catalogo";
import { festivais, festivalPorId, linhaPassaNaCidade, vendasPorViagem } from "@/lib/data/festivais";
import { passageirosPorSegmento } from "@/lib/data/utils";
import { viagem, viagensAdmin } from "@/lib/data/viagens";
import { dateShort, money, time, weekday } from "@/lib/format";

export const metadata = { title: "Festival" };

export default async function FestivalAdmin({ params }: PageProps<"/admin/festivais/[id]">) {
  await garantirAcesso("/admin/festivais");
  const { id } = await params;
  const f = await festivalPorId(id);
  if (!f) notFound();

  const [cidades, linhas, embarcacoes, todos, futuras] = await Promise.all([
    listarCidades(),
    listarLinhas(),
    listarEmbarcacoes(),
    festivais(),
    viagensAdmin({ aba: "proximas" }),
  ]);
  const c = cidades.find((x) => x.id === f.cidadeId);
  const nomeLinha = (linhaId: string) => linhas.find((l) => l.id === linhaId)?.nome ?? "";
  const emOutroFestival = new Set(todos.flatMap((x) => x.viagemIds));

  // Viagens do festival (inclusive as que já partiram) e as futuras que ainda podem entrar
  const vinculadas = (await Promise.all(f.viagemIds.map((x) => viagem(x))))
    .filter((v) => v !== null)
    .sort((a, b) => a.partida.localeCompare(b.partida));
  const candidatas = [];
  for (const v of futuras) {
    if (v.status !== "CANCELADA" && !emOutroFestival.has(v.id) && (await linhaPassaNaCidade(v.linhaId, f.cidadeId))) candidatas.push(v);
  }
  const vendas = await vendasPorViagem([...vinculadas, ...candidatas].map((v) => v.id));
  const lotacao = await Promise.all(
    vinculadas.map(async (v) => {
      const capacidade = embarcacoes.find((e) => e.id === v.embarcacaoId)?.capacidadePassageiros ?? 0;
      const maior = Math.max(0, ...(await passageirosPorSegmento(v)));
      return capacidade ? Math.round((maior / capacidade) * 100) : 0;
    }),
  );

  return (
    <>
      <Link href="/admin/festivais" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Festivais</Link>
      <PageHeader
        title={f.nome}
        subtitle={`${c ? `${c.nome}/${c.uf}` : ""} · ${f.viagemIds.length} viagem(ns)`}
        actions={f.publicado && <Link href={`/festivais/${f.slug}`} target="_blank" className="btn-ghost"><ExternalLink size={15} /> Ver no site</Link>}
      />

      <div className="card p-6"><FestivalForm f={f} cidades={cidades.map(({ id, nome }) => ({ id, nome }))} /></div>

      <div className="card mt-6 p-6">
        <h2 className="mb-1 font-bold">Fotos no site</h2>
        <p className="mb-4 text-sm text-slate-500">
          A capa aparece no card da página inicial e no topo da página do festival; as demais formam a galeria.
          {!f.publicado && " O festival ainda é rascunho: as fotos só aparecem no site depois de publicado."}
        </p>
        <FotosFestival festivalId={f.id} fotos={f.fotos ?? []} />
      </div>

      <div className="card mt-6 overflow-x-auto">
        <div className="p-5">
          <h2 className="font-bold">Viagens do festival</h2>
          <p className="text-sm text-slate-500">
            No site aparecem os trechos que chegam a {c?.nome} (ida) e os que saem de lá (volta).
            {f.acrescimoPercentual > 0 && ` O preço destas viagens tem +${f.acrescimoPercentual}% sobre a tabela da linha.`}
          </p>
        </div>
        {vinculadas.length === 0 ? (
          <div className="px-5 pb-5"><Empty>Nenhuma viagem incluída ainda.</Empty></div>
        ) : (
          <table className="table-base">
            <thead><tr><th>Saída</th><th>Linha</th><th>Embarcação</th><th>Status</th><th>Lotação</th><th className="text-right">Vendido</th><th /></tr></thead>
            <tbody>
              {vinculadas.map((v, i) => (
                <tr key={v.id}>
                  <td className="whitespace-nowrap">{weekday(v.partida)} {dateShort(v.partida)} · {time(v.partida)}</td>
                  <td className="whitespace-nowrap">{nomeLinha(v.linhaId)}</td>
                  <td>{embarcacoes.find((e) => e.id === v.embarcacaoId)?.nome}</td>
                  <td><Badge status={v.status} /></td>
                  <td><OccupancyBar pct={lotacao[i]} /></td>
                  <td className="text-right tabular-nums">{money(vendas.get(v.id)?.valor ?? 0)}</td>
                  <td>
                    <ActionForm action={vincularViagemAction} submit="Retirar" botaoClassName="btn-ghost py-1 text-xs" className="[&>div]:mt-0">
                      <input type="hidden" name="festivalId" value={f.id} />
                      <input type="hidden" name="viagemId" value={v.id} />
                      <input type="hidden" name="acao" value="remover" />
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="mb-1 font-bold">Incluir viagem da programação</h2>
        <p className="mb-4 text-sm text-slate-500">
          Viagens futuras que passam por {c?.nome}.{f.acrescimoPercentual > 0 && " Com reajuste de preço, só entram viagens ainda sem passagens vendidas."}
          {" "}Saídas extras, fora da programação, ainda não podem ser criadas pelo painel.
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
                    {dateShort(v.partida)} {time(v.partida)} · {nomeLinha(v.linhaId)} · {vendas.get(v.id)?.quantidade ?? 0} vendidas
                  </option>
                ))}
              </select>
            </Campo>
          </ActionForm>
        )}
      </div>
    </>
  );
}
