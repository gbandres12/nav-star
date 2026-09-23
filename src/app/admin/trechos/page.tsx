import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { PageHeader } from "@/components/ui";
import { salvarTarifasAction } from "@/lib/admin-actions";
import { garantirAcesso } from "@/lib/sessao";
import { config, db, paradaInfo } from "@/lib/store";
import { label, money } from "@/lib/format";

export const metadata = { title: "Trechos e preços" };

export default async function Trechos({ searchParams }: PageProps<"/admin/trechos">) {
  await garantirAcesso("/admin/trechos");
  const sp = await searchParams;
  const l = db().linhas.find((x) => x.id === sp.linha) ?? db().linhas[0];
  const paradas = l.paradas.map((p) => paradaInfo(l.id, p.ordem));
  const descontos = Object.entries(config().valores.descontos).filter(([, d]) => d > 0);
  return (
    <>
      <PageHeader title="Trechos e preços" subtitle="Preço de cada par embarque → desembarque. A taxa de embarque do porto é cobrada à parte." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {db().linhas.map((x) => (
          <Link key={x.id} href={`/admin/trechos?linha=${x.id}`} className={`rounded-full border px-3 py-1.5 ${x.id === l.id ? "border-rio-600 bg-rio-50 font-semibold text-rio-800" : "border-slate-200 bg-white text-slate-600"}`}>
            {x.nome}
          </Link>
        ))}
      </div>
      <div className="card p-5">
        <ActionForm action={salvarTarifasAction} submit="Salvar preços">
          <input type="hidden" name="linhaId" value={l.id} />
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Embarque ↓ / Destino →</th>
                  {paradas.slice(1).map((p) => <th key={p.ordem} className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-slate-600">{p.cidade.nome}</th>)}
                </tr>
              </thead>
              <tbody>
                {paradas.slice(0, -1).map((o) => (
                  <tr key={o.ordem} className="border-t border-slate-100">
                    <td className="sticky left-0 bg-white px-3 py-2 font-semibold whitespace-nowrap">
                      {o.cidade.nome}
                      <span className="block text-xs font-normal text-slate-500">taxa {money(o.porto.taxaEmbarque)}</span>
                    </td>
                    {paradas.slice(1).map((d) => (
                      <td key={d.ordem} className="px-2 py-2 text-right">
                        {d.ordem > o.ordem ? (
                          <input name={`t-${o.ordem}-${d.ordem}`} type="number" min={0} step="0.01" defaultValue={l.tarifas[o.ordem]?.[d.ordem] ?? 0} aria-label={`${o.cidade.nome} para ${d.cidade.nome}`} className={`input w-28 text-right tabular-nums ${(l.tarifas[o.ordem]?.[d.ordem] ?? 0) === 0 ? "border-amber-400" : ""}`} />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Na venda, o preço final = preço do trecho + acréscimo do cômodo, com o maior desconto entre o tipo de passageiro e o convênio.
            Descontos atuais: {descontos.map(([t, d]) => `${label(t).toLowerCase()} ${d >= 1 ? "gratuito" : `${Math.round(d * 100)}%`}`).join(", ")} (altere em Configurações → Valores).
            Campos em amarelo estão sem preço.
          </p>
        </ActionForm>
      </div>
    </>
  );
}
