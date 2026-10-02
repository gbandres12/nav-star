"use client";

import { useEffect, useState } from "react";
import { lotacaoPortalAction } from "@/lib/agencia/portal";
import type { Trecho } from "@/lib/agencia/dados";

const INTERVALO_MS = 15_000;

/** Lotação ao vivo: parte do que o servidor já mandou e atualiza sozinha a cada ~15 s (pausa com a aba escondida) */
export function useLotacaoAoVivo(ids: string[], inicial: Record<string, Trecho[]>) {
  const [lotacao, setLotacao] = useState(inicial);
  const chave = ids.join(",");

  useEffect(() => {
    let vivo = true;
    const atualizar = async () => {
      if (document.hidden) return;
      try {
        const r = await lotacaoPortalAction(chave.split(","));
        if (vivo && r) setLotacao((atual) => ({ ...atual, ...r }));
      } catch {
        /* sem rede agora: mantém o último valor e tenta de novo no próximo ciclo */
      }
    };
    const timer = setInterval(atualizar, INTERVALO_MS);
    const aoVoltar = () => {
      if (!document.hidden) atualizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [chave]);

  return lotacao;
}
