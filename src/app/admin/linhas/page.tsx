import Link from "next/link";
import { HandCoins, Pencil, Plus } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { db, embarcacao, paradaInfo } from "@/lib/store";
import { duration } from "@/lib/format";

export const metadata = { title: "Linhas" };

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function Linhas() {
  await garantirAcesso("/admin/linhas");
  const agora = new Date();
  return (
    <>
      <PageHeader
        title="Linhas"
        subtitle="Sequência de paradas e programação semanal. Os preços ficam em Trechos e preços."
        actions={<Link href="/admin/linhas/nova" className="btn-primary"><Plus size={16} /> Nova linha</Link>}
      />
      <div className="space-y-4">
        {db().linhas.map((l) => {
          const paradas = l.paradas.map((p) => paradaInfo(l.id, p.ordem));
          const futuras = db().viagens.filter((v) => v.linhaId === l.id && new Date(v.partida) > agora && v.status !== "CANCELADA").length;
          return (
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
                {paradas.map((p, i) => (
                  <li key={p.ordem} className="flex items-center gap-2">
                    <span className="rounded-lg bg-slate-50 px-3 py-1.5">
                      <span className="font-semibold">{p.cidade.nome}</span>
                      <span className="ml-1 text-xs text-slate-500">{i === 0 ? "saída" : `+${duration(p.minutosDesdeOrigem)}`}</span>
                    </span>
                    {i < paradas.length - 1 && <span className="text-rio-300">→</span>}
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {l.horarios.map((h, i) => (
                  <span key={i} className="rounded-lg bg-rio-50 px-3 py-1.5 font-semibold text-rio-800">
                    {DIAS[h.diaSemana]} {h.horaSaida} · {embarcacao(h.embarcacaoId).nome}
                  </span>
                ))}
                <span className="text-slate-500">{futuras} viagens futuras programadas</span>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
