import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import { cidades as listarCidades, uuidCidade } from "./catalogo";
import { passageirosPorSegmento } from "./utils";
import { mapViagem } from "./map";
import type { Assento, Comodo, FuncaoTripulante, StatusEmbarcacao, Tripulante } from "../types";

// Frota (embarcações, mapa de poltronas, cômodos), tripulantes e agências parceiras — tudo no banco.
// Quem pode gravar é decidido pela RLS: embarcações e agências só ADMIN; cômodos e tripulantes ADMIN e GERENTE.
// O mapa de poltronas grava pela função salvar_mapa_assentos (migração …0026), numa operação só.

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };
const falha = (erro: string) => ({ ok: false as const, erro });

// comodos, tripulantes e as RPCs novas não estão todos em database.types.ts
async function banco() {
  return (await createClient()) as unknown as SupabaseClient;
}

async function empresaDoUsuario(supabase: SupabaseClient) {
  const { data: auth } = await supabase.auth.getUser();
  const { data } = await supabase.from("perfis").select("empresa_id").eq("id", auth.user?.id ?? "").maybeSingle();
  return (data?.empresa_id as string | undefined) ?? null;
}

/** Nenhuma linha afetada numa gravação = a RLS recusou (perfil sem permissão) */
const semPermissao = (quem: string) => falha(`Só ${quem} pode alterar este cadastro.`);

// ─── Embarcações ───────────────────────────────────────────────────────────────

/** Maior número de pessoas a bordo (trecho mais cheio) entre as viagens da embarcação que ainda não terminaram */
async function picoFuturo(embarcacaoId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("viagens").select("*").eq("embarcacao_id", embarcacaoId).in("status", ["PROGRAMADA", "EMBARQUE", "EM_CURSO"]);
  const picos = await Promise.all((data ?? []).map(async (v) => Math.max(0, ...(await passageirosPorSegmento(mapViagem(v))))));
  return Math.max(0, ...picos);
}

/** Próxima saída de cada embarcação (lista da frota) */
export async function proximasSaidasPorEmbarcacao() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("viagens")
    .select("embarcacao_id, partida")
    .gt("partida", new Date().toISOString())
    .neq("status", "CANCELADA")
    .order("partida");
  const mapa = new Map<string, string>();
  for (const v of data ?? []) if (!mapa.has(v.embarcacao_id)) mapa.set(v.embarcacao_id, v.partida);
  return mapa;
}

export type DadosEmbarcacao = {
  id?: string;
  nome: string;
  tipo: string;
  inscricaoCapitania: string;
  capacidadePassageiros: number;
  capacidadeCargaKg: number;
  status: StatusEmbarcacao;
  ano?: number;
  comprimentoM?: number;
  observacao?: string;
};

export async function salvarEmbarcacao(d: DadosEmbarcacao): Promise<Resultado<{ id: string }>> {
  if (d.nome.trim().length < 3) return falha("Informe o nome da embarcação.");
  if (d.inscricaoCapitania.trim().length < 5) return falha("Informe a inscrição na Capitania dos Portos.");
  if (!["ATIVA", "MANUTENCAO", "INATIVA"].includes(d.status)) return falha("Status inválido.");
  if (!(Number.isInteger(d.capacidadePassageiros) && d.capacidadePassageiros > 0)) return falha("Informe a lotação total de passageiros.");
  if (d.ano && (d.ano < 1950 || d.ano > 2100)) return falha("Ano de fabricação inválido.");

  const supabase = await banco();
  const campos = {
    nome: d.nome.trim(),
    tipo: d.tipo || "LANCHA",
    inscricao_capitania: d.inscricaoCapitania.trim(),
    capacidade_passageiros: d.capacidadePassageiros,
    capacidade_carga_kg: Math.max(0, Math.round(d.capacidadeCargaKg || 0)),
    status: d.status,
    ano: d.ano || null,
    comprimento_m: d.comprimentoM || null,
    observacao: d.observacao?.trim() || null,
  };

  if (d.id) {
    const pico = await picoFuturo(d.id);
    if (pico > d.capacidadePassageiros)
      return falha(`Há viagem programada com ${pico} passageiros num trecho; a lotação não pode ficar abaixo disso.`);
    if (d.status !== "ATIVA" && pico > 0)
      return falha("Há viagens programadas com passagens vendidas nesta embarcação. Troque a embarcação dessas viagens antes.");
    const { data, error } = await supabase.from("embarcacoes").update(campos).eq("id", d.id).select("id");
    if (error) return falha(error.message);
    if (!data?.length) return semPermissao("o administrador");
    return { ok: true, id: d.id };
  }

  const empresaId = await empresaDoUsuario(supabase);
  if (!empresaId) return falha("Seu usuário não está ligado a uma empresa.");
  const { data, error } = await supabase
    .from("embarcacoes")
    .insert({ ...campos, empresa_id: empresaId, colunas_mapa: 5, assento_livre: false })
    .select("id")
    .single();
  if (error) return falha(error.code === "42501" ? "Só o administrador pode cadastrar embarcações." : error.message);
  return { ok: true, id: data.id as string };
}

