"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { ActionForm, Campo } from "@/components/admin/action-form";
import { Badge } from "@/components/ui";
import { marcarRepasseAction, transferirBilheteAction } from "@/lib/agencias-parceiras-actions";
import type { BilheteInterno } from "@/lib/data/agencias-parceiras";
import { dateTime, money } from "@/lib/format";

function FormTransferir({ bilheteId, atual }: { bilheteId: string; atual: string }) {
  return (
    <ActionForm action={transferirBilheteAction} submit="Transferir bilhete" manterValores confirmar="Trocar o titular deste bilhete? O QR continua o mesmo.">
      <input type="hidden" name="bilheteId" value={bilheteId} />
      <p className="mb-3 text-sm text-slate-500">Titular atual: <b>{atual}</b>. Informe o novo passageiro.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="Nome completo"><input name="nome" required minLength={2} className="input" /></Campo>
        <Campo label="Documento"><input name="documento" required minLength={3} className="input" /></Campo>
        <Campo label="Nascimento"><input name="nascimento" type="date" required min="1900-01-01" className="input" /></Campo>
        <Campo label="Telefone"><input name="telefone" type="tel" className="input" /></Campo>
        <Campo label="E-mail" dica="Telefone ou e-mail"><input name="email" type="email" className="input" /></Campo>
        <Campo label="Endereço (opcional)"><input name="endereco" className="input" /></Campo>
        <Campo label="Motivo (opcional)" className="lg:col-span-2"><input name="motivo" className="input" placeholder="Ex.: passageiro vendeu a passagem" /></Campo>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input type="checkbox" name="marketing" className="h-4 w-4 accent-rio-700" /> Aceita receber ofertas
        </label>
      </div>
    </ActionForm>
  );
}

/** Lista de bilhetes com seleção para dar (ou desfazer) a baixa do repasse; no modo "receber" também transfere o titular */
export function RepassesAgencia({ bilhetes, modo }: { bilhetes: BilheteInterno[]; modo: "receber" | "baixados" }) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [abertoId, setAbertoId] = useState<string>();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>();

  const receber = modo === "receber";
  const total = bilhetes.filter((b) => marcados.has(b.id)).reduce((s, b) => s + b.valorRepasse, 0);
  const alternar = (id: string) => setMarcados((m) => {
    const n = new Set(m);
    if (!n.delete(id)) n.add(id);
    return n;
  });

  if (!bilhetes.length) return <p className="px-5 pb-5 text-sm text-slate-500">{receber ? "Nada a receber desta agência." : "Nenhuma baixa registrada."}</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
        <button type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => setMarcados(marcados.size === bilhetes.length ? new Set() : new Set(bilhetes.map((b) => b.id)))}>
          {marcados.size === bilhetes.length ? "Limpar seleção" : "Selecionar todos"}
        </button>
        <button
          type="button"
          className="btn-primary !px-3 !py-1.5 text-sm"
          disabled={!marcados.size || pendente}
          onClick={() => {
            const pergunta = receber ? `Dar baixa em ${marcados.size} bilhete(s), no total de ${money(total)}? Confirme que o dinheiro já foi recebido.` : `Desfazer a baixa de ${marcados.size} bilhete(s)?`;
            if (!window.confirm(pergunta)) return;
            iniciar(async () => {
              const r = await marcarRepasseAction([...marcados], receber);
              setMsg(r);
              if (r?.ok) setMarcados(new Set());
            });
          }}
        >
          {pendente && <Loader2 size={14} className="animate-spin" />}
          {receber ? `Dar baixa${marcados.size ? ` (${money(total)})` : ""}` : "Desfazer baixa"}
        </button>
        {msg?.erro && <span role="alert" className="text-sm font-medium text-red-700">{msg.erro}</span>}
        {msg?.ok && <span role="status" className="text-sm font-medium text-emerald-700">{msg.ok}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th /><th>Bilhete</th><th>Passageiro</th><th>Viagem</th><th>Embarque</th><th className="text-right">Cobrado</th><th className="text-right">Repasse</th><th>Status</th>{receber && <th />}</tr>
          </thead>
          <tbody>
            {bilhetes.map((b) => (
              <Fragment key={b.id}>
                <tr>
                  <td><input type="checkbox" checked={marcados.has(b.id)} onChange={() => alternar(b.id)} className="h-4 w-4 accent-rio-700" aria-label={`Selecionar ${b.numero}`} /></td>
                  <td className="font-mono text-xs">{b.pedidoCodigo ? <Link href={`/admin/pedidos/${b.pedidoCodigo}`} className="text-rio-700 hover:underline">{b.numero}</Link> : b.numero}</td>
                  <td className="whitespace-nowrap font-medium">{b.passageiro}</td>
                  <td className="whitespace-nowrap">{b.origem} → {b.destino}</td>
                  <td className="whitespace-nowrap tabular-nums">{dateTime(b.embarque)}</td>
                  <td className="text-right tabular-nums">{money(b.valorCobrado)}</td>
                  <td className="text-right font-semibold tabular-nums">{money(b.valorRepasse)}</td>
                  <td><Badge status={b.status} /></td>
                  {receber && (
                    <td className="text-right">
                      <button type="button" className="text-sm font-semibold text-rio-700 hover:underline" onClick={() => setAbertoId(abertoId === b.id ? undefined : b.id)}>
                        {abertoId === b.id ? "Fechar" : "Transferir"}
                      </button>
                    </td>
                  )}
                </tr>
                {receber && abertoId === b.id && (
                  <tr><td colSpan={9} className="bg-slate-50 p-4"><FormTransferir bilheteId={b.id} atual={b.passageiro} /></td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
