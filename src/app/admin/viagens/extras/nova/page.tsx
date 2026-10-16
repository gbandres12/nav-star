import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ViagemExtraForm } from "@/components/admin/viagem-extra-form";
import { PageHeader } from "@/components/ui";
import { embarcacoes } from "@/lib/data/catalogo";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Nova viagem extra" };

export default async function NovaViagemExtra() {
  await garantirAcesso("/admin/viagens/extras");
  const lista = (await embarcacoes()).filter((e) => e.status === "ATIVA");
  return (
    <>
      <Link href="/admin/viagens/extras" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Viagens extras</Link>
      <PageHeader title="Nova viagem extra" subtitle="Registro para acompanhamento: o destino é livre e os valores são informados por você. Não vende passagem no sistema." />
      <div className="card max-w-3xl p-6"><ViagemExtraForm embarcacoes={lista.map((e) => ({ id: e.id, nome: e.nome }))} /></div>
    </>
  );
}
