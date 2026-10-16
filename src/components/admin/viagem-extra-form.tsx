"use client";

import { useState } from "react";
import { ActionForm, Campo, Checkbox } from "@/components/admin/action-form";
import { salvarViagemExtraAction } from "@/lib/viagens-extras-actions";
import type { TipoViagemExtra, ViagemExtra } from "@/lib/data/viagens-extras";
import { TZ } from "@/lib/format";

const fHora = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
/** ISO → valor do campo datetime-local (hora de Manaus) */
const paraCampo = (iso?: string) => (iso ? fHora.format(new Date(iso)).replace(" ", "T") : "");

export function ViagemExtraForm({ v, embarcacoes }: { v?: ViagemExtra; embarcacoes: { id: string; nome: string }[] }) {
  const [tipo, setTipo] = useState<TipoViagemExtra>(v?.tipo ?? "EXTRA");
  const [temVolta, setTemVolta] = useState(!!v?.saidaVolta);
  const [status, setStatus] = useState(v?.status ?? "PROGRAMADA");

  return (
    <ActionForm action={salvarViagemExtraAction} submit={v ? "Salvar alterações" : "Cadastrar viagem"} manterValores>
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Tipo" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {([["EXTRA", "Viagem extra (nós fazemos o trajeto)"], ["FRETAMENTO", "Fretamento (lancha contratada)"]] as const).map(([t, l]) => (
              <label key={t} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold ${tipo === t ? "border-rio-600 bg-rio-50 text-rio-800" : "border-slate-200 text-slate-600"}`}>
                <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </Campo>

        <Campo label="Origem"><input name="origem" required defaultValue={v?.origem ?? "Santarém"} className="input" /></Campo>
        <Campo label="Destino"><input name="destino" required defaultValue={v?.destino} className="input" placeholder="Ex.: Alter do Chão" /></Campo>
        <Campo label="Embarcação" className="sm:col-span-2">
          <select name="embarcacaoId" required defaultValue={v?.embarcacaoId} className="input">
            {embarcacoes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </Campo>

        <Campo label="Saída da ida (Manaus)"><input name="ida" type="datetime-local" required defaultValue={paraCampo(v?.saidaIda)} className="input" /></Campo>
        <div>
          <label className="label">Volta</label>
          <input type="hidden" name="temVolta" value={temVolta ? "on" : ""} />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={temVolta} onChange={(e) => setTemVolta(e.target.checked)} className="h-4 w-4 accent-rio-700" /> Tem viagem de volta
          </label>
          {temVolta && <input name="volta" type="datetime-local" required defaultValue={paraCampo(v?.saidaVolta)} className="input mt-2" aria-label="Saída da volta" />}
        </div>

        {tipo === "FRETAMENTO" && (
          <>
            <Campo label="Cliente"><input name="clienteNome" required defaultValue={v?.clienteNome} className="input" /></Campo>
            <Campo label="Contato do cliente"><input name="clienteContato" defaultValue={v?.clienteContato} className="input" placeholder="Telefone ou e-mail" /></Campo>
          </>
        )}

        <Campo label={tipo === "FRETAMENTO" ? "Valor do fretamento (R$)" : "Receita da viagem (R$)"} dica={tipo === "EXTRA" ? "Total arrecadado com as passagens desta viagem." : undefined}>
          <input name="valorTotal" inputMode="decimal" defaultValue={v?.valorTotal ?? 0} className="input" />
        </Campo>
        <Campo label={tipo === "FRETAMENTO" ? "Já recebido / sinal (R$)" : "Já recebido (R$)"}>
          <input name="valorRecebido" inputMode="decimal" defaultValue={v?.valorRecebido ?? 0} className="input" />
        </Campo>
        <Campo label="Passageiros (opcional)"><input name="passageiros" type="number" min={0} defaultValue={v?.passageiros} className="input" /></Campo>
        <Campo label="Observação" className="sm:col-span-2"><input name="observacao" defaultValue={v?.observacao} className="input" /></Campo>

        {v && (
          <>
            <Campo label="Situação">
              <select name="status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input">
                <option value="PROGRAMADA">Programada</option>
                <option value="EM_CURSO">Em curso</option>
                <option value="CONCLUIDA">Concluída</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </Campo>
            {status === "CANCELADA" && <Campo label="Motivo do cancelamento"><input name="motivo" required defaultValue={v.motivoCancelamento} className="input" /></Campo>}
          </>
        )}
      </div>
      <div className="mt-4"><Checkbox name="ignorarConflito" label="Salvar mesmo assim, se a embarcação já estiver em outra viagem" /></div>
    </ActionForm>
  );
}
