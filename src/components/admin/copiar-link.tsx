"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopiarLink({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="input min-w-0 flex-1 font-mono text-xs" aria-label="Link de cadastro das agências" />
      <button
        type="button"
        className="btn-ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          } catch {
            /* sem permissão da área de transferência: o campo continua selecionável */
          }
        }}
      >
        {copiado ? <Check size={16} /> : <Copy size={16} />}
        {copiado ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}
