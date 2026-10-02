"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock } from "lucide-react";
import { money } from "@/lib/format";

/** Valor que "rola" até o novo total: o cliente percebe cada passageiro que adiciona */
export function ValorAnimado({ valor }: { valor: number }) {
  const [mostrado, setMostrado] = useState(valor);
  const de = useRef(valor);
  useEffect(() => {
    const ini = de.current;
    if (ini === valor) return;
    const duracao = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 450;
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / duracao);
      const v = ini + (valor - ini) * (1 - Math.pow(1 - k, 3));
      de.current = v;
      setMostrado(v);
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <>{money(mostrado)}</>;
}

export type Passo = { rotulo: string; ok: boolean };

/** Faixa de progresso: mostra o que já está pronto e quanto falta para garantir o lugar */
export function ProgressoCompra({ passos }: { passos: Passo[] }) {
  const feitos = passos.filter((p) => p.ok).length;
  const pct = Math.round((feitos / passos.length) * 100);
  const proximo = passos.find((p) => !p.ok);
  return (
    <div className="card animate-subir p-4 sm:p-5">
      <ol className="grid grid-cols-4 gap-2">
        {passos.map((p, i) => (
          <li key={p.rotulo} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-colors duration-300 ${p.ok ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}
            >
              {p.ok ? <Check key="ok" size={15} strokeWidth={3} className="animate-estalo" /> : i + 1}
            </span>
            <span className={`text-[11px] leading-tight font-semibold sm:text-xs ${p.ok ? "text-emerald-700" : "text-slate-500"}`}>{p.rotulo}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da compra">
        <div className="h-full rounded-full bg-gradient-to-r from-rio-500 to-emerald-500 transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-center text-xs text-slate-600">
        {proximo ? <>Falta pouco: <strong>{proximo.rotulo.toLowerCase()}</strong> para garantir seu lugar.</> : <strong className="text-emerald-700">Tudo pronto! Garanta seu lugar agora.</strong>}
      </p>
    </div>
  );
}

/** Barra de lotação com os números reais da viagem; só avisa "poucos lugares" quando de fato restam poucos */
export function LotacaoViva({ livres, total }: { livres: number; total: number }) {
  if (total <= 0) return null;
  const ocupado = Math.round(((total - livres) / total) * 100);
  const poucos = livres > 0 && livres / total <= 0.25;
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className={`flex items-center gap-1.5 font-semibold ${poucos ? "text-rubro-500" : "text-emerald-700"}`}>
          <span className={`h-2 w-2 rounded-full animate-ponto-vivo ${poucos ? "bg-rubro-400" : "bg-emerald-500"}`} />
          {poucos ? `Restam só ${livres} lugares neste trecho` : `${livres} lugares disponíveis neste trecho`}
        </span>
        <span className="text-slate-500">{ocupado}% reservado</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-[width] duration-700 ${poucos ? "bg-rubro-400" : "bg-emerald-500"}`} style={{ width: `${ocupado}%` }} />
      </div>
    </div>
  );
}

export function SeloReserva({ minutos }: { minutos: number }) {
  return (
    <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
      <Clock size={13} className="shrink-0" /> Ao avançar, seus lugares ficam reservados por {minutos} min para você pagar.
    </p>
  );
}
