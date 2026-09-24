import "server-only";
import { createClient } from "../supabase/server";
import { uuidCidade } from "./catalogo";
import type { Configuracao, Linha, TipoPassageiro } from "../types";

// Cadastros que definem o preço (C1/C2 do plano-melhorias.md): tarifas por trecho, portos e taxas, descontos,
// dados da empresa, modelo do bilhete, linhas e programação. Tudo grava no Supabase com a sessão do usuário (RLS de ADMIN).

export type Resultado = { ok: true } | { ok: false; erro: string };
const falha = (erro: string): Resultado => ({ ok: false, erro });
const round2 = (n: number) => Math.round(n * 100) / 100;
const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A RLS devolve 0 linhas (sem erro) quando o usuário não pode alterar: trata como falta de permissão */
function semPermissao(n: number | null | undefined, oque: string): Resultado | null {
  return n ? null : falha(`Sem permissão para alterar ${oque} (só administradores) ou registro não encontrado.`);
}

async function empresaDoUsuario() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("perfis").select("empresa_id").eq("id", auth.user.id).maybeSingle();
  return data?.empresa_id ?? null;
}

// ─── Tarifas por trecho ────────────────────────────────────────

/** `valores` no formato {"0-2": 372.6} (ordem da parada de origem - ordem da de destino) */
export async function salvarTarifas(linhaId: string, valores: Record<string, number>): Promise<Resultado> {
  const supabase = await createClient();
  const { data: paradas, error } = await supabase.from("paradas_linha").select("id,ordem").eq("linha_id", linhaId).order("ordem");
  if (error || !paradas?.length) return falha("Linha não encontrada.");
  const id = new Map(paradas.map((p) => [p.ordem, p.id]));
  const linhas: { linha_id: string; origem_parada_id: string; destino_parada_id: string; valor: number }[] = [];
  for (const [k, v] of Object.entries(valores)) {
    const [o, d] = k.split("-").map(Number);
    if (!(v >= 0) || !id.has(o) || !id.has(d) || o >= d) return falha(`Preço inválido no trecho ${k}.`);
    linhas.push({ linha_id: linhaId, origem_parada_id: id.get(o)!, destino_parada_id: id.get(d)!, valor: round2(v) });
  }
  const r = await supabase.from("tarifas_trecho").upsert(linhas, { onConflict: "origem_parada_id,destino_parada_id" }).select("id");
  if (r.error) return falha(`Não foi possível salvar: ${r.error.message}`);
  return semPermissao(r.data?.length, "os preços") ?? { ok: true };
}

// ─── Cidades e portos (taxa de embarque) ───────────────────────

export async function salvarCidade(d: { nome: string; uf: string; sigla: string }): Promise<Resultado> {
  const nome = d.nome.trim();
  const uf = d.uf.trim().toUpperCase();
  const sigla = d.sigla.trim().toUpperCase();
  if (nome.length < 2 || !/^[A-Z]{2}$/.test(uf) || !/^[A-Z]{3}$/.test(sigla)) return falha("Informe nome, UF (2 letras) e sigla (3 letras).");
  const supabase = await createClient();
  const r = await supabase.from("cidades").insert({ nome, uf, sigla, slug: slugify(nome) }).select("id");
  if (r.error) return falha(r.error.code === "23505" ? "Cidade ou sigla já cadastrada." : r.error.message);
  return semPermissao(r.data?.length, "cidades") ?? { ok: true };
}

export async function salvarPorto(d: { id?: string; cidadeId: string; nome: string; endereco: string; taxaEmbarque: number; ativo: boolean }): Promise<Resultado> {
  if (d.nome.trim().length < 2) return falha("Informe o nome do porto.");
  if (!(d.taxaEmbarque >= 0)) return falha("Taxa de embarque inválida.");
  const cidadeUuid = await uuidCidade(d.cidadeId);
  if (!cidadeUuid) return falha("Escolha a cidade.");
  const supabase = await createClient();
  if (!d.ativo && d.id) {
    const { count } = await supabase.from("paradas_linha").select("id, linhas!inner(ativa)", { count: "exact", head: true }).eq("porto_id", d.id).eq("linhas.ativa", true);
    if (count) return falha("Porto usado por linha ativa; desative a linha antes.");
  }
  const campos = { cidade_id: cidadeUuid, nome: d.nome.trim(), endereco: d.endereco.trim() || null, taxa_embarque: round2(d.taxaEmbarque), ativo: d.ativo };
  const r = d.id ? await supabase.from("portos").update(campos).eq("id", d.id).select("id") : await supabase.from("portos").insert(campos).select("id");
  if (r.error) return falha(r.error.message);
  return semPermissao(r.data?.length, "portos") ?? { ok: true };
}

