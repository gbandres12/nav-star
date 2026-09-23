import Link from "next/link";
import { ActionForm, Campo, Checkbox } from "@/components/admin/action-form";
import { Badge, PageHeader } from "@/components/ui";
import { salvarConvenioAction } from "@/lib/admin-actions";
import { garantirAcesso } from "@/lib/sessao";
import { db } from "@/lib/store";
import { money } from "@/lib/format";
import type { Convenio } from "@/lib/types";

export const metadata = { title: "Convênios" };

function Campos({ c }: { c?: Convenio }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Campo label="Nome" className="lg:col-span-3"><input name="nome" required defaultValue={c?.nome} className="input" placeholder="Prefeitura, secretaria, empresa…" /></Campo>
      <Campo label="CNPJ" className="lg:col-span-2"><input name="cnpj" defaultValue={c?.cnpj} className="input" /></Campo>
      <Campo label="Desconto (%)"><input name="descontoPercentual" type="number" min={0} max={100} step="0.5" defaultValue={c?.descontoPercentual ?? 0} className="input" /></Campo>
      <Campo label="Contato" className="lg:col-span-4"><input name="contato" defaultValue={c?.contato} className="input" /></Campo>
      <div className="flex flex-col justify-end gap-2 pb-1 lg:col-span-2">
        <Checkbox name="faturado" label="Faturado (paga depois, por fatura)" defaultChecked={c?.faturado} />
        <Checkbox name="ativo" label="Ativo" defaultChecked={c?.ativo ?? true} />
      </div>
    </div>
  );
}

export default async function Convenios() {
  await garantirAcesso("/admin/convenios");
  const usos = (id: string) => db().passagens.filter((p) => p.convenioId === id && p.status !== "CANCELADA");
  return (
    <>
      <PageHeader
        title="Convênios"
        subtitle="Descontos para órgãos e empresas. Convênio faturado emite o bilhete sem cobrar do passageiro."
        actions={<Link href="/admin/relatorios/por-convenio" className="btn-ghost">Relatório por convênio</Link>}
      />
      <div className="card overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {db().convenios.map((c) => {
            const u = usos(c.id);
            return (
              <li key={c.id} className="p-5">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">{c.nome}</span>
                    <span className="text-sm text-slate-500">−{c.descontoPercentual}%{c.faturado ? " · faturado" : ""}</span>
                    <span className="ml-auto text-sm text-slate-500">{u.length} passagens · {money(u.reduce((s, p) => s + p.valor, 0))}</span>
                    <Badge status={c.ativo ? "ATIVA" : "INATIVA"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                  </summary>
                  <div className="mt-4 rounded-xl bg-slate-50 p-4"><ActionForm action={salvarConvenioAction}><Campos c={c} /></ActionForm></div>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="card mt-6 p-5">
        <h2 className="mb-3 font-bold">Novo convênio</h2>
        <ActionForm action={salvarConvenioAction} submit="Cadastrar convênio" limparAoSalvar><Campos /></ActionForm>
      </div>
    </>
  );
}
