"use client";

import { Printer } from "lucide-react";
import { registrarImpressaoAction } from "@/lib/admin-actions";

/** Imprime e conta a via: a partir da segunda impressão o bilhete sai marcado "2ª VIA" */
export function PrintBilheteButton({ codigo, label = "Imprimir" }: { codigo: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        // Imprime o que está na tela e só depois conta a via: esta impressão sai com a marcação atual e a próxima já vem como "2ª VIA"
        window.print();
        void registrarImpressaoAction(codigo);
      }}
      className="btn-ghost no-print"
    >
      <Printer size={16} /> {label}
    </button>
  );
}
