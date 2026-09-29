"use server";

import { revalidatePath } from "next/cache";
import { invalidarCatalogo } from "./cache";
import { redirect } from "next/navigation";
import { exigirPapel } from "./sessao";
import type { Resultado } from "./types";
import type { Assento, FuncaoTripulante, StatusViagem, PapelUsuario } from "./types";
import * as frota from "./data/frota";
import * as convenios from "./data/convenios";
import * as gestaoViagens from "./data/viagens-gestao";
import {
  criarUsuarioComConvite,
  atualizarUsuario,
  reenviarConvite,
  registrarProgressoOnboarding,
} from "./data/usuarios";

/** Estado devolvido aos formulários (useActionState) */
export type Estado = {
  erro?: string;
  ok?: string;
  linkAtivacao?: string;
  usuarioNome?: string;
} | undefined;

const GESTAO = ["ADMIN", "GERENTE"] as const;
const BALCAO = ["ADMIN", "GERENTE", "VENDEDOR"] as const;

function leitor(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  // Aceita "1234.5" (input number) e "1.234,50" (digitado em pt-BR)
  const n = (k: string) => {
    const v = s(k);
    if (!v) return NaN;
    return Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
  };
  const b = (k: string) => form.get(k) === "on" || form.get(k) === "true";
  return { s, n, b };
}

function concluir(r: Resultado, ok: string, ...caminhos: string[]): Estado {
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin", "layout");
  invalidarCatalogo();
  for (const c of caminhos) revalidatePath(c);
  return { ok };
}

// ─── Caixa ─────────────────────────────────────────────────────

export async function abrirCaixaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...BALCAO);
  if (a.erro) return { erro: a.erro };
  const { n } = leitor(form);
  const { abrirCaixa } = await import("./data/caixa");
  const v = n("valorAbertura");
  return concluir(await abrirCaixa(Number.isNaN(v) ? 0 : v), "Caixa aberto.");
}

export async function movimentarCaixaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...BALCAO);
  if (a.erro) return { erro: a.erro };
  const { s, n } = leitor(form);
  const tipo = s("tipo") === "SUPRIMENTO" ? "SUPRIMENTO" : "SANGRIA";
  const { movimentarCaixa } = await import("./data/caixa");
  return concluir(await movimentarCaixa(tipo, n("valor"), s("observacao")), tipo === "SANGRIA" ? "Sangria registrada." : "Suprimento registrado.");
}

export async function fecharCaixaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...BALCAO);
  if (a.erro) return { erro: a.erro };
  const { s, n } = leitor(form);
  const { fecharCaixa } = await import("./data/caixa");
  const r = await fecharCaixa(n("valorContado"), s("observacao"));
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin", "layout");
  invalidarCatalogo();
  redirect(`/admin/caixa/${r.caixa.id}?imprimir=1`);
}

// ─── Cancelamento ──────────────────────────────────────────────

export async function cancelarAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...BALCAO);
  if (a.erro) return { erro: a.erro };
  const { s } = leitor(form);
  const { cancelarPedido } = await import("./data/pedidos");
  const r = await cancelarPedido(s("codigo"), s("motivo"));
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin", "layout");
  invalidarCatalogo();
  revalidatePath(`/pedido/${s("codigo")}`);
  return { ok: "Pedido cancelado. As poltronas estão livres de novo." };
}

// ─── Bilhete ───────────────────────────────────────────────────

/** Chamado pelo botão de imprimir da página do bilhete: conta a via impressa */
export async function registrarImpressaoAction(codigo: string) {
  // Só conta vias impressas pela empresa (balcão); o passageiro imprimindo em casa não gera "2ª via"
  const a = await exigirPapel(...BALCAO);
  if (a.erro) return;
  const { registrarImpressao } = await import("./data/pedidos");
  await registrarImpressao(codigo);
  revalidatePath(`/admin/pedidos/${codigo}`);
  revalidatePath(`/bilhete/${codigo}`);
}

// ─── Viagem ────────────────────────────────────────────────────

export async function statusViagemAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s } = leitor(form);
  return concluir(await gestaoViagens.mudarStatus(s("id"), s("status") as StatusViagem, s("motivo")), "Status atualizado.", "/viagens", "/rastreio");
}

export async function alternarVendasAction(form: FormData) {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return;
  await gestaoViagens.alternarVendas(String(form.get("id")));
  revalidatePath("/admin", "layout");
  invalidarCatalogo();
  revalidatePath("/viagens");
}

export async function tripulacaoAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s } = leitor(form);
  return concluir(await gestaoViagens.salvarTripulacao(s("id"), form.getAll("tripulante").map(String), s("observacao")), "Tripulação salva.");
}

export async function viagemAvulsaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (a.erro) return { erro: a.erro };
  const { s } = leitor(form);
  const r = await gestaoViagens.criarViagemAvulsa({ linhaId: s("linhaId"), embarcacaoId: s("embarcacaoId"), dia: s("dia"), hora: s("hora") });
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin", "layout");
  invalidarCatalogo();
  revalidatePath("/viagens");
  redirect(`/admin/viagens/${r.id}`);
}

// ─── Cadastros ─────────────────────────────────────────────────

