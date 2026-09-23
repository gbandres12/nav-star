import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import { mapViagem } from "./map";
import type { StatusViagem, Viagem } from "../types";

export type ResultadoBuscaViagem = {
  viagem: Viagem;
  linhaNome: string;
  origemOrdem: number;
  destinoOrdem: number;
  origemHorario: string;
  destinoHorario: string;
  tarifaBase: number;
  taxaEmbarque: number;
  lugaresLivres: number;
  duracaoMinutos: number;
};

type DynamicRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type ItemViagemBusca = {
  viagem_id: string;
  linha_id: string;
  embarcacao_id: string;
  partida: string;
  status: StatusViagem;
  comandante?: string;
  vendas_abertas: boolean;
  linha_nome: string;
  origem_ordem: number;
  destino_ordem: number;
  saida: string;
  chegada: string;
  valor: number | string;
  taxa: number | string;
  livres: number | string;
  duracao_min: number | string;
};

export async function buscarViagens(
  origemSlug: string,
  destinoSlug: string,
  dia?: string
): Promise<ResultadoBuscaViagem[]> {
  const supabase = await createClient();
  const dynamicClient = supabase as unknown as DynamicRpcClient;
  const { data, error } = await dynamicClient.rpc("buscar_viagens", {
    origem_slug: origemSlug,
    destino_slug: destinoSlug,
    dia: dia || null,
  });

  if (error || !data || !Array.isArray(data)) return [];

  const items = data as ItemViagemBusca[];
  return items.map((item) => ({
    viagem: {
      id: item.viagem_id,
      linhaId: item.linha_id,
      embarcacaoId: item.embarcacao_id,
      partida: item.partida,
      status: item.status,
      comandante: item.comandante || "",
      vendasAbertas: item.vendas_abertas,
      tripulacao: [],
    },
    linhaNome: item.linha_nome,
    origemOrdem: item.origem_ordem,
    destinoOrdem: item.destino_ordem,
    origemHorario: item.saida,
    destinoHorario: item.chegada,
    tarifaBase: Number(item.valor),
    taxaEmbarque: Number(item.taxa),
    lugaresLivres: Number(item.livres),
    duracaoMinutos: Number(item.duracao_min),
  }));
}

export async function assentosOcupados(
  viagemId: string,
  origem: number,
  destino: number
): Promise<Set<string>> {
  const supabase = await createClient();
  const dynamicClient = supabase as unknown as DynamicRpcClient;
  const { data, error } = await dynamicClient.rpc("assentos_ocupados", {
    viagem_id: viagemId,
    origem,
    destino,
  });

  if (error || !data || !Array.isArray(data)) return new Set();
  return new Set(data as string[]);
}

export const viagem = cache(async (id: string): Promise<Viagem | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("viagens")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return data ? mapViagem(data) : null;
});

export async function viagensAdmin(params?: {
  aba?: "proximas" | "anteriores";
  linhaId?: string;
}): Promise<Viagem[]> {
  const supabase = await createClient();
  let query = supabase.from("viagens").select("*");

  const agoraIso = new Date().toISOString();
  if (params?.aba === "anteriores") {
    query = query.lt("partida", agoraIso).order("partida", { ascending: false });
  } else {
    query = query.gte("partida", agoraIso).order("partida", { ascending: true });
  }

  if (params?.linhaId) {
    query = query.eq("linha_id", params.linhaId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapViagem);
}

export async function alterarStatusViagem(
  viagemId: string,
  novoStatus: StatusViagem
) {
  const supabase = await createClient();
  const dynamicClient = supabase as unknown as DynamicRpcClient;
  const { data, error } = await dynamicClient.rpc("alterar_status_viagem", {
    viagem_id: viagemId,
    novo_status: novoStatus,
  });

  if (error) {
    return { ok: false, erro: error.message };
  }
  return { ok: true, data };
}

export async function alternarVendasViagem(viagemId: string, abertas: boolean) {
  const supabase = await createClient();
  const dynamicClient = supabase as unknown as DynamicRpcClient;
  const { data, error } = await dynamicClient.rpc("alternar_vendas_viagem", {
    viagem_id: viagemId,
    abertas,
  });

  if (error) {
    return { ok: false, erro: error.message };
  }
  return { ok: true, data };
}
