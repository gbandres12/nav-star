import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, HandCoins } from "lucide-react";
import { HorariosEditor, LinhaEditor } from "@/components/admin/linha-editor";
import { PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { cidades, embarcacoes, linha, portos } from "@/lib/data/catalogo";

export const metadata = { title: "Linha" };

export default async function EditarLinha({ params }: PageProps<"/admin/linhas/[id]">) {
  await garantirAcesso("/admin/linhas");
  const { id } = await params;
  const [l, ps, cs, es] = await Promise.all([linha(id), portos(), cidades(), embarcacoes()]);
  if (!l) notFound();
  const opcoes = ps
    .filter((p) => p.ativo || l.paradas.some((x) => x.portoId === p.id))
    .map((p) => ({ id: p.id, nome: p.nome, cidade: cs.find((c) => c.id === p.cidadeId)?.nome ?? "?" }));
  return (
    <>
      <Link href="/admin/linhas" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Linhas</Link>
      <PageHeader title={l.nome} actions={<Link href={`/admin/trechos?linha=${l.id}`} className="btn-ghost"><HandCoins size={15} /> Preços dos trechos</Link>} />
      <div className="card p-6">
        <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Aqui dá para ajustar o nome, a situação e o horário previsto em cada parada. Para outra sequência de portos, crie uma linha nova.
        </p>
        <LinhaEditor linha={{ id: l.id, nome: l.nome, ativa: l.ativa, paradas: l.paradas }} portos={opcoes} />
      </div>
      <div className="card mt-6 p-6">
        <h2 className="mb-1 font-bold">Programação semanal</h2>
        <p className="mb-4 text-sm text-slate-500">Dias e horários de saída. As viagens dos próximos dias são geradas automaticamente a partir daqui.</p>
        <HorariosEditor linhaId={l.id} horarios={l.horarios} embarcacoes={es.map(({ id, nome }) => ({ id, nome }))} />
      </div>
    </>
  );
}
