"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  Ticket,
  QrCode,
  DollarSign,
  Package,
  Ship,
  Users,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  Shield,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import type { PapelUsuario } from "@/lib/types";
import { registrarProgressoOnboardingAction } from "@/lib/admin-actions";

type Step = {
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  destaque: string;
};

const TRILHAS: Record<PapelUsuario, { saudacao: string; papelLabel: string; steps: Step[] }> = {
  VENDEDOR: {
    saudacao: "Bem-vindo ao Balcão de Vendas da São Tomé Expresso!",
    papelLabel: "Operador de Vendas e Agência",
    steps: [
      {
        titulo: "1. Abertura do Caixa Diário",
        descricao:
          "Antes de emitir o primeiro bilhete, abra seu caixa diário informando o valor inicial em gaveta. Todo recebimento em dinheiro, cartão ou PIX fica registrado com auditoria.",
        icone: DollarSign,
        destaque: "Dica: Mantenha sempre o troco conferido na abertura do turno.",
      },
      {
        titulo: "2. Emissão Rápida de Passagens",
        descricao:
          "Escolha a rota (ex: Manaus → Parintins), selecione a poltrona desejada no mapa da lancha e emita o bilhete com QR Code em menos de 1 minuto.",
        icone: Ticket,
        destaque: "Você pode imprimir o bilhete na impressora térmica (58mm/80mm) ou enviar o link por WhatsApp ao passageiro.",
      },
      {
        titulo: "3. Despacho de Encomendas Fluviais",
        descricao:
          "Cadastre remetente, destinatário, peso e volume para despachar cargas rápidas com código de rastreamento gerado na hora.",
        icone: Package,
        destaque: "O destinatário pode acompanhar o trajeto da lancha direto pelo site.",
      },
    ],
  },
  CONFERENTE: {
    saudacao: "Bem-vindo à Equipe de Embarque e Cais!",
    papelLabel: "Conferente Operacional",
    steps: [
      {
        titulo: "1. Acesso Rápido no Celular (Mobile)",
        descricao:
          "Adicione o painel à tela inicial do seu celular ou tablet para utilizar o leitor de QR Code direto no flutuante ou na rampa do porto.",
        icone: Smartphone,
        destaque: "Dica: Funciona com agilidade mesmo com oscilações no sinal de internet.",
      },
      {
        titulo: "2. Validação de Bilhetes com QR Code",
        descricao:
          "Aponte a câmera para o bilhete impresso ou na tela do passageiro. O sistema confirma a poltrona, trecho e impede duplicidades instantaneamente.",
        icone: QrCode,
        destaque: "O status do bilhete muda na hora para EMBARCADO.",
      },
      {
        titulo: "3. Manifesto de Embarque da Lancha",
        descricao:
          "Acompanhe quantos passageiros já estão a bordo por trecho e confirme a liberação da partida junto ao Comandante.",
        icone: Ship,
        destaque: "Controle visual de ausentes para chamada final antes da desatracação.",
      },
    ],
  },
  GERENTE: {
    saudacao: "Bem-vindo à Gestão Operacional da Frota!",
    papelLabel: "Gerente de Operações Fluviais",
    steps: [
      {
        titulo: "1. Monitoramento de Lanchas e Viagens",
        descricao:
          "Acompanhe as viagens programadas, bloqueie ou abra vendas de trechos específicos e monitore a taxa de ocupação em tempo real.",
        icone: Ship,
        destaque: "Controle por comodidades (Executiva, Camarote) e mapa de assentos.",
      },
      {
        titulo: "2. Escala de Tripulantes & Comandantes",
        descricao:
          "Defina a tripulação escalada para cada travessia (Comandante, Maquinista, Marinheiro) para cumprimento das normas da Capitania dos Portos.",
        icone: Users,
        destaque: "Cada viagem exige ao menos um Comandante ativo habilitado.",
      },
      {
        titulo: "3. Auditoria de Caixas & Cancelamentos",
        descricao:
          "Autorize sangrias, confira o fechamento de caixas dos vendedores e processe cancelamentos e reembolsos com cálculo automático de multa por prazo.",
        icone: Shield,
        destaque: "Relatórios operacionais e consolidação financeira diária.",
      },
    ],
  },
  ADMIN: {
    saudacao: "Painel de Administração Global — São Tomé Expresso",
    papelLabel: "Administrador Geral",
    steps: [
      {
        titulo: "1. Gestão Completa de Linhas e Tarifas",
        descricao:
          "Configure cidades, portos fluviais, paradas, frequências semanais e valores por trecho para passageiros e encomendas.",
        icone: Ship,
        destaque: "Suporte a acréscimos especiais para eventos regionais como o Festival de Parintins.",
      },
      {
        titulo: "2. Equipe & Agências Parceiras",
        descricao:
          "Cadastre operadores, defina limites de linhas autorizadas, comissões de agências e envie convites rápidos com link de WhatsApp.",
        icone: Users,
        destaque: "Controle rígido por níveis de acesso (RLS e segurança nativa Supabase).",
      },
      {
        titulo: "3. Governança & Indicadores Financeiros",
        descricao:
          "Consolidação de DRE, fluxo de caixa, convênios faturados e faturamento detalhado por canal de venda (Balcão, Agência, Site).",
        icone: DollarSign,
        destaque: "Visão estratégica de ponta a ponta da sua operação hidroviária.",
      },
    ],
  },
};

