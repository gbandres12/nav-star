"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { money } from "./format";
import { COOKIE_OPERADOR, exigirPapel } from "./sessao";
import {
  abrirCaixa,
  alterarStatusViagem,
  alternarVendas,
  cancelarPassagens,
  config,
  criarViagemAvulsa,
  definirTripulacao,
  fecharCaixa,
  gerarViagens,
  movimentarCaixa,
  registrarImpressao,
  salvarAgencia,
  salvarCidade,
  salvarComodo,
  salvarConfig,
  salvarConvenio,
  salvarEmbarcacao,
  salvarHorarios,
  salvarLinha,
  salvarMapaAssentos,
  salvarPorto,
  salvarTarifas,
  salvarTripulante,
  trocarEmbarcacao,
  usuario,
  type Resultado,
} from "./store";
import type { Assento, Configuracao, Linha, StatusViagem, TipoPassageiro, PapelUsuario } from "./types";
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
  for (const c of caminhos) revalidatePath(c);
  return { ok };
}

// ─── Operador (provisório até o login) ─────────────────────────

export async function trocarOperador(form: FormData) {
  const id = String(form.get("usuarioId") ?? "");
  if (usuario(id)?.ativo) (await cookies()).set(COOKIE_OPERADOR, id, { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

// ─── Caixa ─────────────────────────────────────────────────────

export async function abrirCaixaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...BALCAO);
  if (a.erro) return { erro: a.erro };
  const { n } = leitor(form);
  const { abrirCaixa } = await import("./data/caixa");
  return concluir(await abrirCaixa(a.op!.id, n("valorAbertura") || 0), "Caixa aberto.");
}

export async function movimentarCaixaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...BALCAO);
  if (a.erro) return { erro: a.erro };
  const { s, n } = leitor(form);
  const tipo = s("tipo") === "SUPRIMENTO" ? "SUPRIMENTO" : "SANGRIA";
  const { movimentarCaixa } = await import("./data/caixa");
  return concluir(await movimentarCaixa(a.op!.id, tipo, n("valor"), s("observacao")), tipo === "SANGRIA" ? "Sangria registrada." : "Suprimento registrado.");
}

export async function fecharCaixaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...BALCAO);
  if (a.erro) return { erro: a.erro };
  const { s, n } = leitor(form);
  const { fecharCaixa } = await import("./data/caixa");
  const r = await fecharCaixa(a.op!.id, n("valorContado"), s("observacao"));
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin", "layout");
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
  revalidatePath(`/pedido/${s("codigo")}`);
  return { ok: "Pedido cancelado. As poltronas estão livres de novo." };
}

// ─── Bilhete ───────────────────────────────────────────────────

/** Chamado pelo botão de imprimir da página do bilhete: conta a via impressa */
export async function registrarImpressaoAction(codigo: string, passagemId?: string) {
  // Só conta vias impressas pela empresa (balcão); o passageiro imprimindo em casa não gera "2ª via"
  const a = await exigirPapel(...BALCAO);
  if (a.erro) return;
  registrarImpressao(codigo, passagemId);
  revalidatePath(`/admin/pedidos/${codigo}`);
}

// ─── Viagem ────────────────────────────────────────────────────

export async function statusViagemAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s } = leitor(form);
  return concluir(alterarStatusViagem(s("id"), s("status") as StatusViagem, s("motivo")), "Status atualizado.", "/rastreio");
}

export async function alternarVendasAction(form: FormData) {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return;
  alternarVendas(String(form.get("id")));
  revalidatePath("/admin", "layout");
  revalidatePath("/viagens");
}

export async function tripulacaoAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s } = leitor(form);
  return concluir(definirTripulacao(s("id"), form.getAll("tripulante").map(String), s("observacao")), "Tripulação salva.");
}

export async function trocarEmbarcacaoAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s } = leitor(form);
  return concluir(trocarEmbarcacao(s("id"), s("embarcacaoId")), "Embarcação trocada. Os passageiros mantiveram as poltronas.");
}

export async function viagemAvulsaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s } = leitor(form);
  const r = criarViagemAvulsa(s("linhaId"), s("embarcacaoId"), s("dia"), s("hora"));
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin", "layout");
  redirect(`/admin/viagens/${r.viagem.id}`);
}

