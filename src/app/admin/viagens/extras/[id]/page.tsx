import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ViagemExtraForm } from "@/components/admin/viagem-extra-form";
import { PageHeader } from "@/components/ui";
import { embarcacoes } from "@/lib/data/catalogo";
import { viagemExtra } from "@/lib/data/viagens-extras";
import { garantirAcesso } from "@/lib/sessao";
import { UUID } from "@/lib/agencia/banco";

export const metadata = { title: "Viagem extra" };

export default async function EditarViagemExtra({ params }: PageProps<"/admin/viagens/extras/[id]">) {
  await garantirAcesso("/admin/viagens/extras");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [v, lista] = await Promise.all([viagemExtra(id), embarcacoes()]);
  if (!v) notFound();
  const ativas = lista.filter((e) => e.status === "ATIVA" || e.id === v.embarcacaoId);
  return (
    <>
      <Link href="/admin/viagens/extras" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Viagens extras</Link>
      <PageHeader title={`${v.origem} → ${v.destino}`} subtitle={v.tipo === "FRETAMENTO" ? `Fretamento · ${v.clienteNome}` : "Viagem extra"} />
      <div className="card max-w-3xl p-6"><ViagemExtraForm v={v} embarcacoes={ativas.map((e) => ({ id: e.id, nome: e.nome }))} /></div>
    </>
  );
}
