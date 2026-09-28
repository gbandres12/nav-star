import { ActionForm, Campo, Checkbox } from "@/components/admin/action-form";
import { MonthNav } from "@/components/admin/month-nav";
import { Badge, PageHeader } from "@/components/ui";
import { salvarAgenciaAction } from "@/lib/admin-actions";
import { garantirAcesso } from "@/lib/sessao";
import { cidades as listarCidades } from "@/lib/data/catalogo";
import { agenciasCompletas, vendasPorAgencia, type AgenciaCompleta } from "@/lib/data/frota";
import { money } from "@/lib/format";
import { periodoMes } from "@/lib/periodo";

export const metadata = { title: "Agências" };

function Campos({ a, cidades }: { a?: AgenciaCompleta; cidades: { id: string; nome: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {a && <input type="hidden" name="id" value={a.id} />}
      <Campo label="Nome" className="lg:col-span-2"><input name="nome" required defaultValue={a?.nome} className="input" /></Campo>
      <Campo label="Cidade">
        <select name="cidadeId" defaultValue={a?.cidadeId} className="input">
          {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo label="CNPJ (opcional)"><input name="cnpj" defaultValue={a?.cnpj} className="input" placeholder="00.000.000/0000-00" /></Campo>
      <Campo label="Comissão (%)"><input name="comissaoPercentual" type="number" min={0} max={50} step="0.5" defaultValue={a?.comissaoPercentual ?? 8} className="input" /></Campo>
      <div className="flex items-end pb-2"><Checkbox name="ativa" label="Ativa" defaultChecked={a?.ativa ?? true} /></div>
    </div>
  );
}

export default async function Agencias({ searchParams }: PageProps<"/admin/agencias">) {
  await garantirAcesso("/admin/agencias");
  const { mes } = await searchParams;
  const per = periodoMes(mes);
  const [lista, vendas, todasCidades] = await Promise.all([agenciasCompletas(), vendasPorAgencia(per.inicio, per.fim), listarCidades()]);
  const cidades = todasCidades.map(({ id, nome }) => ({ id, nome }));
  return (
    <>
      <PageHeader
        title="Agências parceiras"
        subtitle="Parceiros que vendem com comissão. O vendedor da agência é cadastrado em Usuários, ligado à agência: as vendas dele saem com a comissão."
        actions={<MonthNav base="/admin/agencias" {...per} />}
      />
      <div className="card overflow-hidden">
        {lista.length === 0 && <p className="p-5 text-sm text-slate-500">Nenhuma agência cadastrada.</p>}
        <ul className="divide-y divide-slate-100">
          {lista.map((a) => {
            const v = vendas.get(a.id);
            return (
              <li key={a.id} className="p-5">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">{a.nome}</span>
                    <span className="text-sm text-slate-500">{a.cidadeNome} · {a.comissaoPercentual}%</span>
                    <span className="ml-auto text-sm text-slate-500">
                      {per.nome}: {money(v?.total ?? 0)} em {v?.pedidos ?? 0} pedido(s) · comissão {money(v?.comissao ?? 0)}
                    </span>
                    <Badge status={a.ativa ? "ATIVA" : "INATIVA"} />
                  </summary>
                  <div className="mt-4 rounded-xl bg-slate-50 p-4"><ActionForm action={salvarAgenciaAction}><Campos a={a} cidades={cidades} /></ActionForm></div>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="card mt-6 p-5">
        <h2 className="mb-3 font-bold">Nova agência</h2>
        <ActionForm action={salvarAgenciaAction} submit="Cadastrar agência" limparAoSalvar><Campos cidades={cidades} /></ActionForm>
      </div>
    </>
  );
}
