import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import { manausDate } from "../format";
import { mapViagem } from "./map";
import type { StatusPassagem, StatusViagem, TipoPassageiro, Viagem } from "../types";

// Gestão das viagens no painel (lista, manifesto, status, vendas, tripulação, viagem avulsa) — tudo no banco.
// Status e vendas passam pelas funções alterar_status_viagem / alternar_vendas_viagem (GERENTE e ADMIN);
// a programação semanal é gerada pelo próprio banco todo dia (cron gerar-viagens, 60 dias à frente).

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };
const falha = (erro: string) => ({ ok: false as const, erro });

async function banco() {
  return (await createClient()) as unknown as SupabaseClient;
}

/** Transições aceitas por alterar_status_viagem */
export function proximosStatus(s: StatusViagem): StatusViagem[] {
  return s === "PROGRAMADA" ? ["EMBARQUE", "CANCELADA"] : s === "EMBARQUE" ? ["EM_CURSO", "CANCELADA"] : s === "EM_CURSO" ? ["CONCLUIDA"] : [];
}

const ATIVAS: StatusPassagem[] = ["RESERVADA", "EMITIDA", "EMBARCADA"];
const VENDIDAS: StatusPassagem[] = ["EMITIDA", "EMBARCADA", "NAO_COMPARECEU"];

/** Viagens do painel com o trecho mais cheio e a receita, numa consulta de passagens só */
export async function listaViagens(params: { aba: "proximas" | "anteriores"; linhaId?: string }) {
  const supabase = await createClient();
  const agora = new Date().toISOString();
  let q = supabase.from("viagens").select("*");
  q = params.aba === "anteriores" ? q.lt("partida", agora).order("partida", { ascending: false }).limit(100) : q.gte("partida", agora).order("partida").limit(120);
  if (params.linhaId) q = q.eq("linha_id", params.linhaId);
  const { data } = await q;
  const viagens = (data ?? []).map(mapViagem);
  if (!viagens.length) return [];

  const { data: pas } = await supabase
    .from("passagens")
    .select("viagem_id, origem_ordem, destino_ordem, status, valor")
    .in("viagem_id", viagens.map((v) => v.id))
    .in("status", [...ATIVAS, "NAO_COMPARECEU"]);

  return viagens.map((v) => {
    const daViagem = (pas ?? []).filter((p) => p.viagem_id === v.id);
    const ativas = daViagem.filter((p) => ATIVAS.includes(p.status as StatusPassagem));
    const fim = Math.max(1, ...ativas.map((p) => p.destino_ordem));
    let pico = 0;
    for (let s = 0; s < fim; s++) pico = Math.max(pico, ativas.filter((p) => p.origem_ordem <= s && p.destino_ordem > s).length);
    const receita = daViagem.filter((p) => VENDIDAS.includes(p.status as StatusPassagem)).reduce((t, p) => t + Number(p.valor), 0);
    return { viagem: v, pico, passagens: ativas.length, receita };
  });
}

export type LinhaManifesto = {
  id: string;
  nome: string;
  documento: string;
  tipo: TipoPassageiro;
  status: StatusPassagem;
  origemOrdem: number;
  destinoOrdem: number;
  valor: number;
  assentoId?: string;
  assento: string; // código da poltrona ou "Colo"
  pedidoCodigo: string;
};

type PassagemRow = {
  id: string;
  nome: string;
  documento: string;
  tipo: TipoPassageiro;
  status: StatusPassagem;
  origem_ordem: number;
  destino_ordem: number;
  valor: number | string;
  assento_id: string | null;
  assento: { codigo: string } | null;
  pedido: { codigo: string } | null;
};

export async function detalheViagem(id: string) {
  const supabase = await banco();
  const { data: v } = await supabase.from("viagens").select("*").eq("id", id).maybeSingle();
  if (!v) return null;
  const [{ data: pas }, { data: escala }, { data: encomendas }] = await Promise.all([
    supabase
      .from("passagens")
      .select("id, nome, documento, tipo, status, origem_ordem, destino_ordem, valor, assento_id, assento:assentos(codigo), pedido:pedidos(codigo)")
      .eq("viagem_id", id)
      .neq("status", "CANCELADA")
      .order("origem_ordem")
      .order("nome"),
    supabase.from("viagem_tripulantes").select("tripulante_id").eq("viagem_id", id),
    supabase
      .from("encomendas")
      .select("codigo, descricao, peso_kg, status, origem:cidades!encomendas_origem_cidade_id_fkey(nome), destino:cidades!encomendas_destino_cidade_id_fkey(nome)")
      .eq("viagem_id", id),
  ]);
  const manifesto: LinhaManifesto[] = ((pas ?? []) as unknown as PassagemRow[]).map((p) => ({
    id: p.id,
    nome: p.nome,
    documento: p.documento,
    tipo: p.tipo,
    status: p.status,
    origemOrdem: p.origem_ordem,
    destinoOrdem: p.destino_ordem,
    valor: Number(p.valor),
    assentoId: p.assento_id ?? undefined,
    assento: p.assento?.codigo ?? (p.tipo === "COLO" ? "Colo" : "Livre"),
    pedidoCodigo: p.pedido?.codigo ?? "",
  }));
  return {
    viagem: mapViagem(v as Parameters<typeof mapViagem>[0]) as Viagem,
    observacao: (v.observacao as string | null) ?? undefined,
    motivoCancelamento: (v.motivo_cancelamento as string | null) ?? undefined,
    manifesto,
    tripulacao: ((escala ?? []) as { tripulante_id: string }[]).map((x) => x.tripulante_id),
    encomendas: ((encomendas ?? []) as unknown as { codigo: string; descricao: string; peso_kg: number | string; status: string; origem: { nome: string } | null; destino: { nome: string } | null }[]).map((e) => ({
      codigo: e.codigo,
      descricao: e.descricao,
      pesoKg: Number(e.peso_kg),
      status: e.status,
      trecho: `${e.origem?.nome ?? "?"} → ${e.destino?.nome ?? "?"}`,
    })),
  };
}

