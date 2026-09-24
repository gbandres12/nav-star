import { ActionForm, Campo, Checkbox } from "./action-form";
import { salvarFestivalAction } from "@/lib/festivais-actions";
import type { Festival } from "@/lib/types";

const CORES = [
  ["rubro", "Vermelho"],
  ["rio", "Azul"],
  ["sol", "Amarelo"],
  ["emerald", "Verde"],
];

export function FestivalForm({ f, cidades }: { f?: Festival; cidades: { id: string; nome: string }[] }) {
  return (
    <ActionForm action={salvarFestivalAction} submit={f ? "Salvar festival" : "Cadastrar e escolher as viagens"}>
      {f && <input type="hidden" name="id" value={f.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Nome" className="sm:col-span-2"><input name="nome" required defaultValue={f?.nome} className="input" placeholder="Festival de Parintins 2027" /></Campo>
        <Campo label="Cidade do evento">
          <select name="cidadeId" defaultValue={f?.cidadeId} className="input">
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Cor do destaque">
          <select name="cor" defaultValue={f?.cor ?? "rubro"} className="input">
            {CORES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Início do evento"><input name="inicio" type="date" required defaultValue={f?.inicio} className="input" /></Campo>
        <Campo label="Fim do evento"><input name="fim" type="date" required defaultValue={f?.fim} className="input" /></Campo>
        <Campo label="Reajuste na tarifa (%)" dica="0 = preço normal da linha"><input name="acrescimoPercentual" type="number" min={0} max={200} step="1" defaultValue={f?.acrescimoPercentual ?? 0} className="input" /></Campo>
        <Campo label="Endereço no site" dica="Em branco: gerado pelo nome"><input name="slug" defaultValue={f?.slug} className="input" placeholder="festival-de-parintins-2027" /></Campo>
        <Campo label="Chamada (frase curta do card)" className="sm:col-span-2 lg:col-span-4"><input name="chamada" defaultValue={f?.chamada} className="input" placeholder="Garantido × Caprichoso no Bumbódromo" /></Campo>
        <Campo label="Descrição" className="sm:col-span-2 lg:col-span-4"><textarea name="descricao" rows={3} defaultValue={f?.descricao} className="input" /></Campo>
      </div>
      <div className="mt-4"><Checkbox name="publicado" label="Publicado no site (aparece na página inicial até o fim do evento)" defaultChecked={f?.publicado ?? false} /></div>
    </ActionForm>
  );
}
