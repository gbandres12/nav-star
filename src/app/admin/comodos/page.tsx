import Link from "next/link";
import { ComodoForm } from "@/components/admin/comodo-form";
import { Badge, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { comodosDaEmbarcacao, db } from "@/lib/store";
import { money } from "@/lib/format";

export const metadata = { title: "Cômodos" };

export default async function Comodos({ searchParams }: PageProps<"/admin/comodos">) {
  await garantirAcesso("/admin/comodos");
  const sp = await searchParams;
  const filtro = typeof sp.embarcacao === "string" ? sp.embarcacao : "";
  const embarcacoes = db().embarcacoes.map(({ id, nome }) => ({ id, nome }));
  return (
    <>
      <PageHeader
        title="Cômodos"
        subtitle="Tipos de acomodação de cada embarcação. O acréscimo soma ao preço do trecho na venda."
      />
      <div className="card mb-6 p-5">
        <h2 className="mb-3 font-bold">Novo cômodo</h2>
        <ComodoForm embarcacoes={embarcacoes} embarcacaoId={filtro || embarcacoes[0]?.id} />
      </div>
      <div className="space-y-6">
        {db().embarcacoes.filter((e) => !filtro || e.id === filtro).map((e) => (
          <section key={e.id} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <h2 className="font-bold">{e.nome}</h2>
              <Link href={`/admin/embarcacoes/${e.id}`} className="text-sm font-semibold text-rio-700 hover:underline">Editar mapa</Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {comodosDaEmbarcacao(e.id).map((c) => (
                <li key={c.id} className="p-5">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                      <span className="font-semibold">{c.nome}</span>
                      <span className="text-sm text-slate-500">{c.descricao}</span>
                      <span className="ml-auto text-sm tabular-nums">{c.acrescimo ? `+${money(c.acrescimo)}` : "sem acréscimo"}</span>
                      <span className="text-sm text-slate-500">{e.assentos.filter((a) => a.comodoId === c.id).length} poltronas</span>
                      <Badge status={c.ativo ? "ATIVA" : "INATIVA"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                    </summary>
                    <div className="mt-4 rounded-xl bg-slate-50 p-4"><ComodoForm c={c} embarcacoes={embarcacoes} /></div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
