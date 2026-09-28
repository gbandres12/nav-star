import { ActionForm, Campo } from "./action-form";
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
      <div className="mt-5 grid gap-4 sm:grid-cols-[220px_1fr] sm:items-end">
        <Campo label="Lotação total (passageiros)">
          <input name="capacidadePassageiros" type="number" min={1} required defaultValue={e?.capacidadePassageiros || undefined} className="input" placeholder="Ex.: 128" />
        </Campo>
        <p className="text-xs text-slate-500 sm:pb-3">
          Limite da Capitania, contando quem viaja sem poltrona (criança de colo). A venda de cada trecho para ao atingir este número.
        </p>
      </div>
      <label className="mt-5 flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
        <input type="checkbox" name="assentoLivre" defaultChecked={e?.assentoLivre ?? true} className="mt-0.5 size-4" />
        <span>
          <span className="font-semibold">Assento livre</span>
          <span className="block text-xs text-slate-500">
            Sem poltrona numerada: o passageiro senta onde quiser ao embarcar e o bilhete não mostra número. Desmarque quando a venda passar a escolher a poltrona.
          </span>
        </span>
      </label>
    </ActionForm>
  );
}
