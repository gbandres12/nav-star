import Link from "next/link";
import { HandCoins, Pencil, Plus } from "lucide-react";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { cidades, embarcacoes, linhas, portos } from "@/lib/data/catalogo";
import { viagensAdmin } from "@/lib/data/viagens";
import { duration } from "@/lib/format";

export const metadata = { title: "Linhas" };

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function Linhas() {
  const op = await garantirAcesso("/admin/linhas");
  const [ls, ps, cs, es, futuras] = await Promise.all([linhas(), portos(), cidades(), embarcacoes(), viagensAdmin({ aba: "proximas" })]);
  const nomeCidade = (portoId: string) => cs.find((c) => c.id === ps.find((p) => p.id === portoId)?.cidadeId)?.nome ?? "?";
  return (
    <>
      <PageHeader
        title="Linhas"
        subtitle="Sequência de paradas e programação semanal. Os preços ficam em Trechos e preços."
        actions={op.papel === "ADMIN" && <Link href="/admin/linhas/nova" className="btn-primary"><Plus size={16} /> Nova linha</Link>}
      />
      {ls.length === 0 && <Empty>Nenhuma linha cadastrada.</Empty>}
      <div className="space-y-4">
        {ls.map((l) => (
          <section key={l.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">{l.nome}</h2>
                <Badge status={l.ativa ? "ATIVA" : "INATIVA"} />
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/trechos?linha=${l.id}`} className="btn-ghost"><HandCoins size={15} /> Preços</Link>
                <Link href={`/admin/linhas/${l.id}`} className="btn-ghost"><Pencil size={15} /> Editar</Link>
              </div>
            </div>
            <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3 text-sm">
              {l.paradas.map((p, i) => (
                <li key={p.ordem} className="flex items-center gap-2">
                  <span className="rounded-lg bg-slate-50 px-3 py-1.5">
                    <span className="font-semibold">{nomeCidade(p.portoId)}</span>
                    <span className="ml-1 text-xs text-slate-500">{i === 0 ? "saída" : `+${duration(p.minutosDesdeOrigem)}`}</span>
                  </span>
                  {i < l.paradas.length - 1 && <span className="text-rio-300">→</span>}
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {l.horarios.map((h, i) => (
                <span key={i} className="rounded-lg bg-rio-50 px-3 py-1.5 font-semibold text-rio-800">
                  {DIAS[h.diaSemana]} {h.horaSaida} · {es.find((e) => e.id === h.embarcacaoId)?.nome ?? "—"}
                </span>
              ))}
              {l.horarios.length === 0 && <span className="text-amber-700">Sem programação semanal</span>}
              <span className="text-slate-500">{futuras.filter((v) => v.linhaId === l.id && v.status !== "CANCELADA").length} viagens futuras programadas</span>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
