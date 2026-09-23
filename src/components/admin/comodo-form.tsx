import { ActionForm, Campo, Checkbox } from "./action-form";
import { salvarComodoAction } from "@/lib/admin-actions";
import type { Comodo } from "@/lib/types";

const CORES = [
  ["slate", "Cinza (padrão)"],
  ["rio", "Azul"],
  ["sol", "Amarelo"],
  ["rubro", "Vermelho"],
  ["emerald", "Verde"],
];

export function ComodoForm({ c, embarcacoes, embarcacaoId }: { c?: Comodo; embarcacoes: { id: string; nome: string }[]; embarcacaoId?: string }) {
  return (
    <ActionForm action={salvarComodoAction} submit={c ? "Salvar" : "Criar cômodo"} limparAoSalvar={!c}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Campo label="Embarcação" className="lg:col-span-2">
          <select name="embarcacaoId" defaultValue={c?.embarcacaoId ?? embarcacaoId} className="input">
            {embarcacoes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Nome" className="lg:col-span-2"><input name="nome" required defaultValue={c?.nome} className="input" placeholder="Executiva, Camarote, Suíte…" /></Campo>
        <Campo label="Acréscimo (R$)"><input name="acrescimo" type="number" min={0} step="0.01" defaultValue={c?.acrescimo ?? 0} className="input" /></Campo>
        <Campo label="Cor no mapa">
          <select name="cor" defaultValue={c?.cor ?? "slate"} className="input">
            {CORES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Descrição" className="sm:col-span-2 lg:col-span-5"><input name="descricao" defaultValue={c?.descricao} className="input" /></Campo>
        <div className="flex items-end pb-2"><Checkbox name="ativo" label="Ativo" defaultChecked={c?.ativo ?? true} /></div>
      </div>
    </ActionForm>
  );
}
