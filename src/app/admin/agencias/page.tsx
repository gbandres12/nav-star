import { ActionForm, Campo, Checkbox } from "@/components/admin/action-form";
import { Badge, PageHeader } from "@/components/ui";
import { salvarAgenciaAction } from "@/lib/admin-actions";
import { garantirAcesso } from "@/lib/sessao";
import { cidade, db, pedidosPagos } from "@/lib/store";
import { money } from "@/lib/format";
import { periodoMes } from "@/lib/periodo";
import type { Agencia } from "@/lib/types";

export const metadata = { title: "Agências" };

function Campos({ a }: { a?: Agencia }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {a && <input type="hidden" name="id" value={a.id} />}
      <Campo label="Nome" className="lg:col-span-2"><input name="nome" required defaultValue={a?.nome} className="input" /></Campo>
      <Campo label="Cidade">
        <select name="cidadeId" defaultValue={a?.cidadeId} className="input">
          {db().cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo label="Comissão (%)"><input name="comissaoPercentual" type="number" min={0} max={50} step="0.5" defaultValue={a?.comissaoPercentual ?? 8} className="input" /></Campo>
      <div className="flex items-end pb-2"><Checkbox name="ativa" label="Ativa" defaultChecked={a?.ativa ?? true} /></div>
    </div>
  );
}

export default async function Agencias() {
  await garantirAcesso("/admin/agencias");
  const per = periodoMes();
  const mes = pedidosPagos(per.inicio, per.fim);
  return (
    <>
      <PageHeader title="Agências" subtitle="Parceiros que vendem com comissão. Vendedores de agência são cadastrados em Usuários." />
      <div className="card overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {db().agencias.map((a) => {
            const ps = mes.filter((p) => p.agenciaId === a.id);
            return (
              <li key={a.id} className="p-5">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">{a.nome}</span>
                    <span className="text-sm text-slate-500">{cidade(a.cidadeId).nome} · {a.comissaoPercentual}%</span>
                    <span className="ml-auto text-sm text-slate-500">{per.nome}: {money(ps.reduce((s, p) => s + p.total, 0))} vendidos · comissão {money(ps.reduce((s, p) => s + p.comissaoAgencia, 0))}</span>
                    <Badge status={a.ativa ? "ATIVA" : "INATIVA"} />
                  </summary>
                  <div className="mt-4 rounded-xl bg-slate-50 p-4"><ActionForm action={salvarAgenciaAction}><Campos a={a} /></ActionForm></div>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="card mt-6 p-5">
        <h2 className="mb-3 font-bold">Nova agência</h2>
        <ActionForm action={salvarAgenciaAction} submit="Cadastrar agência" limparAoSalvar><Campos /></ActionForm>
      </div>
    </>
  );
}
