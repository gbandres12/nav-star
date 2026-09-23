"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Loader2, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { QR } from "./qr";
import { simularPagamento } from "@/lib/actions";

export function PixPayment({ codigo, copiaCola, expiraEm, total }: { codigo: string; copiaCola: string; expiraEm: string; total: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [restante, setRestante] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.floor((new Date(expiraEm).getTime() - Date.now()) / 1000));
      setRestante(s);
      if (s === 0) router.refresh();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiraEm, router]);

  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <p className="text-sm font-semibold text-slate-500">Pague com PIX</p>
      <p className="mt-1 text-3xl font-extrabold text-rio-900">{total}</p>
      <div className="mx-auto mt-5 w-fit rounded-2xl border border-slate-200 p-3">
        <QR value={copiaCola} size={200} />
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-amber-700">
        <Timer size={16} />
        {restante === null ? "…" : `Poltronas reservadas por ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, "0")}`}
      </p>
      <button
        type="button"
        className="btn-ghost mt-4 w-full"
        onClick={() => {
          navigator.clipboard.writeText(copiaCola);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copiado!" : "Copiar código PIX (copia e cola)"}
      </button>
      <ol className="mt-5 space-y-1 text-left text-sm text-slate-600">
        <li>1. Abra o app do seu banco e escolha PIX</li>
        <li>2. Escaneie o QR Code ou cole o código</li>
        <li>3. Confirme — os bilhetes aparecem aqui automaticamente</li>
      </ol>
      <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3">
        <p className="mb-2 text-xs text-amber-800">Ambiente de demonstração — ainda sem gateway de pagamento.</p>
        <button type="button" disabled={pending} onClick={() => start(() => simularPagamento(codigo))} className="btn-primary w-full">
          {pending && <Loader2 size={16} className="animate-spin" />} Simular pagamento aprovado
        </button>
      </div>
    </div>
  );
}
