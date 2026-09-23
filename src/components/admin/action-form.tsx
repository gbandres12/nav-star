"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import type { Estado } from "@/lib/admin-actions";

type Props = {
  action: (prev: Estado, form: FormData) => Promise<Estado>;
  children: ReactNode;
  submit?: ReactNode;
  className?: string;
  confirmar?: string; // pergunta de confirmação antes de enviar
  limparAoSalvar?: boolean;
  botaoClassName?: string;
};

/** Formulário ligado a uma server action, com mensagem de erro/sucesso e botão com carregamento */
export function ActionForm({ action, children, submit = "Salvar", className = "", confirmar, limparAoSalvar, botaoClassName = "btn-primary" }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && limparAoSalvar) ref.current?.reset();
  }, [state, limparAoSalvar]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={botaoClassName} disabled={pending}>
          {pending && <Loader2 size={16} className="animate-spin" />}
          {submit}
        </button>
        <Mensagem state={state} />
      </div>
    </form>
  );
}

export function Mensagem({ state }: { state: Estado }) {
  if (state?.erro)
    return (
      <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-700">
        <TriangleAlert size={15} /> {state.erro}
      </p>
    );
  if (state?.ok)
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
        <CircleCheck size={15} /> {state.ok}
      </p>
    );
  return null;
}

/** Campo com rótulo — atalho para os formulários do painel */
export function Campo({ label, children, dica, className = "" }: { label: string; children: ReactNode; dica?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}
    </div>
  );
}

export function Checkbox({ name, label, defaultChecked, value }: { name: string; label: ReactNode; defaultChecked?: boolean; value?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-slate-300 accent-rio-700" />
      {label}
    </label>
  );
}
