"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { solicitarRecuperacaoAction } from "@/app/primeiro-acesso/actions";

export function RecuperarForm() {
  const [state, formAction, isPending] = useActionState(
    solicitarRecuperacaoAction,
    null
  );

  return (
    <form action={formAction} className="space-y-5">
      {state?.erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          ⚠️ {state.erro}
        </div>
      )}

      {state?.ok && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 space-y-2">
          <div className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 size={16} className="text-emerald-600" />
            E-mail enviado!
          </div>
          <p className="text-xs text-emerald-700">{state.ok}</p>
        </div>
      )}

      <div>
        <label className="label mb-1.5 block font-semibold text-slate-700">
          E-mail funcional cadastrado
        </label>
        <div className="relative">
          <Mail className="absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="operador@saotome.com.br"
            className="input pl-11 text-base"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn btn-primary w-full py-3.5 text-base font-bold shadow-md hover:shadow-lg disabled:opacity-50"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            Enviando instruções...
          </span>
        ) : (
          "Enviar Link de Recuperação"
        )}
      </button>

      <div className="text-center pt-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-semibold text-rio-700 hover:text-rio-900"
        >
          <ArrowLeft size={16} /> Voltar para o Login
        </Link>
      </div>
    </form>
  );
}