// ─── Descontos por tipo de passageiro ──────────────────────────

/** `descontos` em fração (0.5 = 50%). Precisa da migração …0020 (policy de UPDATE para ADMIN). */
export async function salvarDescontos(descontos: Partial<Record<TipoPassageiro, number>>): Promise<Resultado> {
  const supabase = await createClient();
  for (const [tipo, frac] of Object.entries(descontos)) {
    if (!(frac! >= 0 && frac! <= 1)) return falha("Descontos devem ficar entre 0% e 100%.");
    const r = await supabase
      .from("descontos_tipo_passageiro")
      .update({ percentual: round2(frac! * 100) })
      .eq("tipo", tipo as never)
      .select("tipo");
    if (r.error) return falha(r.error.message);
    if (!r.data?.length)
      return falha("O banco ainda não permite editar os descontos: aplique a migração 20260923000020_descontos_editaveis.sql no Supabase.");
  }
  return { ok: true };
}

export async function historicoDescontos(limite = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("descontos_historico" as never)
    .select("tipo,percentual_anterior,percentual_novo,alterado_em,perfis(nome)")
    .order("alterado_em", { ascending: false })
    .limit(limite);
  return ((data ?? []) as unknown as { tipo: string; percentual_anterior: number | null; percentual_novo: number; alterado_em: string; perfis: { nome: string } | null }[]);
}

// ─── Empresa, regras de valores e bilhete ──────────────────────

export async function salvarEmpresa(e: Configuracao["empresa"]): Promise<Resultado> {
  const id = await empresaDoUsuario();
  if (!id) return falha("Empresa do usuário não encontrada.");
  const supabase = await createClient();
  const r = await supabase
    .from("empresas")
    .update({
      nome_fantasia: e.nome,
      razao_social: e.razaoSocial,
      cnpj: e.cnpj,
      email: e.email,
      whatsapp: e.whatsapp,
      telefone: e.whatsapps[0]?.numero ?? "",
      minutos_reserva_site: e.minutosReservaSite,
      tipo_servico: e.tipoServico,
      beneficios: e.beneficios,
      whatsapps: e.whatsapps.map(({ cidade, numero }) => ({ cidade, numero })),
    } as never)
    .eq("id", id)
    .select("id");
  if (r.error) return falha(r.error.message);
  return semPermissao(r.data?.length, "os dados da empresa") ?? { ok: true };
}

export async function salvarRegrasValores(v: Omit<Configuracao["valores"], "descontos">): Promise<Resultado> {
  const id = await empresaDoUsuario();
  if (!id) return falha("Empresa do usuário não encontrada.");
  const supabase = await createClient();
  const r = await supabase
    .from("empresas")
    .update({ multa_cancelamento_pct: v.multaCancelamentoPct, horas_cancelamento_sem_multa: v.horasCancelamentoSemMulta, taxa_sistema_pct: v.taxaSistemaPct } as never)
    .eq("id", id)
    .select("id");
  if (r.error) return falha(r.error.message);
  return semPermissao(r.data?.length, "as regras de valores") ?? { ok: true };
}

export async function salvarBilhete(b: Configuracao["bilhete"]): Promise<Resultado> {
  const id = await empresaDoUsuario();
  if (!id) return falha("Empresa do usuário não encontrada.");
  const supabase = await createClient();
  const r = await supabase
    .from("configuracoes_bilhete" as never)
    .update({
      largura_mm: b.larguraMm,
      titulo: b.titulo,
      mostrar_logo: b.mostrarLogo,
      mostrar_valores: b.mostrarValores,
      mostrar_qr: b.mostrarQr,
      mostrar_beneficios: b.mostrarBeneficios,
      local_embarque: b.localEmbarque,
      antecedencia_embarque_min: b.antecedenciaEmbarqueMin,
      mensagens: b.mensagens,
    } as never)
    .eq("empresa_id", id)
    .select("empresa_id");
  if (r.error) return falha(r.error.message);
  return semPermissao((r.data as unknown[] | null)?.length, "o modelo do bilhete") ?? { ok: true };
}

// ─── Linhas e programação semanal ──────────────────────────────

/**
 * Cria a linha, ou atualiza nome, situação e tempos das paradas. Mudar a sequência de portos de uma linha existente
 * não é feito aqui: as tarifas e as passagens apontam para as paradas (precisa de RPC transacional — ver plano C1).
 */
