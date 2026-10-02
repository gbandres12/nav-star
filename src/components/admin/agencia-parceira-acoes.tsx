"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { decidirAgenciaAction } from "@/lib/agencias-parceiras-actions";
import type { DecisaoAgencia, StatusAgenciaParceira } from "@/lib/data/agencias-parceiras";

const BOTOES: Record<StatusAgenciaParceira, { d: DecisaoAgencia; l: string; cls: string; confirmar?: string }[]> = {
  PENDENTE: [
    { d: "APROVAR", l: "Aprovar", cls: "btn-primary" },
    { d: "RECUSAR", l: "Recusar", cls: "btn-ghost", confirmar: "Recusar este cadastro?" },
  ],
  APROVADA: [{ d: "SUSPENDER", l: "Suspender", cls: "btn-ghost", confirmar: "Suspender a agência? Ela perde o acesso na hora." }],
  SUSPENSA: [{ d: "APROVAR", l: "Reativar", cls: "btn-primary" }],
  RECUSADA: [{ d: "APROVAR", l: "Aprovar mesmo assim", cls: "btn-ghost" }],
};

export function AgenciaParceiraAcoes({ id, status }: { id: string; status: StatusAgenciaParceira }) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {BOTOES[status].map((b) => (
        <button
          key={b.d}
          className={`${b.cls} !px-3 !py-1.5 text-sm`}
          disabled={pendente}
          onClick={() => {
            if (b.confirmar && !window.confirm(b.confirmar)) return;
            iniciar(async () => setMsg(await decidirAgenciaAction(id, b.d)));
          }}
        >
          {pendente && <Loader2 size={14} className="animate-spin" />}
          {b.l}
        </button>
      ))}
      {msg?.erro && <span role="alert" className="text-sm font-medium text-red-700">{msg.erro}</span>}
    </div>
  );
}
