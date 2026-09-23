import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EmbarcacaoForm } from "@/components/admin/embarcacao-form";
import { PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Nova embarcação" };

export default async function NovaEmbarcacao() {
  await garantirAcesso("/admin/embarcacoes");
  return (
    <>
      <Link href="/admin/embarcacoes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Embarcações</Link>
      <PageHeader title="Nova embarcação" subtitle="Depois de cadastrar, monte o mapa de poltronas e os cômodos" />
      <div className="card p-6"><EmbarcacaoForm /></div>
    </>
  );
}