export async function salvarMapa(embarcacaoId: string, colunas: number, assentos: Omit<Assento, "id">[]): Promise<Resultado<{ poltronas: number }>> {
  const { data, error } = await (await banco()).rpc("salvar_mapa_assentos", {
    p_embarcacao_id: embarcacaoId,
    p_colunas: colunas,
    p_assentos: assentos.map((a) => ({ codigo: a.codigo, fileira: a.fileira, coluna: a.coluna, tipo: a.tipo, comodoId: a.comodoId ?? null })),
  });
  if (error) return falha(error.message);
  return { ok: true, poltronas: Number((data as { poltronas: number }).poltronas) };
}

// ─── Cômodos ───────────────────────────────────────────────────────────────────

type ComodoRow = { id: string; embarcacao_id: string; nome: string; descricao: string | null; acrescimo: number | string; cor: string; ativo: boolean };
const mapComodo = (c: ComodoRow): Comodo => ({
  id: c.id,
  embarcacaoId: c.embarcacao_id,
  nome: c.nome,
  descricao: c.descricao ?? "",
  acrescimo: Number(c.acrescimo),
  cor: (["rio", "sol", "rubro", "emerald", "slate"].includes(c.cor) ? c.cor : "slate") as Comodo["cor"],
  ativo: c.ativo,
});

export async function comodos(embarcacaoId?: string): Promise<Comodo[]> {
  let q = (await banco()).from("comodos").select("id, embarcacao_id, nome, descricao, acrescimo, cor, ativo").order("nome");
  if (embarcacaoId) q = q.eq("embarcacao_id", embarcacaoId);
  const { data } = await q;
  return ((data ?? []) as ComodoRow[]).map(mapComodo);
}

export async function salvarComodo(d: { id?: string; embarcacaoId: string; nome: string; descricao: string; acrescimo: number; cor: string; ativo: boolean }): Promise<Resultado<{ id: string }>> {
  if (d.nome.trim().length < 2) return falha("Informe o nome do cômodo.");
  if (!(d.acrescimo >= 0)) return falha("O acréscimo não pode ser negativo.");
  // A venda (private.criar_pedido) ainda não soma o acréscimo do cômodo: aceitar valor aqui mostraria um preço e cobraria outro
  if (d.acrescimo > 0) return falha("Acréscimo por cômodo ainda não é cobrado na venda. Deixe 0 por enquanto.");
  const cor = ["rio", "sol", "rubro", "emerald", "slate"].includes(d.cor) ? d.cor : "slate";
  const supabase = await banco();
  const campos = { embarcacao_id: d.embarcacaoId, nome: d.nome.trim(), descricao: d.descricao.trim(), acrescimo: 0, cor, ativo: d.ativo };

  if (d.id) {
    const { data: atual } = await supabase.from("comodos").select("embarcacao_id").eq("id", d.id).maybeSingle();
    if (!atual) return falha("Cômodo não encontrado.");
    if (atual.embarcacao_id !== d.embarcacaoId) {
      const { count } = await supabase.from("assentos").select("id", { count: "exact", head: true }).eq("comodo_id", d.id).eq("ativo", true);
      if (count) return falha("Cômodo em uso no mapa; não pode mudar de embarcação.");
    }
    const { data, error } = await supabase.from("comodos").update(campos).eq("id", d.id).select("id");
    if (error) return falha(error.message);
    if (!data?.length) return semPermissao("gerente ou administrador");
    return { ok: true, id: d.id };
  }
  const empresaId = await empresaDoUsuario(supabase);
  if (!empresaId) return falha("Seu usuário não está ligado a uma empresa.");
  const { data, error } = await supabase.from("comodos").insert({ ...campos, empresa_id: empresaId }).select("id").single();
  if (error) return falha(error.code === "42501" ? "Só gerente ou administrador podem cadastrar cômodos." : error.message);
  return { ok: true, id: data.id as string };
}

