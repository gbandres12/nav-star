import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TripulanteForm } from "@/components/admin/tripulante-form";
import { PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { db } from "@/lib/store";

export const metadata = { title: "Novo tripulante" };

export default async function NovoTripulante() {
  await garantirAcesso("/admin/tripulantes");
  return (
    <>
      <Link href="/admin/tripulantes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Tripulantes</Link>
      <PageHeader title="Novo tripulante" />
      <div className="card p-6"><TripulanteForm embarcacoes={db().embarcacoes.map(({ id, nome }) => ({ id, nome }))} /></div>
    </>
  );
}
