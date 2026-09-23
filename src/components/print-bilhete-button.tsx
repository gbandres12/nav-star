"use client";

import { Printer } from "lucide-react";
import { registrarImpressaoAction } from "@/lib/admin-actions";

/** Imprime e conta a via: a partir da segunda impressão o bilhete sai marcado "2ª VIA" */
export function PrintBilheteButton({ codigo, label = "Imprimir" }: { codigo: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => registrarImpressaoAction(codigo).finally(() => window.print())}
      className="btn-ghost no-print"
    >
      <Printer size={16} /> {label}
    </button>
  );
}