export async function gerarViagensAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const dias = Math.min(180, Math.max(7, Number(form.get("dias")) || 60));
  const n = gerarViagens(dias);
  revalidatePath("/admin", "layout");
  return { ok: n ? `${n} viagem(ns) criada(s) para os próximos ${dias} dias.` : `Programação já estava gerada para os próximos ${dias} dias.` };
}

// ─── Cadastros ─────────────────────────────────────────────────

export async function salvarCidadeAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s } = leitor(form);
  return concluir(salvarCidade({ nome: s("nome"), uf: s("uf"), sigla: s("sigla") }), "Cidade cadastrada.");
}

export async function salvarPortoAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, n, b } = leitor(form);
  const r = salvarPorto({ id: s("id") || undefined, cidadeId: s("cidadeId"), nome: s("nome"), endereco: s("endereco"), taxaEmbarque: n("taxaEmbarque") || 0, ativo: b("ativo") });
  if (r.ok && !s("id")) {
    revalidatePath("/admin", "layout");
    redirect("/admin/portos");
  }
  return concluir(r, "Porto salvo.");
}

export async function salvarEmbarcacaoAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, n, b } = leitor(form);
  const r = salvarEmbarcacao({
    id: s("id") || undefined,
    nome: s("nome"),
    tipo: s("tipo"),
    inscricaoCapitania: s("inscricaoCapitania"),
    capacidadeCargaKg: n("capacidadeCargaKg") || 0,
    status: (["ATIVA", "MANUTENCAO", "INATIVA"].includes(s("status")) ? s("status") : "ATIVA") as "ATIVA",
    ano: n("ano") || undefined,
    comprimentoM: n("comprimentoM") || undefined,
    observacao: s("observacao"),
    assentoLivre: b("assentoLivre"),
    capacidadePassageiros: n("capacidadePassageiros") || 0,
  });
  if (r.ok && !s("id")) {
    revalidatePath("/admin", "layout");
    redirect(`/admin/embarcacoes/${r.id}`);
  }
  return concluir(r, "Embarcação salva.");
}

export async function salvarMapaAction(embarcacaoId: string, colunas: number, assentos: Omit<Assento, "id">[]): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  return concluir(salvarMapaAssentos(embarcacaoId, colunas, assentos), `Mapa salvo: ${assentos.length} poltronas.`);
}

export async function salvarComodoAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, n, b } = leitor(form);
  const r = salvarComodo({ id: s("id") || undefined, embarcacaoId: s("embarcacaoId"), nome: s("nome"), descricao: s("descricao"), acrescimo: n("acrescimo") || 0, cor: s("cor"), ativo: b("ativo") });
  return concluir(r, s("id") ? "Cômodo atualizado." : "Cômodo criado.");
}

export async function salvarTripulanteAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, b } = leitor(form);
  const r = salvarTripulante({
    id: s("id") || undefined,
    nome: s("nome"),
    funcao: s("funcao"),
    documento: s("documento"),
    habilitacao: s("habilitacao"),
    validadeHabilitacao: s("validadeHabilitacao"),
    telefone: s("telefone"),
    embarcacaoId: s("embarcacaoId"),
    ativo: b("ativo"),
  });
  if (r.ok && !s("id")) {
    revalidatePath("/admin", "layout");
    redirect("/admin/tripulantes");
  }
  return concluir(r, "Tripulante salvo.");
}

export async function salvarLinhaAction(d: { id?: string; nome: string; ativa: boolean; paradas: { portoId: string; minutosDesdeOrigem: number }[] }): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const r = salvarLinha(d);
  if (r.ok && !d.id) {
    revalidatePath("/admin", "layout");
    redirect(`/admin/linhas/${r.id}`);
  }
  return concluir(r, "Linha salva. Confira os preços na aba Trechos.", "/", "/viagens");
}

export async function salvarTarifasAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, n } = leitor(form);
  const valores: Record<string, number> = {};
  for (const k of form.keys()) if (/^t-\d+-\d+$/.test(k)) valores[k.slice(2)] = n(k);
  return concluir(salvarTarifas(s("linhaId"), valores), "Tabela de preços salva.", "/", "/viagens");
}

export async function salvarHorariosAction(linhaId: string, horarios: Linha["horarios"]): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  return concluir(salvarHorarios(linhaId, horarios), "Programação semanal salva. Use “Gerar viagens” para criar as saídas.");
}

