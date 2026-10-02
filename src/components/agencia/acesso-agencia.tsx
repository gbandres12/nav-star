"use client";

import { useState } from "react";
import { ActionForm, Campo } from "@/components/admin/action-form";
import { cadastrarAgenciaAction, entrarAgenciaAction } from "@/lib/agencia/acoes";

export function AcessoAgencia({ empresaId }: { empresaId: string }) {
  const [aba, setAba] = useState<"entrar" | "cadastrar">("entrar");
  return (
    <div className="card border border-slate-200/80 bg-white p-6 shadow-xl sm:p-8">
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {(["entrar", "cadastrar"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={`rounded-lg py-2 transition ${aba === a ? "bg-white text-rio-900 shadow-sm" : "text-slate-500"}`}
          >
            {a === "entrar" ? "Entrar" : "Cadastrar agência"}
          </button>
        ))}
      </div>

      {aba === "entrar" ? (
        <ActionForm action={entrarAgenciaAction} submit="Entrar" manterValores className="space-y-3">
          <input type="hidden" name="empresaId" value={empresaId} />
          <Campo label="E-mail"><input name="email" type="email" required autoComplete="username" className="input" /></Campo>
          <Campo label="Senha"><input name="senha" type="password" required autoComplete="current-password" className="input" /></Campo>
        </ActionForm>
      ) : (
        <ActionForm action={cadastrarAgenciaAction} submit="Enviar cadastro" limparAoSalvar manterValores className="space-y-3">
          <input type="hidden" name="empresaId" value={empresaId} />
          <Campo label="Nome da agência"><input name="nome" required className="input" /></Campo>
          <Campo label="CNPJ ou CPF (opcional)"><input name="documento" inputMode="numeric" className="input" /></Campo>
          <Campo label="Responsável"><input name="responsavel" required className="input" /></Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="E-mail"><input name="email" type="email" required autoComplete="email" className="input" /></Campo>
            <Campo label="Telefone (com DDD)"><input name="telefone" type="tel" required autoComplete="tel" className="input" /></Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Senha" dica="Mínimo de 8 caracteres"><input name="senha" type="password" required minLength={8} autoComplete="new-password" className="input" /></Campo>
            <Campo label="Repita a senha"><input name="confirmar" type="password" required minLength={8} autoComplete="new-password" className="input" /></Campo>
          </div>
          <p className="text-xs text-slate-500">Depois do envio, a empresa analisa o cadastro. Você só poderá vender após a aprovação.</p>
        </ActionForm>
      )}
    </div>
  );
}
