import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TripulanteForm } from "@/components/admin/tripulante-form";
import { PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { db, linha, tripulante } from "@/lib/store";
import { dateShort, label, time } from "@/lib/format";

export const metadata = { title: "Tripulante" };

export default async function EditarTripulante({ params }: PageProps<"/admin/tripulantes/[id]">) {
  await garantirAcesso("/admin/tripulantes");
  const { id } = await params;
  const t = tripulante(id);
  if (!t) notFound();
  const agora = new Date();
  const proximas = db().viagens.filter((v) => v.tripulacao.includes(t.id) && new Date(v.partida) > agora && v.status !== "CANCELADA").slice(0, 8);
  return (
    <>
      <Link href="/admin/tripulantes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Tripulantes</Link>
      <PageHeader title={t.nome} subtitle={label(t.funcao)} />
      <div className="card p-6"><TripulanteForm t={t} embarcacoes={db().embarcacoes.map(({ id, nome }) => ({ id, nome }))} /></div>
      <div className="card mt-6 p-5">
        <h2 className="mb-3 font-bold">Próximas escalas</h2>
        {proximas.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {proximas.map((v) => (
              <li key={v.id}>
                <Link href={`/admin/viagens/${v.id}`} className="block rounded-xl bg-slate-50 p-3 text-sm hover:bg-rio-50">
                  <span className="font-semibold">{dateShort(v.partida)} {time(v.partida)}</span> · {linha(v.linhaId).nome}
                </Link>
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
