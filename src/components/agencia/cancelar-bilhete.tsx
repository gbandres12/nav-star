"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cancelarBilheteAction } from "@/lib/agencia/portal";

export function CancelarBilhete({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string>();
  return (
    <span className="no-print inline-flex flex-wrap items-center gap-2">
      <button
        className="btn-ghost !px-3 !py-1.5 text-sm text-red-700"
        disabled={pendente}
        onClick={() => {
          if (!window.confirm("Cancelar este bilhete? A vaga volta a ficar disponível.")) return;
          iniciar(async () => setErro((await cancelarBilheteAction(id))?.erro));
        }}
      >
        {pendente && <Loader2 size={14} className="animate-spin" />}
        Cancelar
      </button>
      {erro && <span role="alert" className="text-sm font-medium text-red-700">{erro}</span>}
    </span>
  );
}
