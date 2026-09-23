"use client";

import { useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { avancarStatusEncomenda } from "@/lib/actions";

export function AvancarButton({ codigo, proximo }: { codigo: string; proximo: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn-primary" disabled={pending} onClick={() => start(() => avancarStatusEncomenda(codigo))}>
      {pending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Marcar como “{proximo}”
    </button>
  );
}
