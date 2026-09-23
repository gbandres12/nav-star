"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "./actions";
import { Lock, Mail, KeyRound, MessageCircle } from "lucide-react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/admin";
  const urlErro = searchParams.get("erro");

  const [state, formAction, isPending] = useActionState(loginAction, null);

  const mensagemParamErro =
    urlErro === "link_invalido"
      ? "O link de acesso utilizado é inválido ou já expirou. Solicite um novo link abaixo."
      : urlErro === "link_expirado"
      ? "Seu link de acesso expirou. Solicite uma nova recuperação de senha."
      : null;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {mensagemParamErro && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
          ⚠️ {mensagemParamErro}
        </div>
      )}

      {state?.erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {state.erro}
        </div>
      )}

      <div>
        <label className="label mb-1.5 block font-semibold text-slate-700">
          E-mail funcional
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

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="label block font-semibold text-slate-700">
            Senha
          </label>
          <Link
            href="/recuperar-senha"
            className="text-xs font-semibold text-rio-700 hover:text-rio-900 transition hover:underline"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="input pl-11 text-base"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn btn-primary w-full py-3.5 text-base font-bold shadow-md hover:shadow-lg disabled:opacity-50"
      >
        {isPending ? "Acessando..." : "Entrar no sistema"}
      </button>

      <div className="border-t border-slate-100 pt-3 text-center space-y-2">
        <Link
          href="/primeiro-acesso"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rio-700 hover:text-rio-900 transition"
        >
          <KeyRound size={14} className="text-rio-600" />
          Primeiro acesso? Ative sua conta aqui
        </Link>

        <p className="text-center text-xs text-slate-400 pt-1">
          Acesso restrito a colaboradores e agentes autorizados da São Tomé Expresso.
        </p>
      </div>

      <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-center">
        <p className="text-[11px] text-slate-500 mb-1">Dúvidas ou problemas de acesso no porto?</p>
        <a
          href="https://wa.me/5592991274661?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20acesso%20ao%20painel%20da%20S%C3%A3o%20Tom%C3%A9%20Expresso."
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
        >
          <MessageCircle size={14} />
          Falar com a Central de Operações via WhatsApp
        </a>
      </div>
    </form>
  );
}