// ─── Tripulantes ───────────────────────────────────────────────────────────────

type TripulanteRow = {
  id: string;
  nome: string;
  funcao: FuncaoTripulante;
  documento: string;
  habilitacao: string;
  validade_habilitacao: string | null;
  telefone: string;
  embarcacao_id: string | null;
  ativo: boolean;
};
const mapTripulante = (t: TripulanteRow): Tripulante => ({
  id: t.id,
  nome: t.nome,
  funcao: t.funcao,
  documento: t.documento,
  habilitacao: t.habilitacao,
  validadeHabilitacao: t.validade_habilitacao ?? undefined,
  telefone: t.telefone,
  embarcacaoId: t.embarcacao_id ?? undefined,
  ativo: t.ativo,
});

export async function tripulantes(): Promise<Tripulante[]> {
  const { data } = await (await banco()).from("tripulantes").select("*").order("nome");
  return ((data ?? []) as TripulanteRow[]).map(mapTripulante);
}

export async function tripulante(id: string): Promise<Tripulante | null> {
  const { data } = await (await banco()).from("tripulantes").select("*").eq("id", id).maybeSingle();
  return data ? mapTripulante(data as TripulanteRow) : null;
}

/** Viagens futuras em que o tripulante está escalado */
export async function escalasDoTripulante(id: string) {
  const { data } = await (await banco())
    .from("viagem_tripulantes")
    .select("viagem:viagens(id, partida, linha_id, status)")
    .eq("tripulante_id", id);
  return ((data ?? []) as unknown as { viagem: { id: string; partida: string; linha_id: string; status: string } | null }[])
    .map((x) => x.viagem)
    .filter((v): v is NonNullable<typeof v> => !!v && new Date(v.partida) > new Date() && v.status !== "CANCELADA")
    .sort((a, b) => a.partida.localeCompare(b.partida));
}

const FUNCOES: FuncaoTripulante[] = ["COMANDANTE", "IMEDIATO", "MAQUINISTA", "MARINHEIRO", "TAIFEIRO", "COMISSARIO"];

export async function salvarTripulante(d: Omit<Tripulante, "id"> & { id?: string }): Promise<Resultado<{ id: string }>> {
  if (d.nome.trim().length < 3) return falha("Informe o nome.");
  if (!FUNCOES.includes(d.funcao)) return falha("Escolha a função.");
  if (d.documento.replace(/\D/g, "").length < 5) return falha("Informe o documento (CPF ou RG).");
  if (d.validadeHabilitacao && !/^\d{4}-\d{2}-\d{2}$/.test(d.validadeHabilitacao)) return falha("Validade da habilitação inválida.");
  const supabase = await banco();
  const campos = {
    nome: d.nome.trim(),
    funcao: d.funcao,
    documento: d.documento.trim(),
    habilitacao: d.habilitacao.trim() || "—",
    validade_habilitacao: d.validadeHabilitacao || null,
    telefone: d.telefone.trim(),
    embarcacao_id: d.embarcacaoId || null,
    ativo: d.ativo,
  };
  if (d.id) {
    const { data, error } = await supabase.from("tripulantes").update(campos).eq("id", d.id).select("id");
    if (error) return falha(error.message);
    if (!data?.length) return semPermissao("gerente ou administrador");
    return { ok: true, id: d.id };
  }
  const empresaId = await empresaDoUsuario(supabase);
  if (!empresaId) return falha("Seu usuário não está ligado a uma empresa.");
  const { data, error } = await supabase.from("tripulantes").insert({ ...campos, empresa_id: empresaId }).select("id").single();
  if (error) return falha(error.code === "42501" ? "Só gerente ou administrador podem cadastrar tripulantes." : error.message);
  return { ok: true, id: data.id as string };
}

