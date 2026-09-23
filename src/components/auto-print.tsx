"use client";

import { useEffect } from "react";
import { registrarImpressaoAction } from "@/lib/admin-actions";

/** Abre a caixa de impressão assim que a página carrega (usado após venda no balcão e no fechamento de caixa) */
export function AutoPrint({ codigoPedido }: { codigoPedido?: string }) {
  useEffect(() => {
    // Registra a via antes de abrir o diálogo: o window.print() trava a página até a pessoa fechar
    const t = setTimeout(() => {
      (codigoPedido ? registrarImpressaoAction(codigoPedido) : Promise.resolve()).finally(() => window.print());
    }, 400); // espera logo/QR renderizarem
    return () => clearTimeout(t);
  }, [codigoPedido]);
  return null;
}
