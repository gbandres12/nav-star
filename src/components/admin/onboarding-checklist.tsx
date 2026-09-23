"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  X,
  HelpCircle,
  Loader2,
} from "lucide-react";
import type { PapelUsuario } from "@/lib/types";
import { registrarProgressoOnboardingAction } from "@/lib/admin-actions";

type ItemChecklist = {
  id: string;
  titulo: string;
  descricao: string;
  link?: string;
  linkTexto?: string;
};

const CHECKLISTS: Record<PapelUsuario, ItemChecklist[]> = {
  VENDEDOR: [
    {
      id: "senha",
      titulo: "Ativação de conta e senha pessoal",
      descricao: "Sua senha pessoal foi definida com sucesso.",
    },
    {
      id: "caixa",
      titulo: "Abrir o seu Caixa Diário",
      descricao: "Abra a gaveta de valores para iniciar suas operações e vendas do dia.",
      link: "/admin/caixa",
      linkTexto: "Ir para o Caixa",
    },
    {
      id: "venda",
      titulo: "Simular uma venda no balcão",
      descricao: "Experimente emitir uma passagem teste escolhendo poltrona no mapa.",
      link: "/admin",
      linkTexto: "Ver Viagens",
    },
    {
      id: "suporte",
      titulo: "Salvar contato da Central Operacional",
      descricao: "Guarde o WhatsApp da supervisão para dúvidas de rotas e conexões.",
      link: "https://wa.me/5592991274661",
      linkTexto: "Abrir WhatsApp",
    },
  ],
  CONFERENTE: [
    {
      id: "senha",
      titulo: "Ativação de conta e senha pessoal",
      descricao: "Sua senha pessoal foi definida com sucesso.",
    },
    {
      id: "embarque",
      titulo: "Testar o leitor de QR Code de embarque",
      descricao: "Acesse a tela de validação no celular para testar a câmera.",
      link: "/admin/embarque",
      linkTexto: "Abrir Leitor QR",
    },
    {
      id: "viagens",
      titulo: "Acessar o manifesto de viagem",
      descricao: "Visualize a lista de passageiros confirmados para a próxima partida.",
      link: "/admin/viagens",
      linkTexto: "Ver Viagens",
    },
    {
      id: "suporte",
      titulo: "Salvar contato do Comandante de escala",
      descricao: "Comunicação rápida com a tripulação para autorização de partida.",
      link: "https://wa.me/5592991274661",
      linkTexto: "Suporte Operacional",
    },
  ],
  GERENTE: [
    {
      id: "senha",
      titulo: "Ativação de conta e senha pessoal",
      descricao: "Sua senha pessoal foi definida com sucesso.",
    },
    {
      id: "frota",
      titulo: "Conferir programação de viagens e lanchas",
      descricao: "Acompanhe as próximas viagens e a lotação dos trechos.",
      link: "/admin/viagens",
      linkTexto: "Programação de Viagens",
    },
    {
      id: "caixas",
      titulo: "Auditoria de caixas e sangrias",
      descricao: "Monitore os caixas abertos pelas agências e guichês nos portos.",
      link: "/admin/caixa",
      linkTexto: "Painel de Caixas",
    },
    {
      id: "relatorios",
      titulo: "Visualizar relatórios operacionais",
      descricao: "Acompanhe a taxa de ocupação e faturamento diário consolidado.",
      link: "/admin/relatorios",
      linkTexto: "Ver Relatórios",
    },
  ],
  ADMIN: [
    {
      id: "senha",
      titulo: "Ativação de conta e senha pessoal",
      descricao: "Sua senha pessoal foi definida com sucesso.",
    },
    {
      id: "usuarios",
      titulo: "Cadastrar operadores e agências parceiras",
      descricao: "Envie links de ativação com envio rápido via WhatsApp.",
      link: "/admin/usuarios",
      linkTexto: "Gerenciar Usuários",
    },
    {
      id: "linhas",
      titulo: "Configurar linhas, portos e tarifas",
      descricao: "Confira a tabela de preços por trecho e paradas intermediárias.",
      link: "/admin/linhas",
      linkTexto: "Linhas Fluviais",
    },
    {
      id: "financeiro",
      titulo: "Auditar faturamento e convênios",
      descricao: "Controle de vendas por canal (Balcão, Agência e Site).",
      link: "/admin/financeiro",
      linkTexto: "Financeiro",
    },
  ],
};