// ─── Agências parceiras ────────────────────────────────────────────────────────

export type AgenciaCompleta = { id: string; nome: string; cidadeId: string; cidadeNome: string; cnpj?: string; comissaoPercentual: number; ativa: boolean };

export async function agenciasCompletas(): Promise<AgenciaCompleta[]> {
  const [{ data }, cidades] = await Promise.all([
    (await banco()).from("agencias").select("id, nome, cnpj, comissao_percentual, ativa, cidade:cidades(slug)").order("nome"),
    listarCidades(),
  ]);
  return ((data ?? []) as unknown as { id: string; nome: string; cnpj: string | null; comissao_percentual: number | string; ativa: boolean; cidade: { slug: string } | null }[]).map((a) => ({
    id: a.id,
    nome: a.nome,
    cnpj: a.cnpj ?? undefined,
    cidadeId: a.cidade?.slug ?? "",
    cidadeNome: cidades.find((c) => c.id === a.cidade?.slug)?.nome ?? "",
    comissaoPercentual: Number(a.comissao_percentual),
    ativa: a.ativa,
  }));
}

/** Vendas pagas e comissão de cada agência no período */
export async function vendasPorAgencia(inicio: Date, fim: Date) {
  const { data } = await (await banco())
    .from("pedidos")
    .select("agencia_id, total, comissao_agencia")
    .eq("status", "PAGO")
    .not("agencia_id", "is", null)
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString())
    .range(0, 4999);
  const mapa = new Map<string, { pedidos: number; total: number; comissao: number }>();
  for (const p of (data ?? []) as { agencia_id: string; total: number | string; comissao_agencia: number | string }[]) {
    const a = mapa.get(p.agencia_id) ?? { pedidos: 0, total: 0, comissao: 0 };
    mapa.set(p.agencia_id, { pedidos: a.pedidos + 1, total: a.total + Number(p.total), comissao: a.comissao + Number(p.comissao_agencia) });
  }
  return mapa;
}

export async function salvarAgencia(d: { id?: string; nome: string; cidadeId: string; cnpj?: string; comissaoPercentual: number; ativa: boolean }): Promise<Resultado<{ id: string }>> {
  if (d.nome.trim().length < 3) return falha("Informe o nome da agência.");
  if (!(d.comissaoPercentual >= 0 && d.comissaoPercentual <= 50)) return falha("A comissão deve ficar entre 0% e 50%.");
  const cnpj = d.cnpj?.replace(/\D/g, "") ?? "";
  if (cnpj && cnpj.length !== 14) return falha("CNPJ precisa ter 14 dígitos.");
  const cidadeUuid = await uuidCidade(d.cidadeId);
  if (!cidadeUuid) return falha("Escolha a cidade.");
  const supabase = await banco();
  const campos = { nome: d.nome.trim(), cidade_id: cidadeUuid, cnpj: cnpj || null, comissao_percentual: Math.round(d.comissaoPercentual * 100) / 100, ativa: d.ativa };
  if (d.id) {
    const { data, error } = await supabase.from("agencias").update(campos).eq("id", d.id).select("id");
    if (error) return falha(error.message);
    if (!data?.length) return semPermissao("o administrador");
    return { ok: true, id: d.id };
  }
  const empresaId = await empresaDoUsuario(supabase);
  if (!empresaId) return falha("Seu usuário não está ligado a uma empresa.");
  const { data, error } = await supabase.from("agencias").insert({ ...campos, empresa_id: empresaId }).select("id").single();
  if (error) return falha(error.code === "42501" ? "Só o administrador pode cadastrar agências." : error.message);
  return { ok: true, id: data.id as string };
}
