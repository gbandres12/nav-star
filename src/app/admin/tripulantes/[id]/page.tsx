import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TripulanteForm } from "@/components/admin/tripulante-form";
import { PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { embarcacoes as listarEmbarcacoes, linhas as listarLinhas } from "@/lib/data/catalogo";
import { escalasDoTripulante, tripulante } from "@/lib/data/frota";
import { dateShort, label, time } from "@/lib/format";

export const metadata = { title: "Tripulante" };

export default async function EditarTripulante({ params }: PageProps<"/admin/tripulantes/[id]">) {
  await garantirAcesso("/admin/tripulantes");
  const { id } = await params;
  const t = await tripulante(id);
  if (!t) notFound();
  const [escalas, embarcacoes, linhas] = await Promise.all([escalasDoTripulante(t.id), listarEmbarcacoes(), listarLinhas()]);
  const proximas = escalas.slice(0, 8);
  return (
    <>
      <Link href="/admin/tripulantes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Tripulantes</Link>
      <PageHeader title={t.nome} subtitle={label(t.funcao)} />
      <div className="card p-6"><TripulanteForm t={t} embarcacoes={embarcacoes.map(({ id, nome }) => ({ id, nome }))} /></div>
      <div className="card mt-6 p-5">
        <h2 className="mb-3 font-bold">Próximas escalas</h2>
        {proximas.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {proximas.map((v) => (
              <li key={v.id}>
                <span className="block rounded-xl bg-slate-50 p-3 text-sm">
                  <span className="font-semibold">{dateShort(v.partida)} {time(v.partida)}</span> · {linhas.find((l) => l.id === v.linha_id)?.nome}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Sem viagens escaladas.</p>
        )}
      </div>
    </>
  );
}
