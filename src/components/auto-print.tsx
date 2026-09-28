"use client";

import { useEffect } from "react";
import { registrarImpressaoAction } from "@/lib/admin-actions";

/** Abre a caixa de impressão assim que a página carrega (usado após venda no balcão e no fechamento de caixa) */
export function AutoPrint({ codigoPedido }: { codigoPedido?: string }) {
  useEffect(() => {
    // Imprime primeiro (o diálogo trava a página até fechar) e depois conta a via; assim a primeira impressão não sai
    // marcada como 2ª via quando a página se atualiza com a contagem nova
    const t = setTimeout(() => {
      window.print();
      if (codigoPedido) void registrarImpressaoAction(codigoPedido);
    }, 400); // espera logo/QR renderizarem
    return () => clearTimeout(t);
  }, [codigoPedido]);
  return null;
}
