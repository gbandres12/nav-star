"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { Mensagem } from "./action-form";
import { confirmarPagamentoAction } from "@/lib/actions";

/** Conferência manual do PIX: só depois de ver o dinheiro na conta */
export function ConfirmarPagamento({ codigo, total, compacto }: { codigo: string; total: string; compacto?: boolean }) {
  const [estado, setEstado] = useState<{ erro?: string; ok?: string }>();
  const [pendente, start] = useTransition();
  const confirmar = () => {
    if (!window.confirm(`Confirma que ${total} do pedido ${codigo} entrou na conta? Os bilhetes serão emitidos.`)) return;
    start(async () => setEstado(await confirmarPagamentoAction(codigo)));
  };
  return (
    <div className={compacto ? "" : "flex flex-wrap items-center gap-3"}>
      <button type="button" onClick={confirmar} disabled={pendente} className={compacto ? "btn-ghost py-1 text-xs text-emerald-700" : "btn bg-emerald-600 text-white hover:bg-emerald-700"}>
        {pendente ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />} Confirmar pagamento
      </button>
      {!compacto && <Mensagem state={estado} />}
      {compacto && estado?.erro && <p role="alert" className="mt-1 text-xs text-red-700">{estado.erro}</p>}
    </div>
  );
}
