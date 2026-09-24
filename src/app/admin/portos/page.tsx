import { ActionForm, Campo, Checkbox } from "@/components/admin/action-form";
import { Badge, PageHeader } from "@/components/ui";
import { salvarCidadeAction, salvarPortoAction } from "@/lib/precos-actions";
import { garantirAcesso } from "@/lib/sessao";
import { cidades, linhas, portos } from "@/lib/data/catalogo";
import { money } from "@/lib/format";
import type { Cidade, Porto } from "@/lib/types";

export const metadata = { title: "Portos" };

function PortoCampos({ p, cs }: { p?: Porto; cs: Cidade[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Campo label="Cidade" className="lg:col-span-2">
        <select name="cidadeId" defaultValue={p?.cidadeId} className="input">
          {cs.map((c) => <option key={c.id} value={c.id}>{c.nome}/{c.uf}</option>)}
        </select>
      </Campo>
      <Campo label="Nome do porto" className="lg:col-span-2"><input name="nome" required defaultValue={p?.nome} className="input" /></Campo>
      <Campo label="Taxa de embarque (R$)"><input name="taxaEmbarque" type="number" min={0} step="0.01" defaultValue={p?.taxaEmbarque ?? 0} className="input" /></Campo>
      <div className="flex items-end pb-2"><Checkbox name="ativo" label="Ativo" defaultChecked={p?.ativo ?? true} /></div>
      <Campo label="Endereço" className="sm:col-span-2 lg:col-span-6"><input name="endereco" defaultValue={p?.endereco} className="input" /></Campo>
    </div>
  );
}

export default async function Portos() {
  const op = await garantirAcesso("/admin/portos");
  const [ps, cs, ls] = await Promise.all([portos(), cidades(), linhas()]);
  const admin = op.papel === "ADMIN";
  return (
    <>
      <PageHeader title="Portos" subtitle="Locais de embarque e desembarque. A taxa de embarque é cobrada de quem embarca em cada porto." />
      <div className="card overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {ps.map((p) => {
            const c = cs.find((x) => x.id === p.cidadeId);
            const nLinhas = ls.filter((l) => l.paradas.some((x) => x.portoId === p.id)).length;
            return (
              <li key={p.id} className="p-5">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">{p.nome}</span>
                    <span className="text-sm text-slate-500">{c ? `${c.nome}/${c.uf}` : "—"}{p.endereco && ` · ${p.endereco}`}</span>
                    <span className="ml-auto text-sm tabular-nums">Taxa {money(p.taxaEmbarque)}</span>
                    <span className="text-sm text-slate-500">{nLinhas} linha(s)</span>
                    <Badge status={p.ativo ? "ATIVA" : "INATIVA"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                  </summary>
                  {admin && (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4">
                      <ActionForm action={salvarPortoAction}><PortoCampos p={p} cs={cs} /></ActionForm>
                    </div>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      </div>

      {admin && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="card p-5">
            <h2 className="mb-3 font-bold">Novo porto</h2>
            <ActionForm action={salvarPortoAction} submit="Cadastrar porto" limparAoSalvar><PortoCampos cs={cs} /></ActionForm>
          </div>
          <div className="card p-5">
            <h2 className="mb-1 font-bold">Nova cidade</h2>
            <p className="mb-3 text-sm text-slate-500">A sigla aparece grande no bilhete (ex.: MAO, STM).</p>
            <ActionForm action={salvarCidadeAction} submit="Cadastrar cidade" limparAoSalvar>
              <div className="grid grid-cols-[1fr_70px_80px] gap-2">
                <Campo label="Nome"><input name="nome" required className="input" /></Campo>
                <Campo label="UF"><input name="uf" required maxLength={2} className="input uppercase" /></Campo>
                <Campo label="Sigla"><input name="sigla" required maxLength={3} className="input uppercase" /></Campo>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
