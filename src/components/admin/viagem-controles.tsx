import { ActionForm, Campo } from "./action-form";
import { alternarVendasAction, statusViagemAction, trocarEmbarcacaoAction, tripulacaoAction } from "@/lib/admin-actions";
import { label } from "@/lib/format";
import type { Embarcacao, StatusViagem, Tripulante, Viagem } from "@/lib/types";

const ROTULO_ACAO: Partial<Record<StatusViagem, string>> = {
  EMBARQUE: "Abrir embarque",
  EM_CURSO: "Registrar saída",
  CONCLUIDA: "Concluir viagem",
  PROGRAMADA: "Voltar para programada",
};

/** Painel de gestão da viagem (só gerente/admin) */
export function ViagemControles({ v, proximos, tripulantes, embarcacoes }: { v: Viagem; proximos: StatusViagem[]; tripulantes: Tripulante[]; embarcacoes: Embarcacao[] }) {
  const encerrada = v.status === "CONCLUIDA" || v.status === "CANCELADA";
  const funcoes = [...new Set(tripulantes.map((t) => t.funcao))];
  return (
    <div className="no-print mt-6 grid gap-6 xl:grid-cols-3">
      <div className="card p-5">
        <h2 className="mb-1 font-bold">Status da viagem</h2>
        <p className="mb-4 text-sm text-slate-500">
          {encerrada ? `Viagem ${label(v.status).toLowerCase()}.` : "Ao concluir, quem não embarcou vira “não compareceu” e as encomendas ficam disponíveis para retirada."}
          {v.motivoCancelamento && <> Motivo: {v.motivoCancelamento}</>}
        </p>
        <div className="flex flex-wrap gap-2">
          {proximos.filter((s) => s !== "CANCELADA").map((s) => (
            <ActionForm key={s} action={statusViagemAction} submit={ROTULO_ACAO[s] ?? label(s)} botaoClassName={s === "PROGRAMADA" ? "btn-ghost" : "btn-primary"} className="[&>div]:mt-0" confirmar={s === "CONCLUIDA" ? "Concluir a viagem? Passagens não embarcadas serão marcadas como não compareceu." : undefined}>
              <input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="status" value={s} />
            </ActionForm>
          ))}
        </div>
        {!encerrada && (
          <form action={alternarVendasAction} className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
            <input type="hidden" name="id" value={v.id} />
            <span>Vendas <strong className={v.vendasAbertas ? "text-emerald-700" : "text-red-700"}>{v.vendasAbertas ? "abertas" : "fechadas"}</strong></span>
            <button className="btn-ghost py-1.5">{v.vendasAbertas ? "Fechar vendas" : "Reabrir vendas"}</button>
          </form>
        )}
        {proximos.includes("CANCELADA") && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-red-700">Cancelar viagem…</summary>
            <ActionForm action={statusViagemAction} submit="Cancelar viagem" botaoClassName="btn bg-red-600 text-white hover:bg-red-700" confirmar="Cancelar esta viagem? As vendas serão fechadas e os passageiros precisam ser remanejados ou reembolsados." className="mt-3">
              <input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="status" value="CANCELADA" />
              <Campo label="Motivo"><input name="motivo" required minLength={3} className="input" placeholder="Ex.: condição do rio, pane mecânica" /></Campo>
            </ActionForm>
          </details>
        )}
      </div>

      <div className="card p-5 xl:col-span-2">
        <h2 className="mb-1 font-bold">Tripulação</h2>
        <p className="mb-4 text-sm text-slate-500">Sai impressa no manifesto. O comandante marcado aparece no cabeçalho da viagem.</p>
        <ActionForm action={tripulacaoAction} submit="Salvar tripulação" botaoClassName="btn-ghost">
          <input type="hidden" name="id" value={v.id} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {funcoes.map((f) => (
              <fieldset key={f}>
                <legend className="label">{label(f)}</legend>
                <div className="space-y-1.5">
                  {tripulantes.filter((t) => t.funcao === f).map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="tripulante" value={t.id} defaultChecked={v.tripulacao.includes(t.id)} className="h-4 w-4 accent-rio-700" />
                      {t.nome}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <Campo label="Observação da viagem" className="mt-4">
            <input name="observacao" defaultValue={v.observacao} className="input" placeholder="Ex.: parada técnica em Itacoatiara" />
          </Campo>
        </ActionForm>
        {!encerrada && embarcacoes.length > 1 && (
          <details className="mt-5 border-t border-slate-200 pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-rio-700">Trocar embarcação…</summary>
            <ActionForm action={trocarEmbarcacaoAction} submit="Trocar" botaoClassName="btn-ghost" className="mt-3 max-w-md" confirmar="Trocar a embarcação desta viagem? Cada passageiro fica na poltrona de mesmo número.">
              <input type="hidden" name="id" value={v.id} />
              <Campo label="Nova embarcação" dica="Cada passageiro mantém a poltrona de mesmo código; se alguma não existir na nova, a troca é recusada.">
                <select name="embarcacaoId" className="input" defaultValue={v.embarcacaoId}>
                  {embarcacoes.map((e) => <option key={e.id} value={e.id} disabled={e.status !== "ATIVA"}>{e.nome}{e.status !== "ATIVA" ? ` (${label(e.status).toLowerCase()})` : ""}</option>)}
                </select>
              </Campo>
            </ActionForm>
          </details>
        )}
      </div>
    </div>
  );
}