export function OnboardingModal({
  nome,
  papel,
  abertoInicialmente = false,
}: {
  nome: string;
  papel: PapelUsuario;
  abertoInicialmente?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicialmente);
  const [passoAtual, setPassoAtual] = useState(0);
  const [isPending, startTransition] = useTransition();

  const trilha = TRILHAS[papel] || TRILHAS.VENDEDOR;
  const step = trilha.steps[passoAtual];
  const Icone = step.icone;

  const handleConcluir = (concluido: boolean) => {
    startTransition(async () => {
      await registrarProgressoOnboardingAction(passoAtual + 1, concluido);
      setAberto(false);
    });
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header com branding */}
        <div className="bg-gradient-to-r from-rio-950 via-rio-900 to-rio-800 p-6 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rio-700/60 px-3 py-1 text-xs font-semibold text-rio-100 border border-rio-500/30">
              <Sparkles size={13} className="text-sol-400" />
              Onboarding Operacional • {trilha.papelLabel}
            </span>
            <button
              onClick={() => handleConcluir(false)}
              className="text-slate-300 hover:text-white transition"
              title="Fechar apresentação"
            >
              <X size={20} />
            </button>
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight">
            Olá, {nome}!
          </h2>
          <p className="mt-1 text-xs text-rio-200">{trilha.saudacao}</p>

          {/* Indicador de passos */}
          <div className="mt-5 flex gap-1.5">
            {trilha.steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  idx === passoAtual
                    ? "bg-sol-400 shadow-sm"
                    : idx < passoAtual
                    ? "bg-emerald-400"
                    : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Conteúdo do passo */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-rio-50 p-3.5 text-rio-700 border border-rio-100">
              <Icone size={28} />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-base font-bold text-slate-900">
                {step.titulo}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {step.descricao}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 text-xs text-amber-900 flex items-start gap-2">
            <CheckCircle2 size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p>{step.destaque}</p>
          </div>
        </div>

        {/* Rodapé com botões de navegação */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            disabled={passoAtual === 0 || isPending}
            onClick={() => setPassoAtual((p) => Math.max(0, p - 1))}
            className="btn-secondary flex items-center gap-1 text-xs py-2 px-3 disabled:opacity-30"
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          <div className="flex items-center gap-2">
            {passoAtual < trilha.steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setPassoAtual((p) => p + 1)}
                className="btn-primary flex items-center gap-1.5 text-xs py-2 px-4"
              >
                Próximo <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleConcluir(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md transition disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                Concluir e Ir para o Painel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