export async function salvarEmbarcacaoAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (a.erro) return { erro: a.erro };
  const { s, n } = leitor(form);
  const r = await frota.salvarEmbarcacao({
    id: s("id") || undefined,
    nome: s("nome"),
    tipo: s("tipo"),
    inscricaoCapitania: s("inscricaoCapitania"),
    capacidadePassageiros: Math.round(n("capacidadePassageiros") || 0),
    capacidadeCargaKg: n("capacidadeCargaKg") || 0,
    status: (["ATIVA", "MANUTENCAO", "INATIVA"].includes(s("status")) ? s("status") : "ATIVA") as "ATIVA",
    ano: n("ano") || undefined,
    comprimentoM: n("comprimentoM") || undefined,
    observacao: s("observacao"),
    assentoLivre: form.get("assentoLivre") === "on",
  });
  if (r.ok && !s("id")) {
    revalidatePath("/admin", "layout");
    invalidarCatalogo();
    redirect(`/admin/embarcacoes/${r.id}`);
  }
  return concluir(r, "Embarcação salva.");
}

export async function salvarMapaAction(embarcacaoId: string, colunas: number, assentos: Omit<Assento, "id">[]): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (a.erro) return { erro: a.erro };
  const r = await frota.salvarMapa(embarcacaoId, colunas, assentos);
  return r.ok ? concluir(r, `Mapa salvo: ${r.poltronas} poltronas.`) : { erro: r.erro };
}

export async function salvarComodoAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, n, b } = leitor(form);
  const r = await frota.salvarComodo({ id: s("id") || undefined, embarcacaoId: s("embarcacaoId"), nome: s("nome"), descricao: s("descricao"), acrescimo: n("acrescimo") || 0, cor: s("cor"), ativo: b("ativo") });
  return concluir(r, s("id") ? "Cômodo atualizado." : "Cômodo criado.");
}

export async function salvarTripulanteAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, b } = leitor(form);
  const r = await frota.salvarTripulante({
    id: s("id") || undefined,
    nome: s("nome"),
    funcao: s("funcao") as FuncaoTripulante,
    documento: s("documento"),
    habilitacao: s("habilitacao"),
    validadeHabilitacao: s("validadeHabilitacao") || undefined,
    telefone: s("telefone"),
    embarcacaoId: s("embarcacaoId") || undefined,
    ativo: b("ativo"),
  });
  if (r.ok && !s("id")) {
    revalidatePath("/admin", "layout");
    invalidarCatalogo();
    redirect("/admin/tripulantes");
  }
  return concluir(r, "Tripulante salvo.");
}

export async function salvarConvenioAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, n, b } = leitor(form);
  const r = await convenios.salvarConvenio({ id: s("id") || undefined, nome: s("nome"), cnpj: s("cnpj"), descontoPercentual: n("descontoPercentual"), faturado: b("faturado"), contato: s("contato"), ativo: b("ativo") });
  return concluir(r, s("id") ? "Convênio atualizado." : "Convênio criado.");
}

export async function salvarTarifaConvenioAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, n, b } = leitor(form);
  const [linhaId, origem, destino] = s("trecho").split(":");
  const r = await convenios.salvarTarifaConvenio({
    convenioId: s("convenioId"), linhaId,
    origemOrdem: Number(origem), destinoOrdem: Number(destino),
    valor: n("valor"), ativa: b("ativa"),
  });
  return concluir(r, "Tarifa especial salva.", "/admin/convenios", "/admin/vender");
}

export async function salvarAgenciaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (a.erro) return { erro: a.erro };
  const { s, n, b } = leitor(form);
  const r = await frota.salvarAgencia({ id: s("id") || undefined, nome: s("nome"), cidadeId: s("cidadeId"), cnpj: s("cnpj"), comissaoPercentual: n("comissaoPercentual") || 0, ativa: b("ativa") });
  return concluir(r, s("id") ? "Agência atualizada." : "Agência criada.");
}

export async function salvarUsuarioAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (a.erro) return { erro: a.erro };
  const { s, b } = leitor(form);
  const id = s("id");
  const nome = s("nome");
  const email = s("email");
  const papel = s("papel") as PapelUsuario;
  const agenciaId = s("agenciaId") || undefined;
  const linhasPermitidas = form.getAll("linha").map(String);
  const ativo = b("ativo");
  const telefone = s("telefone") || undefined;

  if (id) {
    const r = await atualizarUsuario({
      id,
      nome,
      papel,
      agenciaId,
      linhasPermitidas,
      ativo,
      telefone,
    });
    if (!r.ok) return { erro: r.erro };
    revalidatePath("/admin/usuarios");
    revalidatePath(`/admin/usuarios/${id}`);
    return { ok: r.mensagem };
  } else {
    const r = await criarUsuarioComConvite({
      nome,
      email,
      papel,
      agenciaId,
      linhasPermitidas,
      telefone,
    });
    if (!r.ok) return { erro: r.erro };
    revalidatePath("/admin/usuarios");
    return {
      ok: "Operador cadastrado com sucesso!",
      linkAtivacao: r.data.linkAtivacao,
      usuarioNome: nome,
    };
  }
}

export async function reenviarConviteAction(usuarioId: string): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (a.erro) return { erro: a.erro };
  const r = await reenviarConvite(usuarioId);
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin/usuarios");
  return { ok: r.mensagem, linkAtivacao: r.data.linkAtivacao };
}

export async function registrarProgressoOnboardingAction(
  passo: number,
  concluido = false,
  telefone?: string
): Promise<{ ok: boolean; erro?: string }> {
  const r = await registrarProgressoOnboarding(passo, concluido, telefone);
  if (r.ok) {
    revalidatePath("/admin");
  }
  return r;
}

// ─── Configurações ─────────────────────────────────────────────

