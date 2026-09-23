import { ActionForm, Campo, Checkbox } from "./action-form";
import { salvarTripulanteAction } from "@/lib/admin-actions";
import { label } from "@/lib/format";
import type { Tripulante } from "@/lib/types";

const FUNCOES = ["COMANDANTE", "IMEDIATO", "MAQUINISTA", "MARINHEIRO", "TAIFEIRO", "COMISSARIO"];

export function TripulanteForm({ t, embarcacoes }: { t?: Tripulante; embarcacoes: { id: string; nome: string }[] }) {
  return (
    <ActionForm action={salvarTripulanteAction} submit={t ? "Salvar" : "Cadastrar tripulante"}>
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="Nome completo" className="sm:col-span-2"><input name="nome" required defaultValue={t?.nome} className="input" /></Campo>
        <Campo label="Função">
          <select name="funcao" defaultValue={t?.funcao ?? "MARINHEIRO"} className="input">
            {FUNCOES.map((f) => <option key={f} value={f}>{label(f)}</option>)}
          </select>
        </Campo>
        <Campo label="CPF"><input name="documento" required defaultValue={t?.documento} className="input" /></Campo>
        <Campo label="Habilitação (CIR)" dica="Caderneta de Inscrição e Registro da Marinha"><input name="habilitacao" defaultValue={t?.habilitacao} className="input" /></Campo>
        <Campo label="Validade da habilitação"><input name="validadeHabilitacao" type="date" defaultValue={t?.validadeHabilitacao} className="input" /></Campo>
        <Campo label="Telefone"><input name="telefone" defaultValue={t?.telefone} className="input" /></Campo>
        <Campo label="Lotação fixa">
          <select name="embarcacaoId" defaultValue={t?.embarcacaoId ?? ""} className="input">
            <option value="">Nenhuma (reserva)</option>
            {embarcacoes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </Campo>
        <div className="flex items-end pb-2"><Checkbox name="ativo" label="Ativo" defaultChecked={t?.ativo ?? true} /></div>
      </div>
    </ActionForm>
  );
}