export function OnboardingChecklist({
  papel,
  passoSalvo = 0,
  concluido = false,
}: {
  papel: PapelUsuario;
  passoSalvo?: number;
  concluido?: boolean;
}) {
  const [visivel, setVisivel] = useState(!concluido);
  const [recolhido, setRecolhido] = useState(false);
  const [passo, setPasso] = useState(passoSalvo || 1);
  const [isPending, startTransition] = useTransition();

  const itens = CHECKLISTS[papel] || CHECKLISTS.VENDEDOR;
  const total = itens.length;
  const concluídosCount = Math.min(passo, total);
  const progressoPct = Math.round((concluídosCount / total) * 100);

  const handleMarcarPasso = (novoPasso: number) => {
    startTransition(async () => {
      const eFim = novoPasso >= total;
      await registrarProgressoOnboardingAction(novoPasso, eFim);
      setPasso(novoPasso);
      if (eFim) {
        setTimeout(() => setVisivel(false), 2000);
      }
    });
  };

  const handleDispensar = () => {
    startTransition(async () => {
      await registrarProgressoOnboardingAction(total, true);
      setVisivel(false);
    });
  };

  if (!visivel) return null;

  return (
    <div className="card overflow-hidden border-2 border-rio-200/80 bg-gradient-to-br from-white via-white to-rio-50/40 p-5 shadow-md">
      {/* Header do checklist */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-rio-100 p-2 text-rio-800">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Primeiros Passos Operacionais
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sol-100 text-sol-900 border border-sol-300">
                {progressoPct}% Concluído
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Complete as etapas iniciais recomendadas para sua função na São Tomé Expresso
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRecolhido(!recolhido)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title={recolhido ? "Expandir checklist" : "Recolher checklist"}
          >
            {recolhido ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          <button
            type="button"
            onClick={handleDispensar}
            disabled={isPending}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="Dispensar e marcar como concluído"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-rio-600 to-emerald-500 transition-all duration-500"
          style={{ width: `${progressoPct}%` }}
        />
      </div>

      {/* Lista de itens (quando expandido) */}
      {!recolhido && (
        <div className="mt-4 space-y-2.5 divide-y divide-slate-100 pt-1">
          {itens.map((item, idx) => {
            const itemConcluido = idx < passo;

            return (
              <div
                key={item.id}
                className={`pt-2.5 flex items-start justify-between gap-3 text-sm ${
                  itemConcluido ? "opacity-75" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleMarcarPasso(itemConcluido ? idx : idx + 1)}
                    className="mt-0.5 text-slate-400 hover:text-rio-700 transition"
                    title={itemConcluido ? "Desmarcar" : "Marcar como feito"}
                  >
                    {itemConcluido ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : (
                      <Circle size={18} className="text-slate-300 hover:text-slate-400" />
                    )}
                  </button>

                  <div className="space-y-0.5">
                    <p
                      className={`font-semibold text-xs ${
                        itemConcluido
                          ? "line-through text-slate-500"
                          : "text-slate-800"
                      }`}
                    >
                      {item.titulo}
                    </p>
                    <p className="text-[11px] text-slate-500">{item.descricao}</p>
                  </div>
                </div>

                {item.link && (
                  <Link
                    href={item.link}
                    target={item.link.startsWith("http") ? "_blank" : undefined}
                    onClick={() => {
                      if (!itemConcluido) handleMarcarPasso(idx + 1);
                    }}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-rio-700 hover:text-rio-900 bg-rio-50 hover:bg-rio-100 px-2.5 py-1 rounded-md transition"
                  >
                    {item.linkTexto || "Acessar"}
                    <ArrowRight size={12} />
                  </Link>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1 text-slate-400">
              <HelpCircle size={13} /> Você pode dispensar este checklist a qualquer momento.
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleDispensar}
              className="text-xs font-medium text-slate-600 hover:text-rio-700 hover:underline"
            >
              {isPending ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
              Dispensar guia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