export async function salvarConvenioAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, n, b } = leitor(form);
  const r = salvarConvenio({ id: s("id") || undefined, nome: s("nome"), cnpj: s("cnpj"), descontoPercentual: n("descontoPercentual") || 0, faturado: b("faturado"), contato: s("contato"), ativo: b("ativo") });
  return concluir(r, s("id") ? "Convênio atualizado." : "Convênio criado.");
}

export async function salvarAgenciaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel(...GESTAO);
  if (a.erro) return { erro: a.erro };
  const { s, n, b } = leitor(form);
  const r = salvarAgencia({ id: s("id") || undefined, nome: s("nome"), cidadeId: s("cidadeId"), comissaoPercentual: n("comissaoPercentual") || 0, ativa: b("ativa") });
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

export async function salvarEmpresaAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (a.erro) return { erro: a.erro };
  const { s, n } = leitor(form);
  if (s("nome").length < 3 || s("razaoSocial").length < 3) return { erro: "Informe nome e razão social." };
  if (!(n("minutosReservaSite") >= 5 && n("minutosReservaSite") <= 240)) return { erro: "Reserva do site: de 5 a 240 minutos." };
  const whatsapps = s("whatsapps")
    .split("\n")
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter((p) => p.length >= 2 && p[0] && p[1])
    .map(([cidade, numero]) => ({ cidade, numero, link: `55${numero.replace(/\D/g, "")}` }));
  if (!whatsapps.length) return { erro: "Informe ao menos um WhatsApp no formato “Cidade | (92) 99999-9999”." };
  const empresa: Configuracao["empresa"] = {
    nome: s("nome"),
    razaoSocial: s("razaoSocial"),
    cnpj: s("cnpj"),
    email: s("email"),
    tipoServico: s("tipoServico") || "Expresso",
    whatsapps,
    whatsapp: whatsapps[0].link,
    beneficios: s("beneficios").split(",").map((x) => x.trim()).filter(Boolean),
    minutosReservaSite: Math.round(n("minutosReservaSite")),
  };
  return concluir(salvarConfig("empresa", empresa), "Dados da empresa salvos.", "/");
}

export async function salvarValoresAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (a.erro) return { erro: a.erro };
  const { n } = leitor(form);
  const tipos: TipoPassageiro[] = ["INTEIRA", "CRIANCA", "IDOSO", "ESTUDANTE", "PCD"];
  const descontos = Object.fromEntries(tipos.map((t) => [t, (n(`desc-${t}`) || 0) / 100])) as Record<TipoPassageiro, number>;
  if (Object.values(descontos).some((d) => !(d >= 0 && d <= 1))) return { erro: "Descontos devem ficar entre 0% e 100%." };
  const valores: Configuracao["valores"] = {
    descontos,
    multaCancelamentoPct: n("multaCancelamentoPct") || 0,
    horasCancelamentoSemMulta: n("horasCancelamentoSemMulta") || 0,
    taxaSistemaPct: n("taxaSistemaPct") || 0,
  };
  if (!(valores.multaCancelamentoPct >= 0 && valores.multaCancelamentoPct <= 100)) return { erro: "Multa entre 0% e 100%." };
  if (!(valores.taxaSistemaPct >= 0 && valores.taxaSistemaPct <= 30)) return { erro: "Porcentagem do sistema entre 0% e 30%." };
  return concluir(salvarConfig("valores", valores), "Valores salvos. Novas vendas já usam as regras novas.");
}

export async function salvarBilheteAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel("ADMIN");
  if (a.erro) return { erro: a.erro };
  const { s, n, b } = leitor(form);
  const atual = config().bilhete;
  const bilhete: Configuracao["bilhete"] = {
    larguraMm: s("larguraMm") === "58" ? 58 : 80,
    titulo: s("titulo") || atual.titulo,
    mostrarLogo: b("mostrarLogo"),
    mostrarValores: b("mostrarValores"),
    mostrarQr: b("mostrarQr"),
    mostrarBeneficios: b("mostrarBeneficios"),
    localEmbarque: s("localEmbarque") || atual.localEmbarque,
    antecedenciaEmbarqueMin: Math.max(0, Math.round(n("antecedenciaEmbarqueMin") || 0)),
    mensagens: s("mensagens").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 6),
  };
  return concluir(salvarConfig("bilhete", bilhete), "Modelo do bilhete salvo.");
}
