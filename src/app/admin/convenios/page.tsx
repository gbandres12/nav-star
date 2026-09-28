import Link from "next/link";
import { ActionForm, Campo, Checkbox } from "@/components/admin/action-form";
import { Badge, PageHeader } from "@/components/ui";
import { salvarConvenioAction, salvarTarifaConvenioAction } from "@/lib/admin-actions";
import { garantirAcesso } from "@/lib/sessao";
import { cidades, linhas, portos } from "@/lib/data/catalogo";
import { listarConvenios, listarTarifasConvenio } from "@/lib/data/convenios";
import { money } from "@/lib/format";
import type { Convenio } from "@/lib/types";

export const metadata = { title: "Convênios" };

function Campos({ c }: { c?: Convenio }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {c && <input type="hidden" name="id" value={c.id} />}
      <Campo label="Nome" className="lg:col-span-3"><input name="nome" required defaultValue={c?.nome} className="input" placeholder="Prefeitura, secretaria, empresa…" /></Campo>
      <Campo label="CNPJ" className="lg:col-span-2"><input name="cnpj" defaultValue={c?.cnpj} className="input" /></Campo>
      <Campo label="Desconto geral (%)"><input name="descontoPercentual" type="number" min={0} max={100} step="0.01" defaultValue={c?.descontoPercentual ?? 0} className="input" /></Campo>
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
  const [lista, tarifas, linhasLista, portosLista, cidadesLista] = await Promise.all([
    listarConvenios(), listarTarifasConvenio(), linhas(), portos(), cidades(),
  ]);
  const portoNome = new Map(portosLista.map((p) => [p.id, `${cidadesLista.find((cidade) => cidade.id === p.cidadeId)?.nome ?? p.nome} · ${p.nome}`]));
  const trechos = linhasLista.flatMap((l) => l.paradas.flatMap((origem) =>
    l.paradas.filter((destino) => destino.ordem > origem.ordem && l.tarifas[origem.ordem]?.[destino.ordem] != null)
      .map((destino) => ({
        key: `${l.id}:${origem.ordem}:${destino.ordem}`,
        nome: `${l.nome}: ${portoNome.get(origem.portoId) ?? "Origem"} → ${portoNome.get(destino.portoId) ?? "Destino"}`,
        tabela: l.tarifas[origem.ordem][destino.ordem],
      }))
  ));
  const trechosPorChave = new Map(trechos.map((t) => [t.key, t]));
  return (
    <>
      <PageHeader
        title="Convênios"
        subtitle="Desconto geral ou tarifa negociada por trecho. A taxa do porto de origem é somada depois, salvo para passageiros isentos."
        actions={<Link href="/admin/relatorios/por-convenio" className="btn-ghost">Relatório por convênio</Link>}
      />
      <p className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Exemplo: tabela R$ 520, tarifa negociada R$ 500 e taxa R$ 9 resultam em R$ 509 para a inteira.
        Um desconto de 30% para passageiro isento usa a tabela (R$ 364), sem taxa. O menor preço aplicável prevalece.
      </p>
      <div className="card overflow-hidden">
        {lista.length === 0 && <p className="p-5 text-sm text-slate-500">Nenhum convênio cadastrado.</p>}
        <ul className="divide-y divide-slate-100">
          {lista.map((c) => {
            const regras = tarifas.filter((t) => t.convenioId === c.id);
            return (
              <li key={c.id} className="p-5">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">{c.nome}</span>
                    <span className="text-sm text-slate-500">Desconto geral {c.descontoPercentual}% · {regras.filter((r) => r.ativa).length} tarifa(s) especiais{c.faturado ? " · faturado" : ""}</span>
                    <span className="ml-auto" />
                    <Badge status={c.ativo ? "ATIVA" : "INATIVA"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                  </summary>
                  <div className="mt-4 rounded-xl bg-slate-50 p-4"><ActionForm action={salvarConvenioAction}><Campos c={c} /></ActionForm></div>
                  <div className="mt-5 space-y-3">
                    <h3 className="font-semibold">Tarifas negociadas por trecho</h3>
                    <p className="text-xs text-slate-500">Informe o preço da passagem sem taxa. Desative uma regra para voltar ao desconto geral.</p>
                    {regras.map((r) => {
                      const trecho = trechosPorChave.get(`${r.linhaId}:${r.origemOrdem}:${r.destinoOrdem}`);
                      return (
                        <ActionForm key={r.id} action={salvarTarifaConvenioAction} submit="Salvar tarifa">
                          <input type="hidden" name="convenioId" value={c.id} />
                          <input type="hidden" name="trecho" value={`${r.linhaId}:${r.origemOrdem}:${r.destinoOrdem}`} />
                          <div className="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]">
                            <div className="text-sm"><strong>{trecho?.nome ?? "Trecho fora das linhas atuais"}</strong><br />Tabela: {trecho ? money(trecho.tabela) : "—"}</div>
                            <Campo label="Tarifa especial (R$)"><input name="valor" type="number" min={0} max={trecho?.tabela} step="0.01" required defaultValue={r.valor} className="input" /></Campo>
                            <Checkbox name="ativa" label="Ativa" defaultChecked={r.ativa} />
                          </div>
                        </ActionForm>
                      );
                    })}
                    <ActionForm action={salvarTarifaConvenioAction} submit="Adicionar tarifa" limparAoSalvar>
                      <input type="hidden" name="convenioId" value={c.id} />
                      <input type="hidden" name="ativa" value="true" />
                      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                        <Campo label="Trecho"><select name="trecho" required defaultValue="" className="input"><option value="" disabled>Selecione o trecho</option>{trechos.map((t) => <option key={t.key} value={t.key}>{t.nome} · tabela {money(t.tabela)}</option>)}</select></Campo>
                        <Campo label="Tarifa especial (R$)"><input name="valor" type="number" min={0} step="0.01" required className="input" /></Campo>
                      </div>
                    </ActionForm>
                  </div>
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
