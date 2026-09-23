import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import {
  mapAgencia,
  mapCidade,
  mapEmbarcacao,
  mapLinha,
  mapPorto,
  type DbAssento,
  type DbHorario,
  type DbParada,
  type DbTarifa,
} from "./map";
import type { Agencia, Cidade, Embarcacao, Linha, Porto } from "../types";

export const cidades = cache(async (): Promise<Cidade[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cidades")
    .select("*")
    .order("nome");
  if (error || !data) return [];
  return data.map(mapCidade);
});

export const cidade = cache(async (idOrSlug: string): Promise<Cidade | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cidades")
    .select("*")
    .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
    .maybeSingle();
  return data ? mapCidade(data) : null;
});

export const portos = cache(async (): Promise<Porto[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portos")
    .select("*")
    .order("nome");
  if (error || !data) return [];
  return data.map(mapPorto);
});

export const porto = cache(async (id: string): Promise<Porto | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapPorto(data) : null;
});

export const linhas = cache(async (): Promise<Linha[]> => {
  const supabase = await createClient();
  const { data: rowsLinha, error } = await supabase
    .from("linhas")
    .select(`
      *,
      paradas_linha (*),
      tarifas_trecho (*),
      horarios_linha (*)
    `)
    .order("nome");

  if (error || !rowsLinha) return [];

  return rowsLinha.map((l) =>
    mapLinha(
      l,
      (l.paradas_linha as unknown as DbParada[]) || [],
      (l.tarifas_trecho as unknown as DbTarifa[]) || [],
      (l.horarios_linha as unknown as DbHorario[]) || []
    )
  );
});

export const linha = cache(async (id: string): Promise<Linha | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("linhas")
    .select(`
      *,
      paradas_linha (*),
      tarifas_trecho (*),
      horarios_linha (*)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return mapLinha(
    data,
    (data.paradas_linha as unknown as DbParada[]) || [],
    (data.tarifas_trecho as unknown as DbTarifa[]) || [],
    (data.horarios_linha as unknown as DbHorario[]) || []
  );
});

export const embarcacoes = cache(async (): Promise<Embarcacao[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("embarcacoes")
    .select(`*, assentos (*)`)
    .order("nome");

  if (error || !data) return [];
  return data.map((e) => mapEmbarcacao(e, (e.assentos as unknown as DbAssento[]) || []));
});

export const embarcacao = cache(async (id: string): Promise<Embarcacao | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("embarcacoes")
    .select(`*, assentos (*)`)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return mapEmbarcacao(data, (data.assentos as unknown as DbAssento[]) || []);
});

export const agencias = cache(async (): Promise<Agencia[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agencias")
    .select("*")
    .order("nome");

  if (error || !data) return [];
  return data.map(mapAgencia);
});

export const empresaPublica = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("empresa_publica")
    .select("*")
    .limit(1)
    .maybeSingle();
  return data;
});
