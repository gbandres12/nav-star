"use client";

import { useActionState, useState } from "react";
import { Check, Copy, MessageCircle, Loader2, Sparkles, Send, ShieldCheck } from "lucide-react";
import { Campo, Checkbox } from "./action-form";
import { salvarUsuarioAction } from "@/lib/admin-actions";
import type { Usuario } from "@/lib/types";

export const PERMISSOES: Record<string, string> = {
  ADMIN: "Acesso total, incluindo usuários, finanças e configurações",
  GERENTE: "Operação de frota, escalas, cadastros e relatórios",
  VENDEDOR: "Venda rápida no balcão, caixa diário e encomendas",
  CONFERENTE: "Leitura de bilhetes no cais (QR), viagens e manifesto",
};

export function UsuarioForm({
  u,
  agencias,
  linhas,
}: {
  u?: Usuario;
  agencias: { id: string; nome: string }[];
  linhas: { id: string; nome: string }[];
}) {
  const [state, formAction, pending] = useActionState(salvarUsuarioAction, undefined);
  const [copiado, setCopiado] = useState(false);
  const [telefone, setTelefone] = useState(u?.telefone || "");

  const handleCopiarLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const getWhatsAppLink = (link: string, nome?: string) => {
    const limpo = telefone.replace(/\D/g, "");
    const ddi = limpo.length <= 11 ? `55${limpo}` : limpo;
    const msg = encodeURIComponent(
      `Olá, ${nome || "colaborador"}! Aqui está seu acesso operacional ao sistema São Tomé Expresso:\n\n${link}\n\nClique no link acima para definir sua senha e começar.`
    );
    return limpo ? `https://wa.me/${ddi}?text=${msg}` : `https://wa.me/?text=${msg}`;
  };

  return (
    <div className="space-y-6">
      {/* Box de Sucesso com Link de Ativação / WhatsApp */}
      {state?.linkAtivacao && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <span>Operador cadastrado com sucesso!</span>
          </div>
          <p className="mt-1 text-sm text-emerald-700">
            O operador <strong>{state.usuarioNome || u?.nome}</strong> já foi criado. Para que ele
            possa definir a senha e iniciar o onboarding, envie o link de ativação abaixo:
          </p>

          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              readOnly
              value={state.linkAtivacao}
              className="input flex-1 bg-white font-mono text-xs text-slate-700 select-all"
            />
            <button
              type="button"
              onClick={() => handleCopiarLink(state.linkAtivacao!)}
              className="btn-secondary flex items-center justify-center gap-1.5 whitespace-nowrap text-sm"
            >
              {copiado ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              {copiado ? "Copiado!" : "Copiar Link"}
            </button>
            <a
              href={getWhatsAppLink(state.linkAtivacao, state.usuarioNome)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
            >
              <MessageCircle size={16} />
              Enviar via WhatsApp
            </a>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-800">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Este link é único e seguro. Ao clicar, o operador definirá sua senha e verá a trilha de onboarding específica para sua função.</span>
          </div>
        </div>
      )}

      {state?.erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          ⚠️ {state.erro}
        </div>
      )}

      {state?.ok && !state.linkAtivacao && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          ✓ {state.ok}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {u && <input type="hidden" name="id" value={u.id} />}
        
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome Completo">
            <input
              name="nome"
              required
              defaultValue={u?.nome}
              placeholder="Ex: João da Silva"
              className="input"
            />
          </Campo>

          <Campo
            label="E-mail Funcional"
            dica={u ? "E-mail de login cadastrado" : "Usado para acesso e disparo de notificações"}
          >
            <input
              name="email"
              type="email"
              required
              defaultValue={u?.email}
              readOnly={!!u}
              placeholder="operador@saotome.com.br"
              className={`input ${u ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""}`}
            />
          </Campo>

          <Campo
            label="WhatsApp / Telefone Funcional"
            dica="Utilizado para envio do convite e alertas operacionais urgentes"
          >
            <input
              name="telefone"
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(92) 99123-4567"
              className="input"
            />
          </Campo>

          <Campo label="Perfil de Acesso">
            <select name="papel" defaultValue={u?.papel ?? "VENDEDOR"} className="input">
              {Object.entries(PERMISSOES).map(([k, d]) => (
                <option key={k} value={k}>
                  {k === "ADMIN"
                    ? "Administrador"
                    : k === "GERENTE"
                    ? "Gerente"
                    : k === "VENDEDOR"
                    ? "Vendedor (Balcão/Agência)"
                    : "Conferente (Cais/Embarque)"}{" "}
                  — {d}
                </option>
              ))}
            </select>
          </Campo>

          <Campo
            label="Agência Vinculada"
            dica="Vendedor de agência opera no canal Agência, com comissão automática"
          >
            <select name="agenciaId" defaultValue={u?.agenciaId ?? ""} className="input">
              <option value="">Nenhuma (Matriz / Operação direta)</option>
              {agencias.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <fieldset className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
          <legend className="label px-2 text-slate-700 font-semibold">Linhas em que pode vender</legend>
          <p className="mb-3 text-xs text-slate-500">
            Deixe desmarcado para autorizar todas as linhas fluviais da empresa.
          </p>
          <div className="flex flex-wrap gap-4">
            {linhas.map((l) => (
              <Checkbox
                key={l.id}
                name="linha"
                value={l.id}
                label={l.nome}
                defaultChecked={u?.linhasPermitidas.includes(l.id)}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <Checkbox name="ativo" label="Usuário ativo para operar" defaultChecked={u?.ativo ?? true} />

          <button type="submit" disabled={pending} className="btn-primary flex items-center gap-2">
            {pending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : u ? (
              "Salvar Alterações"
            ) : (
              <>
                <Send size={16} />
                Cadastrar e Gerar Convite
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
