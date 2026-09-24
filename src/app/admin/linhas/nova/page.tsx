import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LinhaEditor } from "@/components/admin/linha-editor";
import { PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { cidades, portos as listarPortos } from "@/lib/data/catalogo";

export const metadata = { title: "Nova linha" };

export default async function NovaLinha() {
  await garantirAcesso("/admin/linhas");
  const [ps, cs] = await Promise.all([listarPortos(), cidades()]);
  const portos = ps.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome, cidade: cs.find((c) => c.id === p.cidadeId)?.nome ?? "?" }));
  return (
    <>
      <Link href="/admin/linhas" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Linhas</Link>
      <PageHeader title="Nova linha" subtitle="Depois de salvar, preencha os preços dos trechos e a programação semanal" />
      <div className="card p-6"><LinhaEditor portos={portos} /></div>
    </>
  );
}