// ─── Gravação (depois de exigirPapel nas actions; o banco confere de novo) ─────

export async function mudarStatus(id: string, status: StatusViagem, motivo?: string): Promise<Resultado> {
  const supabase = await banco();
  if (status === "CANCELADA") {
    if (!motivo || motivo.trim().length < 3) return falha("Informe o motivo do cancelamento.");
    // A função do banco fecha a viagem mas não mexe nas passagens: com gente vendida, cancelar deixaria bilhetes válidos
    const { count } = await supabase.from("passagens").select("id", { count: "exact", head: true }).eq("viagem_id", id).in("status", ["RESERVADA", "EMITIDA"]);
    if (count)
      return falha(`Há ${count} passagem(ns) ativa(s) nesta viagem. Cancele os pedidos (com reembolso) ou remaneje os passageiros antes de cancelar a viagem.`);
  }
  const { error } = await supabase.rpc("alterar_status_viagem", { viagem_id: id, novo_status: status });
  if (error) return falha(error.message);
  if (status === "CANCELADA") await supabase.from("viagens").update({ motivo_cancelamento: motivo!.trim() }).eq("id", id);
  return { ok: true };
}

export async function alternarVendas(id: string): Promise<Resultado<{ abertas: boolean }>> {
  const supabase = await banco();
  const { data: v } = await supabase.from("viagens").select("vendas_abertas").eq("id", id).maybeSingle();
  if (!v) return falha("Viagem não encontrada.");
  const abertas = !v.vendas_abertas;
  const { error } = await supabase.rpc("alternar_vendas_viagem", { viagem_id: id, abertas });
  return error ? falha(error.message) : { ok: true, abertas };
}

export async function salvarTripulacao(id: string, tripulanteIds: string[], observacao: string): Promise<Resultado> {
  const supabase = await banco();
  const { data: escolhidos } = tripulanteIds.length
    ? await supabase.from("tripulantes").select("id, nome, funcao").in("id", tripulanteIds).eq("ativo", true)
    : { data: [] as { id: string; nome: string; funcao: string }[] };
  const validos = (escolhidos ?? []) as { id: string; nome: string; funcao: string }[];
  if (validos.filter((t) => t.funcao === "COMANDANTE").length > 1) return falha("Escolha só um comandante.");

  const { error: e1 } = await supabase.from("viagem_tripulantes").delete().eq("viagem_id", id);
  if (e1) return falha(e1.message);
  if (validos.length) {
    const { error: e2 } = await supabase.from("viagem_tripulantes").insert(validos.map((t) => ({ viagem_id: id, tripulante_id: t.id })));
    if (e2) return falha(e2.message);
  }
  const comandante = validos.find((t) => t.funcao === "COMANDANTE")?.nome ?? "";
  const { data, error } = await supabase.from("viagens").update({ comandante, observacao: observacao.trim() || null }).eq("id", id).select("id");
  if (error) return falha(error.message);
  if (!data?.length) return falha("Só gerente ou administrador alteram a viagem.");
  return { ok: true };
}

export async function criarViagemAvulsa(d: { linhaId: string; embarcacaoId: string; dia: string; hora: string }): Promise<Resultado<{ id: string }>> {
  const [y, m, dd] = d.dia.split("-").map(Number);
  const [hh, mm] = d.hora.split(":").map(Number);
  if (!y || !m || !dd || Number.isNaN(hh) || Number.isNaN(mm)) return falha("Data ou hora inválida.");
  const partida = manausDate(y, m - 1, dd, hh, mm);
  if (partida <= new Date()) return falha("A partida precisa ser no futuro.");

  const supabase = await banco();
  const [{ data: linha }, { data: emb }] = await Promise.all([
    supabase.from("linhas").select("id, empresa_id, ativa").eq("id", d.linhaId).maybeSingle(),
    supabase.from("embarcacoes").select("id, status").eq("id", d.embarcacaoId).maybeSingle(),
  ]);
  if (!linha?.ativa) return falha("Escolha uma linha ativa.");
  if (emb?.status !== "ATIVA") return falha("Escolha uma embarcação ativa.");
  const { count } = await supabase
    .from("viagens")
    .select("id", { count: "exact", head: true })
    .eq("linha_id", d.linhaId)
    .eq("partida", partida.toISOString())
    .neq("status", "CANCELADA");
  if (count) return falha("Já existe viagem desta linha nesse horário.");

  const { data, error } = await supabase
    .from("viagens")
    .insert({
      empresa_id: linha.empresa_id,
      linha_id: d.linhaId,
      embarcacao_id: d.embarcacaoId,
      partida: partida.toISOString(),
      status: "PROGRAMADA",
      vendas_abertas: true,
      avulsa: true,
      comandante: "",
    })
    .select("id")
    .single();
  if (error) return falha(error.code === "42501" ? "Só o administrador cria viagens avulsas." : error.message);
  return { ok: true, id: data.id as string };
}
