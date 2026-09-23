import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { SeatMap } from "@/components/seat-map";
import { Badge, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { capacidade, comodosDaEmbarcacao, db, mapaComodos, posicaoFrota } from "@/lib/store";
import { dateShort, label, time } from "@/lib/format";

export const metadata = { title: "Embarcações" };

export default async function Embarcacoes() {
  await garantirAcesso("/admin/embarcacoes");
  const pos = new Map(posicaoFrota().map((p) => [p.embarcacaoId, p]));
  return (
    <>
      <PageHeader
        title="Embarcações"
        subtitle="Frota da empresa, mapa de poltronas e acomodações de cada embarcação"
        actions={<Link href="/admin/embarcacoes/nova" className="btn-primary"><Plus size={16} /> Nova embarcação</Link>}
      />
      <div className="space-y-6">
        {db().embarcacoes.map((e) => {
          const p = pos.get(e.id);
          const cms = comodosDaEmbarcacao(e.id);
          return (
            <section key={e.id} className="card p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold">{e.nome}</h2>
                    <Badge status={e.status} />
                  </div>
                  <p className="text-sm text-slate-500">
                    {e.tipo === "LANCHA" ? "Lancha" : e.tipo} · Inscrição Capitania {e.inscricaoCapitania}
                    {e.ano && ` · ${e.ano}`}
                    {e.comprimentoM && ` · ${e.comprimentoM} m`}
                  </p>
                  {p?.proximaSaida && <p className="mt-1 text-sm text-slate-600">Próxima saída: {dateShort(p.proximaSaida.partida)} {time(p.proximaSaida.partida)} ({p.proximaSaida.id})</p>}
                  {e.observacao && <p className="mt-1 text-sm text-amber-700">{e.observacao}</p>}
                </div>
                <div className="flex items-start gap-6">
                  <dl className="flex gap-6 text-sm">
                    <div><dt className="text-slate-500">Passageiros</dt><dd className="text-lg font-bold">{capacidade(e)}</dd></div>
                    <div><dt className="text-slate-500">Carga</dt><dd className="text-lg font-bold">{(e.capacidadeCargaKg / 1000).toLocaleString("pt-BR")} t</dd></div>
                    <div><dt className="text-slate-500">Cômodos</dt><dd className="text-lg font-bold">{cms.length}</dd></div>
                  </dl>
                  <Link href={`/admin/embarcacoes/${e.id}`} className="btn-ghost"><Pencil size={15} /> Editar</Link>
                </div>
              </div>
              {e.assentoLivre ? (
                <p className="rounded-xl bg-rio-50 p-4 text-sm text-rio-900"><strong>Assento livre</strong> · lotação de {e.capacidadePassageiros} passageiros, sem poltrona numerada.</p>
              ) : e.assentos.length ? (
                <SeatMap assentos={e.assentos} colunas={e.colunasMapa} ocupados={[]} comodos={mapaComodos(e.id)} />
              ) : (
                <p className="text-sm text-slate-500">Mapa de poltronas ainda não montado.</p>
              )}
              {p && <p className="mt-2 text-xs text-slate-400">Situação agora: {label(p.situacao)}</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
