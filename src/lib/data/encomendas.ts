import "server-only";
import { uuidCidade } from "./catalogo";
import { createClient } from "../supabase/server";
import { mapEncomenda, type DbEvento } from "./map";
import type { Encomenda, StatusEncomenda } from "../types";
import type { Database, Json } from "../supabase/database.types";

type DbStatusEncomenda = Database["public"]["Enums"]["status_encomenda"];

export type EncomendaRastreio = {
  codigo: string;
  status: StatusEncomenda;
  origemCidade: string;
  destinoCidade: string;
  destinatarioNome: string;
  volumes: number;
  pesoKg: number;
  frete: number;
  pagador: Encomenda["pagador"];
  fretePago: boolean;
  eventos: Encomenda["eventos"];
};

type RastreioRpc = {
  codigo?: string;
  status?: StatusEncomenda;
  origemCidade?: string;
  origem_cidade?: string;
  destinoCidade?: string;
  destino_cidade?: string;
  destinatarioNome?: string;
  destinatarioPrimeiroNome?: string;
  destinatario_primeiro_nome?: string;
  volumes?: number;
  pesoKg?: number;
  peso_kg?: number;
  frete?: number;
  pagador?: Encomenda["pagador"];
  fretePago?: boolean;
  frete_pago?: boolean;
  eventos?: Array<{ status?: StatusEncomenda; descricao?: string | null; createdAt?: string; created_at?: string }>;
};

/** Visitante: RPC pública (dados mascarados). Não usa a tabela encomendas (RLS só da equipe). */
export async function rastrearEncomenda(codigo: string): Promise<EncomendaRastreio | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rastrear_encomenda", {
    codigo: codigo.toUpperCase().trim(),
  });

  if (error || !data || typeof data !== "object") return null;
  const r = data as RastreioRpc;
  if (!r.codigo || !r.status) return null;
  return {
    codigo: r.codigo,
    status: r.status,
    origemCidade: r.origemCidade || r.origem_cidade || "",
    destinoCidade: r.destinoCidade || r.destino_cidade || "",
    destinatarioNome: r.destinatarioNome || r.destinatarioPrimeiroNome || r.destinatario_primeiro_nome || "",
    volumes: Number(r.volumes) || 0,
    pesoKg: Number(r.pesoKg ?? r.peso_kg) || 0,
    frete: Number(r.frete) || 0,
    pagador: r.pagador === "DESTINATARIO" ? "DESTINATARIO" : "REMETENTE",
    fretePago: Boolean(r.fretePago ?? r.frete_pago),
    eventos: (r.eventos ?? []).map((ev) => ({
      status: (ev.status || "RECEBIDA") as StatusEncomenda,
      descricao: ev.descricao || "",
      createdAt: ev.createdAt || ev.created_at || "",
    })),
  };
}

export async function encomendaPorCodigo(codigo: string): Promise<Encomenda | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("encomendas")
    .select(`*, encomenda_eventos (*), origem:cidades!origem_cidade_id(slug), destino:cidades!destino_cidade_id(slug)`)
    .eq("codigo", codigo.toUpperCase().trim())
    .maybeSingle();

  if (!data) return null;
  return mapEncomenda(data, (data.encomenda_eventos as unknown as DbEvento[]) || []);
}

export async function criarEncomenda(payload: {
  origemCidadeId: string;
  destinoCidadeId: string;
  remetenteNome: string;
  remetenteDoc: string;
  remetenteTel: string;
  destinatarioNome: string;
  destinatarioDoc?: string;
  destinatarioTel: string;
  descricao: string;
  volumes?: number;
  pesoKg: number;
  valorDeclarado?: number;
  frete: number;
  pagador?: "REMETENTE" | "DESTINATARIO";
  viagemId?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_encomenda", {
    payload: {
      origem_cidade_id: (await uuidCidade(payload.origemCidadeId)) ?? payload.origemCidadeId,
      destino_cidade_id: (await uuidCidade(payload.destinoCidadeId)) ?? payload.destinoCidadeId,
      remetente_nome: payload.remetenteNome,
      remetente_doc: payload.remetenteDoc,
      remetente_tel: payload.remetenteTel,
      destinatario_nome: payload.destinatarioNome,
      destinatario_doc: payload.destinatarioDoc,
      destinatario_tel: payload.destinatarioTel,
      descricao: payload.descricao,
      volumes: payload.volumes || 1,
      peso_kg: payload.pesoKg,
      valor_declarado: payload.valorDeclarado,
      frete: payload.frete,
      pagador: payload.pagador || "REMETENTE",
      viagem_id: payload.viagemId || null,
    } as unknown as Json,
  });

  if (error) {
    return { ok: false as const, erro: error.message };
  }
  const res = data as { codigo: string; id: string };
  return { ok: true as const, codigo: res.codigo, id: res.id };
}

export async function avancarEncomenda(codigo: string, descricao?: string) {
  const supabase = await createClient();
  const dynamicClient = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await dynamicClient.rpc("avancar_encomenda", {
    codigo: codigo.toUpperCase().trim(),
    descricao: descricao || null,
  });

  if (error) {
    return { ok: false as const, erro: error.message };
  }
  return { ok: true as const, data };
}

export async function encomendasAdmin(params?: {
  busca?: string;
  status?: string;
  cidadeDestinoId?: string;
  pagina?: number;
  limite?: number;
}) {
  const supabase = await createClient();
  const pagina = params?.pagina || 1;
  const limite = params?.limite || 25;
  const offset = (pagina - 1) * limite;

  let query = supabase.from("encomendas").select(`*, encomenda_eventos (*), origem:cidades!origem_cidade_id(slug), destino:cidades!destino_cidade_id(slug)`, { count: "exact" });

  if (params?.status && params.status !== "TODOS") {
    query = query.eq("status", params.status as DbStatusEncomenda);
  }

  if (params?.cidadeDestinoId) {
    query = query.eq("destino_cidade_id", (await uuidCidade(params.cidadeDestinoId)) ?? params.cidadeDestinoId);
  }

  if (params?.busca) {
    const b = params.busca.trim();
    query = query.or(
      `codigo.ilike.%${b}%,remetente_nome.ilike.%${b}%,destinatario_nome.ilike.%${b}%`
    );
  }

  query = query.order("created_at", { ascending: false }).range(offset, offset + limite - 1);

  const { data, count, error } = await query;
  if (error || !data) return { encomendas: [], total: 0, paginas: 1 };

  return {
    encomendas: data.map((e) => mapEncomenda(e, (e.encomenda_eventos as unknown as DbEvento[]) || [])),
    total: count || 0,
    paginas: Math.ceil((count || 0) / limite) || 1,
  };
}
