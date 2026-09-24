"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Estado } from "./admin-actions";
import * as precos from "./data/precos";
import { salvarConfigPix } from "./data/pix";
import type { TipoChavePix } from "./pix";
import { exigirPapel } from "./sessao";
import type { Configuracao, Linha, TipoPassageiro } from "./types";

// Ações das telas de preços, portos, linhas e configurações (C1/C2 do plano-melhorias.md). Gravam no Supabase.
// Só ADMIN altera — é o que a RLS do banco permite.

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

async function soAdmin() {
  const a = await exigirPapel("ADMIN");
  return a.erro ? { erro: a.erro } : null;
}

function concluir(r: precos.Resultado, ok: string, ...caminhos: string[]): Estado {
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin", "layout");
  for (const c of caminhos) revalidatePath(c, "layout");
  return { ok };
}

export async function salvarTarifasAction(_: Estado, form: FormData): Promise<Estado> {
  const bloqueio = await soAdmin();
  if (bloqueio) return bloqueio;
  const { s, n } = leitor(form);
  const valores: Record<string, number> = {};
  for (const k of form.keys()) if (/^t-\d+-\d+$/.test(k)) valores[k.slice(2)] = n(k);
  return concluir(await precos.salvarTarifas(s("linhaId"), valores), "Tabela de preços salva. O site já usa os valores novos.", "/");
}

export async function salvarCidadeAction(_: Estado, form: FormData): Promise<Estado> {
  const bloqueio = await soAdmin();
  if (bloqueio) return bloqueio;
  const { s } = leitor(form);
  return concluir(await precos.salvarCidade({ nome: s("nome"), uf: s("uf"), sigla: s("sigla") }), "Cidade cadastrada.");
}

export async function salvarPortoAction(_: Estado, form: FormData): Promise<Estado> {
  const bloqueio = await soAdmin();
  if (bloqueio) return bloqueio;
  const { s, n, b } = leitor(form);
  const r = await precos.salvarPorto({ id: s("id") || undefined, cidadeId: s("cidadeId"), nome: s("nome"), endereco: s("endereco"), taxaEmbarque: n("taxaEmbarque") || 0, ativo: b("ativo") });
  return concluir(r, s("id") ? "Porto salvo. A taxa nova vale para vendas novas." : "Porto cadastrado.", "/");
}

export async function salvarValoresAction(_: Estado, form: FormData): Promise<Estado> {
  const bloqueio = await soAdmin();
  if (bloqueio) return bloqueio;
  const { n } = leitor(form);
  const tipos: TipoPassageiro[] = ["INTEIRA", "CRIANCA", "IDOSO", "ESTUDANTE", "PCD"];
  const descontos = Object.fromEntries(tipos.map((t) => [t, (n(`desc-${t}`) || 0) / 100])) as Record<TipoPassageiro, number>;
  const r1 = await precos.salvarDescontos(descontos);
  if (!r1.ok) return { erro: r1.erro };
  const regras = { multaCancelamentoPct: n("multaCancelamentoPct") || 0, horasCancelamentoSemMulta: n("horasCancelamentoSemMulta") || 0, taxaSistemaPct: n("taxaSistemaPct") || 0 };
  if (!(regras.multaCancelamentoPct >= 0 && regras.multaCancelamentoPct <= 100)) return { erro: "Multa entre 0% e 100%." };
  if (!(regras.taxaSistemaPct >= 0 && regras.taxaSistemaPct <= 30)) return { erro: "Porcentagem do sistema entre 0% e 30%." };
  return concluir(await precos.salvarRegrasValores(regras), "Valores salvos. Vendas novas já usam as regras novas.", "/");
}

export async function salvarEmpresaAction(_: Estado, form: FormData): Promise<Estado> {
  const bloqueio = await soAdmin();
  if (bloqueio) return bloqueio;
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
  return concluir(await precos.salvarEmpresa(empresa), "Dados da empresa salvos.", "/");
}

export async function salvarBilheteAction(_: Estado, form: FormData): Promise<Estado> {
  const bloqueio = await soAdmin();
  if (bloqueio) return bloqueio;
  const { s, n, b } = leitor(form);
  const bilhete: Configuracao["bilhete"] = {
    larguraMm: s("larguraMm") === "58" ? 58 : 80,
    titulo: s("titulo") || "CARTÃO DE EMBARQUE",
    mostrarLogo: b("mostrarLogo"),
    mostrarValores: b("mostrarValores"),
    mostrarQr: b("mostrarQr"),
    mostrarBeneficios: b("mostrarBeneficios"),
    localEmbarque: s("localEmbarque") || "HIDROVIÁRIO",
    antecedenciaEmbarqueMin: Math.max(0, Math.round(n("antecedenciaEmbarqueMin") || 0)),
    mensagens: s("mensagens").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 6),
  };
  return concluir(await precos.salvarBilhete(bilhete), "Modelo do bilhete salvo.", "/bilhete");
}

export async function salvarLinhaAction(d: { id?: string; nome: string; ativa: boolean; paradas: { portoId: string; minutosDesdeOrigem: number }[] }): Promise<Estado> {
  const bloqueio = await soAdmin();
  if (bloqueio) return bloqueio;
  const r = await precos.salvarLinha(d);
  if (r.ok && !d.id && r.id) {
    revalidatePath("/admin", "layout");
    redirect(`/admin/linhas/${r.id}`);
  }
  return concluir(r, "Linha salva. Confira os preços em Trechos e preços.", "/");
}

export async function salvarHorariosAction(linhaId: string, horarios: Linha["horarios"]): Promise<Estado> {
  const bloqueio = await soAdmin();
  if (bloqueio) return bloqueio;
  return concluir(await precos.salvarHorarios(linhaId, horarios), "Programação semanal salva. O sistema gera as próximas saídas automaticamente todo dia.");
}

export async function salvarPixAction(_: Estado, form: FormData): Promise<Estado> {
  const bloqueio = await soAdmin();
  if (bloqueio) return bloqueio;
  const { s, n } = leitor(form);
  const r = await salvarConfigPix({
    tipo: s("pixTipo") as TipoChavePix,
    chave: s("pixChave"),
    nome: s("pixNome"),
    cidade: s("pixCidade"),
    horasConfirmacao: n("horasConfirmacao"),
  });
  return concluir(r, "Dados do PIX salvos. Os próximos pedidos do site já usam esta chave.", "/admin/configuracoes");
}
