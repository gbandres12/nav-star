import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { Empty, PageHeader } from "@/components/ui";
import { salvarTarifasAction } from "@/lib/precos-actions";
import { garantirAcesso } from "@/lib/sessao";
import { cidades, linhas, portos } from "@/lib/data/catalogo";
import { getConfig } from "@/lib/data/utils";
import { label, money } from "@/lib/format";

export const metadata = { title: "Trechos e preços" };

export default async function Trechos({ searchParams }: PageProps<"/admin/trechos">) {
  const op = await garantirAcesso("/admin/trechos");
  const sp = await searchParams;
  const [todas, ps, cs, cfg] = await Promise.all([linhas(), portos(), cidades(), getConfig()]);
  const l = todas.find((x) => x.id === sp.linha) ?? todas[0];
  if (!l) return <Empty>Nenhuma linha cadastrada.</Empty>;
  const info = (portoId: string) => {
    const p = ps.find((x) => x.id === portoId);
    return { porto: p, cidade: cs.find((c) => c.id === p?.cidadeId)?.nome ?? p?.nome ?? "?" };
  };
  const paradas = l.paradas.map((p, i) => ({ i, ...info(p.portoId) }));
  const descontos = Object.entries(cfg.valores.descontos).filter(([t, d]) => d > 0 && t !== "COLO");
  const podeEditar = op.papel === "ADMIN";

  return (
    <>
      <PageHeader title="Trechos e preços" subtitle="Preço da inteira em cada par embarque → desembarque. A taxa de embarque do porto é cobrada à parte." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {todas.map((x) => (
          <Link key={x.id} href={`/admin/trechos?linha=${x.id}`} className={`rounded-full border px-3 py-1.5 ${x.id === l.id ? "border-rio-600 bg-rio-50 font-semibold text-rio-800" : "border-slate-200 bg-white text-slate-600"}`}>
            {x.nome}
          </Link>
        ))}
      </div>
      <div className="card p-5">
        <ActionForm action={salvarTarifasAction} submit={podeEditar ? "Salvar preços" : "Somente administradores podem alterar"}>
          <input type="hidden" name="linhaId" value={l.id} />
          <fieldset disabled={!podeEditar} className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Embarque ↓ / Destino →</th>
                  {paradas.slice(1).map((p) => <th key={p.i} className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-slate-600">{p.cidade}</th>)}
                </tr>
              </thead>
              <tbody>
                {paradas.slice(0, -1).map((o) => (
                  <tr key={o.i} className="border-t border-slate-100">
                    <td className="sticky left-0 bg-white px-3 py-2 font-semibold whitespace-nowrap">
                      {o.cidade}
                      <span className="block text-xs font-normal text-slate-500">taxa {money(o.porto?.taxaEmbarque ?? 0)}</span>
                    </td>
                    {paradas.slice(1).map((d) => (
                      <td key={d.i} className="px-2 py-2 text-right">
                        {d.i > o.i ? (
                          <input
                            name={`t-${o.i}-${d.i}`}
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={l.tarifas[o.i]?.[d.i] ?? 0}
                            aria-label={`${o.cidade} para ${d.cidade}`}
                            className={`input w-28 text-right tabular-nums ${(l.tarifas[o.i]?.[d.i] ?? 0) === 0 ? "border-amber-400" : ""}`}
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </fieldset>
          <p className="mt-3 text-xs text-slate-500">
            Preço final = preço do trecho + acréscimo do cômodo, com o maior desconto entre o tipo de passageiro e o convênio. Descontos atuais (todas as rotas):{" "}
            {descontos.map(([t, d]) => `${label(t).toLowerCase()} ${d >= 1 ? "gratuito" : `${Math.round(d * 100)}%`}`).join(", ")} —{" "}
            <Link href="/admin/configuracoes?aba=valores" className="font-semibold text-rio-700 hover:underline">alterar</Link>. Campos em amarelo estão sem preço.
          </p>
        </ActionForm>
      </div>
    </>
  );
}
