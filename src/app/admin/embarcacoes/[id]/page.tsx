import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EditorMapa } from "@/components/admin/editor-mapa";
import { EmbarcacaoForm } from "@/components/admin/embarcacao-form";
import { Badge, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { capacidade, comodosDaEmbarcacao, db } from "@/lib/store";
import { money } from "@/lib/format";

export const metadata = { title: "Embarcação" };

export default async function EditarEmbarcacao({ params }: PageProps<"/admin/embarcacoes/[id]">) {
  await garantirAcesso("/admin/embarcacoes");
  const { id } = await params;
  const e = db().embarcacoes.find((x) => x.id === id);
  if (!e) notFound();
  const cms = comodosDaEmbarcacao(e.id);
  return (
    <>
      <Link href="/admin/embarcacoes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Embarcações</Link>
      <PageHeader title={e.nome} subtitle={<span className="flex items-center gap-2">{e.assentoLivre ? `Assento livre · ${capacidade(e)} lugares` : `${e.assentos.length} poltronas`} <Badge status={e.status} /></span>} />

      <div className="card p-6">
        <h2 className="mb-4 font-bold">Dados da embarcação</h2>
        <EmbarcacaoForm e={e} />
      </div>

      <div className="card mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Mapa de poltronas</h2>
          <p className="text-sm text-slate-500">Poltronas com passagem vendida para viagens futuras não podem ser removidas.</p>
        </div>
        {e.assentoLivre && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Esta embarcação vende em <strong>assento livre</strong>: o mapa abaixo não é usado na venda. Para numerar as poltronas, desmarque “Assento livre” nos dados acima.</p>}
        <EditorMapa embarcacaoId={e.id} assentos={e.assentos} colunasIniciais={e.colunasMapa} comodos={cms.filter((c) => c.ativo).map(({ id, nome, cor, acrescimo }) => ({ id, nome, cor, acrescimo }))} />
      </div>

      <div className="card mt-6 overflow-x-auto">
        <div className="flex items-center justify-between p-5">
          <h2 className="font-bold">Cômodos desta embarcação</h2>
          <Link href={`/admin/comodos?embarcacao=${e.id}`} className="text-sm font-semibold text-rio-700 hover:underline">Gerenciar cômodos</Link>
        </div>
        <table className="table-base">
          <thead><tr><th>Cômodo</th><th>Descrição</th><th className="text-right">Acréscimo</th><th className="text-right">Poltronas</th></tr></thead>
          <tbody>
            {cms.map((c) => (
              <tr key={c.id}>
                <td className="font-semibold">{c.nome}</td>
                <td className="text-slate-600">{c.descricao}</td>
                <td className="text-right tabular-nums">{c.acrescimo ? `+${money(c.acrescimo)}` : "—"}</td>
                <td className="text-right tabular-nums">{e.assentos.filter((a) => a.comodoId === c.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