export async function salvarLinha(d: { id?: string; nome: string; ativa: boolean; paradas: { portoId: string; minutosDesdeOrigem: number }[] }): Promise<Resultado & { id?: string }> {
  if (d.nome.trim().length < 3) return falha("Informe o nome da linha.");
  if (d.paradas.length < 2) return falha("A linha precisa de pelo menos 2 paradas.");
  if (new Set(d.paradas.map((p) => p.portoId)).size !== d.paradas.length) return falha("O mesmo porto aparece duas vezes.");
  if (d.paradas.some((p, i) => i > 0 && !(p.minutosDesdeOrigem > d.paradas[i - 1].minutosDesdeOrigem)))
    return falha("Os tempos das paradas precisam aumentar a cada parada.");
  const supabase = await createClient();

  if (d.id) {
    const { data: atuais } = await supabase.from("paradas_linha").select("id,ordem,porto_id").eq("linha_id", d.id).order("ordem");
    const mesma = atuais?.length === d.paradas.length && atuais.every((p, i) => p.porto_id === d.paradas[i].portoId);
    if (!mesma)
      return falha("Mudar os portos ou a ordem das paradas de uma linha existente ainda não é possível pelo sistema. Dá para ajustar nome, situação e horários previstos; para outra sequência, crie uma linha nova.");
    const r = await supabase.from("linhas").update({ nome: d.nome.trim(), ativa: d.ativa }).eq("id", d.id).select("id");
    if (r.error) return falha(r.error.message);
    const p = semPermissao(r.data?.length, "linhas");
    if (p) return p;
    for (const [i, x] of atuais!.entries()) {
      const u = await supabase.from("paradas_linha").update({ minutos_desde_origem: Math.round(d.paradas[i].minutosDesdeOrigem) }).eq("id", x.id);
      if (u.error) return falha(u.error.message);
    }
    return { ok: true, id: d.id };
  }

  const empresaId = await empresaDoUsuario();
  if (!empresaId) return falha("Empresa do usuário não encontrada.");
  const nova = await supabase.from("linhas").insert({ empresa_id: empresaId, nome: d.nome.trim(), ativa: d.ativa }).select("id").single();
  if (nova.error || !nova.data) return falha(nova.error?.message ?? "Sem permissão para criar linhas.");
  const ps = await supabase
    .from("paradas_linha")
    .insert(d.paradas.map((p, i) => ({ linha_id: nova.data.id, porto_id: p.portoId, ordem: i, minutos_desde_origem: Math.round(p.minutosDesdeOrigem) })));
  if (ps.error) return falha(ps.error.message);
  return { ok: true, id: nova.data.id };
}

/** Programação semanal: ativa/atualiza os horários informados e desativa os demais (não apaga, para manter o histórico) */
export async function salvarHorarios(linhaId: string, horarios: Linha["horarios"]): Promise<Resultado> {
  for (const h of horarios)
    if (!(h.diaSemana >= 0 && h.diaSemana <= 6) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.horaSaida)) return falha("Dia ou hora inválida.");
  const chaves = horarios.map((h) => `${h.diaSemana}-${h.horaSaida}`);
  if (new Set(chaves).size !== chaves.length) return falha("Horário repetido no mesmo dia.");
  const supabase = await createClient();
  const { data: atuais, error } = await supabase.from("horarios_linha").select("id,dia_semana,hora_saida,ativo").eq("linha_id", linhaId);
  if (error) return falha(error.message);
  const usados = new Set<string>();
  for (const h of horarios) {
    const existente = atuais?.find((a) => a.dia_semana === h.diaSemana && a.hora_saida.slice(0, 5) === h.horaSaida);
    const r = existente
      ? await supabase.from("horarios_linha").update({ ativo: true, embarcacao_id: h.embarcacaoId }).eq("id", existente.id).select("id")
      : await supabase.from("horarios_linha").insert({ linha_id: linhaId, dia_semana: h.diaSemana, hora_saida: `${h.horaSaida}:00`, embarcacao_id: h.embarcacaoId, ativo: true }).select("id");
    if (r.error) return falha(r.error.message);
    const p = semPermissao(r.data?.length, "a programação");
    if (p) return p;
    if (existente) usados.add(existente.id);
  }
  for (const a of atuais ?? []) {
    if (a.ativo && !usados.has(a.id) && !horarios.some((h) => h.diaSemana === a.dia_semana && h.horaSaida === a.hora_saida.slice(0, 5))) {
      const r = await supabase.from("horarios_linha").update({ ativo: false }).eq("id", a.id);
      if (r.error) return falha(r.error.message);
    }
  }
  return { ok: true };
}
