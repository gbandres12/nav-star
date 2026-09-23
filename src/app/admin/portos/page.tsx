import { ActionForm, Campo, Checkbox } from "@/components/admin/action-form";
import { Badge, PageHeader } from "@/components/ui";
import { salvarCidadeAction, salvarPortoAction } from "@/lib/admin-actions";
import { garantirAcesso } from "@/lib/sessao";
import { cidade, db } from "@/lib/store";
import { money } from "@/lib/format";
import type { Porto } from "@/lib/types";

export const metadata = { title: "Portos" };

function PortoCampos({ p }: { p?: Porto }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Campo label="Cidade" className="lg:col-span-2">
        <select name="cidadeId" defaultValue={p?.cidadeId} className="input">
          {db().cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}/{c.uf}</option>)}
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
  await garantirAcesso("/admin/portos");
  return (
    <>
      <PageHeader title="Portos" subtitle="Locais de embarque e desembarque, com a taxa cobrada em cada um" />
      <div className="card overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {db().portos.map((p) => {
            const c = cidade(p.cidadeId);
            const linhas = db().linhas.filter((l) => l.paradas.some((x) => x.portoId === p.id));
            return (
              <li key={p.id} className="p-5">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">{p.nome}</span>
                    <span className="text-sm text-slate-500">{c.nome}/{c.uf} · {p.endereco}</span>
                    <span className="ml-auto text-sm tabular-nums">Taxa {money(p.taxaEmbarque)}</span>
                    <span className="text-sm text-slate-500">{linhas.length} linha(s)</span>
                    <Badge status={p.ativo ? "ATIVA" : "INATIVA"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                  </summary>
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <ActionForm action={salvarPortoAction}><PortoCampos p={p} /></ActionForm>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Novo porto</h2>
          <ActionForm action={salvarPortoAction} submit="Cadastrar porto"><PortoCampos /></ActionForm>
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
    </>
  );
}
