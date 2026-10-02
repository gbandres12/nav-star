"use client";

import { useEffect } from "react";

export default function ErroPortalAgencia({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[portal-agencia]", error.digest, error.message);
  }, [error]);

  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-bold text-slate-900">Algo deu errado</h1>
      <p className="mt-2 text-sm text-slate-500">Não foi possível carregar esta tela. Tente de novo; se persistir, fale com a empresa.</p>
      <button onClick={reset} className="btn-primary mt-5">Tentar de novo</button>
    </div>
  );
}
