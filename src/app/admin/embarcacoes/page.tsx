import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { SeatMap } from "@/components/seat-map";
import { Badge, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { embarcacoes as listarEmbarcacoes } from "@/lib/data/catalogo";
import { comodos as listarComodos, proximasSaidasPorEmbarcacao } from "@/lib/data/frota";
import { mapaComodos } from "@/lib/data/utils";
import { dateShort, time } from "@/lib/format";

export const metadata = { title: "Embarcações" };

export default async function Embarcacoes() {
  await garantirAcesso("/admin/embarcacoes");
  const [lista, todosComodos, proximas] = await Promise.all([listarEmbarcacoes(), listarComodos(), proximasSaidasPorEmbarcacao()]);
  const legendas = new Map(await Promise.all(lista.map(async (e) => [e.id, await mapaComodos(e.id)] as const)));
  return (
    <>
      <PageHeader
        title="Embarcações"
        subtitle="Frota da empresa, mapa de poltronas e acomodações de cada embarcação"
        actions={<Link href="/admin/embarcacoes/nova" className="btn-primary"><Plus size={16} /> Nova embarcação</Link>}
      />
      <div className="space-y-6">
        {lista.length === 0 && <p className="card p-6 text-sm text-slate-500">Nenhuma embarcação cadastrada.</p>}
        {lista.map((e) => {
          const proxima = proximas.get(e.id);
          const cms = todosComodos.filter((c) => c.embarcacaoId === e.id);
          return (
            <section key={e.id} className="card p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold">{e.nome}</h2>
                    <Badge status={e.status} />
                  </div>
                  <p className="text-sm text-slate-500">
                    {e.tipo === "LANCHA" ? "Lancha" : e.tipo === "BARCO" ? "Barco" : e.tipo === "FERRY" ? "Ferry" : e.tipo} · Inscrição Capitania {e.inscricaoCapitania || "—"}
                    {e.ano && ` · ${e.ano}`}
                    {e.comprimentoM && ` · ${e.comprimentoM} m`}
                  </p>
                  {proxima && <p className="mt-1 text-sm text-slate-600">Próxima saída: {dateShort(proxima)} {time(proxima)}</p>}
                  {e.observacao && <p className="mt-1 text-sm text-amber-700">{e.observacao}</p>}
                </div>
                <div className="flex items-start gap-6">
                  <dl className="flex gap-6 text-sm">
                    <div><dt className="text-slate-500">Lotação</dt><dd className="text-lg font-bold">{e.capacidadePassageiros}</dd></div>
                    <div><dt className="text-slate-500">Poltronas</dt><dd className="text-lg font-bold">{e.assentos.length}</dd></div>
                    <div><dt className="text-slate-500">Carga</dt><dd className="text-lg font-bold">{(e.capacidadeCargaKg / 1000).toLocaleString("pt-BR")} t</dd></div>
                    <div><dt className="text-slate-500">Cômodos</dt><dd className="text-lg font-bold">{cms.length}</dd></div>
                  </dl>
                  <Link href={`/admin/embarcacoes/${e.id}`} className="btn-ghost"><Pencil size={15} /> Editar</Link>
                </div>
              </div>
              {e.assentoLivre ? (
                <p className="rounded-xl bg-rio-50 p-4 text-sm text-rio-900"><strong>Assento livre</strong> · lotação de {e.capacidadePassageiros} passageiros, sem poltrona numerada.</p>
              ) : e.assentos.length ? (
                <SeatMap assentos={e.assentos} colunas={e.colunasMapa} ocupados={[]} comodos={legendas.get(e.id)} />
              ) : (
                <p className="text-sm text-slate-500">Mapa de poltronas ainda não montado.</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
