"use client";

import { useActionState, useEffect, useRef } from "react";
import { CircleCheck, CircleX, Loader2, ScanLine } from "lucide-react";
import { validarBilhete, type EmbarqueState } from "@/lib/actions";

export function EmbarqueForm({ exemplo }: { exemplo?: string }) {
  const [state, action, pending] = useActionState<EmbarqueState, FormData>(validarBilhete, undefined);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.value = "";
      ref.current.focus();
    }
  }, [state]);

  return (
    <div className="mx-auto max-w-xl">
      <form action={action} className="card p-6">
        <label className="label" htmlFor="token">Código do bilhete (QR Code)</label>
        <div className="flex gap-2">
          <input ref={ref} id="token" name="token" autoFocus autoComplete="off" className="input font-mono uppercase" placeholder="QR-XXXXXXXXXXXX" />
          <button className="btn-primary shrink-0" disabled={pending}>
            {pending ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />} Validar
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Use um leitor de QR USB/Bluetooth (funciona como teclado) ou digite o código.
          {exemplo && <> Teste com <code className="rounded bg-slate-100 px-1">{exemplo}</code>.</>}
        </p>
      </form>

      {state && (
        <div className={`mt-4 flex items-start gap-4 rounded-2xl p-6 ${state.ok ? "bg-emerald-500 text-white" : "bg-red-600 text-white"}`}>
          {state.ok ? <CircleCheck size={40} className="shrink-0" /> : <CircleX size={40} className="shrink-0" />}
          <div>
            <p className="text-2xl font-extrabold">{state.mensagem}</p>
            {state.passageiro && (
              <p className="mt-1 text-lg">
                {state.passageiro} · Poltrona <b>{state.assento}</b>
              </p>
            )}
            {state.viagem && <p className="text-sm opacity-80">Viagem {state.viagem}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
