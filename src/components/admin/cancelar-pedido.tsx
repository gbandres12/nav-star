"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import { ActionForm, Campo } from "./action-form";
import { cancelarAction } from "@/lib/admin-actions";

type Pax = { id: string; nome: string; assento: string; valor: string };

/** Painel de cancelamento do pedido inteiro: mostra as passagens, pede o motivo e explica a regra de multa */
export function CancelarPedido({ codigo, passagens, regra }: { codigo: string; passagens: Pax[]; regra: string }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} className="btn border border-red-200 bg-white text-red-700 hover:bg-red-50">
        <XCircle size={16} /> Cancelar pedido
      </button>
    );
  return (
    <div className="card w-full border-red-200 p-5">
      <h2 className="font-bold text-red-800">Cancelar pedido</h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">{regra}</p>
      <ActionForm action={cancelarAction} submit="Confirmar cancelamento" botaoClassName="btn bg-red-600 text-white hover:bg-red-700" confirmar="Confirma o cancelamento? As poltronas voltam a ficar livres.">
        <input type="hidden" name="codigo" value={codigo} />
        <ul className="space-y-2">
          {passagens.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="flex-1 font-medium">{p.nome}</span>
              <span className="text-slate-500">{p.assento === "COLO" ? "Colo" : `Poltrona ${p.assento}`}</span>
              <span className="tabular-nums">{p.valor}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">O cancelamento vale para o pedido inteiro. Para tirar só um passageiro, cancele e venda de novo.</p>
        <Campo label="Motivo" className="mt-3">
          <input name="motivo" required minLength={3} className="input" placeholder="Ex.: desistência, mudança de data, problema de saúde" />
        </Campo>
      </ActionForm>
      <button type="button" onClick={() => setAberto(false)} className="mt-3 text-sm text-slate-500 hover:underline">Fechar</button>
    </div>
  );
}
