import { Badge, PageHeader } from "@/components/ui";
import { db, embarcacao, paradaInfo } from "@/lib/store";
import { duration, money } from "@/lib/format";

export const metadata = { title: "Linhas e tarifas" };

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function Linhas() {
  return (
    <>
      <PageHeader title="Linhas e tarifas" subtitle="Cada linha tem paradas em ordem, preço por trecho e programação semanal" />
      <div className="space-y-8">
        {db().linhas.map((l) => {
          const paradas = l.paradas.map((p) => paradaInfo(l.id, p.ordem));
          return (
            <section key={l.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold">{l.nome}</h2>
                  <Badge status={l.ativa ? "ATIVA" : "INATIVA"} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {l.horarios.map((h, i) => (
                    <span key={i} className="rounded-lg bg-rio-50 px-3 py-1.5 text-xs font-semibold text-rio-800">
                      {DIAS[h.diaSemana]} · {h.horaSaida} · {embarcacao(h.embarcacaoId).nome}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 p-5 xl:grid-cols-[280px_1fr]">
                <div>
                  <h3 className="mb-3 text-sm font-bold text-slate-700">Paradas</h3>
                  <ol className="space-y-0">
                    {paradas.map((p, i) => (
                      <li key={p.ordem} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < paradas.length - 1 && <span className="absolute top-5 left-[9px] h-full w-0.5 bg-rio-200" />}
                        <span className={`z-10 mt-0.5 h-5 w-5 shrink-0 rounded-full border-4 ${i === 0 || i === paradas.length - 1 ? "border-rubro-500 bg-white" : "border-rio-400 bg-white"}`} />
                        <div>
                          <p className="text-sm font-semibold">{p.cidade.nome}/{p.cidade.uf}</p>
                          <p className="text-xs text-slate-500">{p.porto.nome} · {i === 0 ? "saída" : `+${duration(p.minutosDesdeOrigem)}`}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="min-w-0">
                  <h3 className="mb-3 text-sm font-bold text-slate-700">Tabela de preços por trecho (embarque × desembarque)</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="sticky left-0 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Embarque ↓ / Destino →</th>
                          {paradas.slice(1).map((p) => (
                            <th key={p.ordem} className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-slate-600">{p.cidade.nome}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paradas.slice(0, -1).map((o) => (
                          <tr key={o.ordem} className="border-t border-slate-100">
                            <td className="sticky left-0 bg-white px-3 py-2.5 font-semibold whitespace-nowrap">{o.cidade.nome}</td>
                            {paradas.slice(1).map((d) => (
                              <td key={d.ordem} className="px-3 py-2.5 text-right tabular-nums">
                                {d.ordem > o.ordem ? money(l.tarifas[o.ordem][d.ordem]) : <span className="text-slate-300">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Taxa de embarque cobrada à parte, conforme o porto de embarque. Descontos: criança, idoso e estudante 50%; PCD gratuito.
                  </p>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
