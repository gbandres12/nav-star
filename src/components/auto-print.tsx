"use client";

import { useEffect } from "react";

/** Abre a caixa de impressão assim que a página carrega (usado após venda no balcão) */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400); // espera logo/QR renderizarem
    return () => clearTimeout(t);
  }, []);
  return null;
}
