import { ActionForm, Campo, Checkbox } from "./action-form";
import { salvarEmbarcacaoAction } from "@/lib/admin-actions";
import type { Embarcacao } from "@/lib/types";

export function EmbarcacaoForm({ e }: { e?: Embarcacao }) {
  return (
    <ActionForm action={salvarEmbarcacaoAction} submit={e ? "Salvar dados" : "Cadastrar e montar o mapa"}>
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Nome" className="sm:col-span-2"><input name="nome" required defaultValue={e?.nome} className="input" /></Campo>
        <Campo label="Tipo">
          <select name="tipo" defaultValue={e?.tipo ?? "LANCHA"} className="input">
            <option value="LANCHA">Lancha</option>
            <option value="BARCO">Barco (recreio)</option>
            <option value="FERRY">Ferry / balsa</option>
          </select>
        </Campo>
        <Campo label="Status">
          <select name="status" defaultValue={e?.status ?? "ATIVA"} className="input">
            <option value="ATIVA">Ativa</option>
            <option value="MANUTENCAO">Em manutenção</option>
            <option value="INATIVA">Inativa</option>
          </select>
        </Campo>
        <Campo label="Inscrição na Capitania" className="sm:col-span-2"><input name="inscricaoCapitania" required defaultValue={e?.inscricaoCapitania} className="input" placeholder="000-000000-0" /></Campo>
        <Campo label="Carga máxima (kg)"><input name="capacidadeCargaKg" type="number" min={0} defaultValue={e?.capacidadeCargaKg ?? 0} className="input" /></Campo>
        <Campo label="Ano de fabricação"><input name="ano" type="number" min={1950} max={2100} defaultValue={e?.ano} className="input" /></Campo>
        <Campo label="Comprimento (m)"><input name="comprimentoM" type="number" min={0} step="0.1" defaultValue={e?.comprimentoM} className="input" /></Campo>
        <Campo label="Observação" className="sm:col-span-2 lg:col-span-3"><input name="observacao" defaultValue={e?.observacao} className="input" /></Campo>
      </div>
      <fieldset className="mt-5 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-700">Forma de venda dos lugares</legend>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px] sm:items-end">
          <Checkbox name="assentoLivre" defaultChecked={e?.assentoLivre} label={<span><strong>Assento livre</strong> — poltronas sem numeração; o bilhete sai “LIVRE” e a venda para quando atinge a lotação</span>} />
          <Campo label="Lotação (assento livre)"><input name="capacidadePassageiros" type="number" min={1} defaultValue={e?.assentoLivre ? e.capacidadePassageiros : undefined} className="input" placeholder="Ex.: 60" /></Campo>
        </div>
        <p className="mt-2 text-xs text-slate-500">Desmarcado: poltronas numeradas, com a capacidade calculada pelo mapa.</p>
      </fieldset>
    </ActionForm>
  );
}
