"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { bancoAgencia, UUID } from "./banco";
import { lotacoes, precosDoTrecho, type PrecoCategoria, type Trecho } from "./dados";
import { agenciaAtual } from "./sessao";
import type { Estado } from "../admin-actions";

const SESSAO_EXPIRADA = "Sua sessão expirou. Entre novamente.";
const campo = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Aceita "1234.5" e "1.234,50" */
function numero(s: string) {
  if (!s) return NaN;
  return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

/** Mensagens do banco (P0001) são regras de negócio escritas para o usuário; qualquer outro erro vira texto genérico */
function mensagemDoBanco(error: { code?: string; message: string }, contexto: string) {
  if (error.code === "P0001") return error.message;
  console.error(`[portal agencia] ${contexto}:`, error.message);
  return "Não foi possível concluir agora. Tente novamente.";
}

/** Atualização ao vivo (a cada ~15 s) da lotação das viagens que a tela mostra */
export async function lotacaoPortalAction(ids: string[]): Promise<Record<string, Trecho[]> | null> {
  const ag = await agenciaAtual();
  if (!ag) return null;
  return lotacoes(ag.empresaId, ids);
}

export async function precosPortalAction(viagemId: string, origem: number, destino: number): Promise<PrecoCategoria[] | null> {
  const ag = await agenciaAtual();
  if (!ag) return null;
  return precosDoTrecho(ag.empresaId, viagemId, origem, destino);
}

export async function venderPassagemAction(_: Estado, form: FormData): Promise<Estado> {
  const ag = await agenciaAtual();
  if (!ag) return { erro: SESSAO_EXPIRADA };

  const viagemId = campo(form, "viagemId");
  if (!UUID.test(viagemId)) return { erro: "Viagem inválida." };
  const valor = numero(campo(form, "valor"));
  if (!Number.isFinite(valor)) return { erro: "Informe o valor cobrado." };

  const { data, error } = await bancoAgencia().rpc("vender_passagem_agencia", {
    p_agencia_id: ag.id,
    p_dados: {
      viagem_id: viagemId,
      origem_ordem: Number(campo(form, "origem")),
      destino_ordem: Number(campo(form, "destino")),
      tipo: campo(form, "tipo"),
      valor_cobrado: valor,
      passageiro: {
        nome: campo(form, "nome"),
        documento: campo(form, "documento"),
        telefone: campo(form, "telefone"),
        email: campo(form, "email"),
        nascimento: campo(form, "nascimento"),
        endereco: campo(form, "endereco"),
        aceita_marketing: form.get("marketing") === "on",
      },
    },
  });
  if (error) return { erro: mensagemDoBanco(error, "venda") };

  revalidatePath("/agencia/painel", "layout");
  redirect(`/agencia/painel/bilhetes/${(data as { bilhete_id: string }).bilhete_id}?novo=1`);
}

export async function cancelarBilheteAction(bilheteId: string): Promise<Estado> {
  const ag = await agenciaAtual();
  if (!ag) return { erro: SESSAO_EXPIRADA };
  if (!UUID.test(bilheteId)) return { erro: "Bilhete inválido." };
  const { error } = await bancoAgencia().rpc("cancelar_bilhete_agencia", { p_agencia_id: ag.id, p_bilhete_id: bilheteId, p_motivo: null });
  if (error) return { erro: mensagemDoBanco(error, "cancelamento") };
  revalidatePath("/agencia/painel", "layout");
  return { ok: "Bilhete cancelado. A vaga foi devolvida." };
}
