"use client";

import { useActionState, useEffect, useState } from "react";
import { Lock, Phone, CheckCircle2, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { definirSenhaPrimeiroAcessoAction } from "./actions";
import { createClient } from "@/lib/supabase/client";

export function PrimeiroAcessoForm() {
  const [state, formAction, isPending] = useActionState(
    definirSenhaPrimeiroAcessoAction,
    null
  );

  const [verificando, setVerificando] = useState(true);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [telefone, setTelefone] = useState("");

  useEffect(() => {
    const supabase = createClient();

    // 1. Verifica se há hash com tokens (convite direto)
    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data }) => {
            if (data?.user?.email) {
              setUsuarioEmail(data.user.email);
            }
            setVerificando(false);
          })
          .catch(() => setVerificando(false));
        return;
      }
    }

    // 2. Se não houver hash, checa se a sessão já está ativa
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setUsuarioEmail(data.user.email);
      }
      setVerificando(false);
    });
  }, []);

  if (verificando) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-rio-700 mb-3" />
        <p className="text-sm font-medium">Validando seu link de acesso seguro...</p>
      </div>
    );
  }

  // Sem sessão não dá para gravar a senha: orienta a pedir um link novo em vez de deixar preencher à toa
  if (!usuarioEmail) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Para criar sua senha, abra o <strong>link de acesso</strong> que você recebeu por WhatsApp ou e-mail. O link vale por
          tempo limitado e só pode ser usado uma vez.
        </div>
        <a href="/recuperar-senha" className="btn-primary w-full py-3">Receber um novo link por e-mail</a>
        <p className="text-xs text-slate-500">Se o administrador cadastrou você, ele também pode gerar um novo link em Usuários.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state?.erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          ⚠️ {state.erro}
        </div>
      )}

      {usuarioEmail && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600">
          Ativando conta operacional para: <strong>{usuarioEmail}</strong>
        </div>
      )}

      <div>
        <label className="label mb-1.5 block font-semibold text-slate-700">
          Criar Nova Senha Pessoal
        </label>
        <div className="relative">
          <Lock className="absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type={mostrarSenha ? "text" : "password"}
            name="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="No mínimo 6 caracteres"
            className="input pl-11 pr-11 text-base"
          />
          <button
            type="button"
            onClick={() => setMostrarSenha(!mostrarSenha)}
            className="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div>
        <label className="label mb-1.5 block font-semibold text-slate-700">
          Confirmar Senha
        </label>
        <div className="relative">
          <KeyRound className="absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type={mostrarSenha ? "text" : "password"}
            name="confirmPassword"
            required
            value={confirmaSenha}
            onChange={(e) => setConfirmaSenha(e.target.value)}
            placeholder="Repita a senha criada"
            className="input pl-11 text-base"
          />
        </div>
        {confirmaSenha && senha !== confirmaSenha && (
          <p className="mt-1 text-xs text-red-600">As senhas não coincidem.</p>
        )}
      </div>

      <div>
        <label className="label mb-1.5 block font-semibold text-slate-700">
          Seu WhatsApp de Trabalho (Opcional)
        </label>
        <div className="relative">
          <Phone className="absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="tel"
            name="telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(92) 99123-4567"
            className="input pl-11 text-base"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Utilizado pela central de operações para suporte e avisos de escala.
        </p>
      </div>

      <div className="rounded-xl border border-rio-100 bg-rio-50/60 p-3.5 text-xs text-rio-900 space-y-1">
        <p className="font-semibold flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-rio-700" /> O que acontece a seguir?
        </p>
        <p className="text-slate-600">
          Ao salvar sua senha, você será direcionado para o painel operacional da São Tomé Expresso com um guia passo a passo da sua função.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending || senha.length < 6 || senha !== confirmaSenha}
        className="btn btn-primary w-full py-3.5 text-base font-bold shadow-md hover:shadow-lg disabled:opacity-50"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            Configurando seu acesso...
          </span>
        ) : (
          "Salvar Senha e Acessar Sistema"
        )}
      </button>
    </form>
  );
}
