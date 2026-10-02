"use server";

import { revalidatePath } from "next/cache";
import { exigirPapel } from "./sessao";
import { CATEGORIAS_PISO, decidirAgenciaParceira, empresaDoOperador, marcarRepasse, salvarPisos, transferirBilhete, type DecisaoAgencia } from "./data/agencias-parceiras";
import { UUID } from "./agencia/banco";
import type { Estado } from "./admin-actions";

const DECISOES: Record<DecisaoAgencia, string> = {
  APROVAR: "Agência aprovada: já pode vender.",
  RECUSAR: "Cadastro recusado.",
  SUSPENDER: "Agência suspensa: não consegue mais vender.",
};

/** Só o administrador decide. */
export async function decidirAgenciaAction(agenciaId: string, decisao: DecisaoAgencia, motivo?: string): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (!a.op) return { erro: a.erro ?? "Seu perfil não tem permissão para esta ação." };
  if (!UUID.test(agenciaId) || !(decisao in DECISOES)) return { erro: "Pedido inválido." };
  const empresaId = await empresaDoOperador(a.op.id);
  if (!empresaId) return { erro: "Seu usuário não está ligado a uma empresa." };
  const r = await decidirAgenciaParceira(agenciaId, decisao, a.op.id, empresaId, motivo);
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin/agencias-parceiras");
  return { ok: DECISOES[decisao] };
}

/** Piso por categoria de uma viagem (ADMIN ou GERENTE). Os campos vêm como piso_<CATEGORIA>, em %. */
export async function salvarPisosAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel("ADMIN", "GERENTE");
  if (!a.op) return { erro: a.erro ?? "Seu perfil não tem permissão para esta ação." };
  const viagemId = String(form.get("viagemId") ?? "");
  if (!UUID.test(viagemId)) return { erro: "Viagem inválida." };

  const pisos: Record<string, number> = {};
  for (const tipo of CATEGORIAS_PISO) {
    const bruto = String(form.get(`piso_${tipo}`) ?? "").trim().replace(",", ".");
    const pct = Number(bruto);
    if (!bruto || !Number.isFinite(pct) || pct < 0 || pct > 100) return { erro: "Informe um piso entre 0 e 100% para cada categoria." };
    pisos[tipo] = Math.round(pct * 100) / 100;
  }
  const r = await salvarPisos(viagemId, pisos, form.get("aplicarFuturas") === "on");
  if (!r.ok) return { erro: r.erro };
  revalidatePath(`/admin/viagens/${viagemId}`);
  return { ok: r.viagens > 1 ? `Pisos salvos em ${r.viagens} viagens.` : "Pisos salvos." };
}

/** Baixa manual do repasse (ou desfaz a baixa). Só o administrador. */
export async function marcarRepasseAction(ids: string[], pago: boolean): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (!a.op) return { erro: a.erro ?? "Seu perfil não tem permissão para esta ação." };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((i) => UUID.test(i))) return { erro: "Seleção inválida." };
  const empresaId = await empresaDoOperador(a.op.id);
  if (!empresaId) return { erro: "Seu usuário não está ligado a uma empresa." };
  const r = await marcarRepasse(empresaId, a.op.id, ids, pago);
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin/agencias-parceiras", "layout");
  if (r.quantidade === 0) return { erro: "Nada a alterar: os bilhetes já estavam nesta situação ou foram cancelados." };
  const total = r.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return { ok: pago ? `Baixa registrada em ${r.quantidade} bilhete(s): ${total}.` : `Baixa desfeita em ${r.quantidade} bilhete(s).` };
}

/** Troca o titular de um bilhete vendido por agência (renegociado fora do sistema). Só o administrador. */
export async function transferirBilheteAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (!a.op) return { erro: a.erro ?? "Seu perfil não tem permissão para esta ação." };
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const bilheteId = s("bilheteId");
  if (!UUID.test(bilheteId)) return { erro: "Bilhete inválido." };
  const empresaId = await empresaDoOperador(a.op.id);
  if (!empresaId) return { erro: "Seu usuário não está ligado a uma empresa." };
  const r = await transferirBilhete(empresaId, a.op.id, bilheteId, {
    nome: s("nome"), documento: s("documento"), telefone: s("telefone"), email: s("email"),
    nascimento: s("nascimento"), endereco: s("endereco"), aceita_marketing: form.get("marketing") === "on",
  }, s("motivo"));
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin/agencias-parceiras", "layout");
  return { ok: "Bilhete transferido. O QR continua o mesmo; o titular agora é o novo passageiro." };
}
