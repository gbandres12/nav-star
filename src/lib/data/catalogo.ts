import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { SEGUNDOS_CATALOGO, TAG_CATALOGO } from "../cache";
import { createAdminClient } from "../supabase/admin";
import { createPublicClient } from "../supabase/publico";
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

// A coluna id é uuid: comparar com um slug ("manaus") faz o Postgres recusar a consulta inteira
const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const opcoesCache = { tags: [TAG_CATALOGO], revalidate: SEGUNDOS_CATALOGO };

const cidadesEmCache = unstable_cache(async (): Promise<Cidade[]> => {
  const { data, error } = await createPublicClient()
    .from("cidades")
    .select("*")
    .order("nome");
  if (error || !data) throw new Error(`[cidades] ${error?.message}`);
  return data.map(mapCidade);
}, ["catalogo-cidades"], opcoesCache);

/** Falha no banco não pode ficar guardada: o cache só recebe respostas boas (quem falha lança erro), e a tela cai em lista vazia */
const semFalha = <T,>(fn: () => Promise<T[]>) => cache(async (): Promise<T[]> => {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    return [];
  }
});

export const cidades = semFalha(cidadesEmCache);

export const cidade = cache(async (idOrSlug: string): Promise<Cidade | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cidades")
    .select("*")
    .eq(ehUuid(idOrSlug) ? "id" : "slug", idOrSlug)
    .maybeSingle();
  return data ? mapCidade(data) : null;
});

const portosEmCache = unstable_cache(async (): Promise<Porto[]> => {
  const { data, error } = await createPublicClient()
    .from("portos")
    .select("*, cidade:cidades(slug)")
    .order("nome");
  if (error || !data) throw new Error(`[portos] ${error?.message}`);
  return data.map(mapPorto);
}, ["catalogo-portos"], opcoesCache);

export const portos = semFalha(portosEmCache);

export const porto = cache(async (id: string): Promise<Porto | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portos")
    .select("*, cidade:cidades(slug)")
    .eq("id", id)
    .maybeSingle();
  return data ? mapPorto(data) : null;
});

const SELECT_LINHAS = `
      *,
      paradas_linha (*),
      tarifas_trecho (*),
      horarios_linha (*)
    `;

/**
 * As duas versões existem porque a RLS mostra ao visitante só linhas ativas, e à equipe todas.
 * Cada uma tem o seu cache: o visitante lê com a chave anônima; a equipe, com a chave do servidor (só depois de logada).
 */
const linhasEmCache = (equipe: boolean) =>
  unstable_cache(
    async (): Promise<Linha[]> => {
      const supabase = equipe ? createAdminClient() : createPublicClient();
      const { data: rowsLinha, error } = await supabase.from("linhas").select(SELECT_LINHAS).order("nome");
      if (error || !rowsLinha) throw new Error(`[linhas] ${error?.message}`);
      return rowsLinha.map((l) =>
        mapLinha(
          l,
          (l.paradas_linha as unknown as DbParada[]) || [],
          (l.tarifas_trecho as unknown as DbTarifa[]) || [],
          (l.horarios_linha as unknown as DbHorario[]) || []
        )
      );
    },
    [equipe ? "catalogo-linhas-equipe" : "catalogo-linhas-publico"],
    opcoesCache
  );

const linhasPublico = linhasEmCache(false);
const linhasEquipe = linhasEmCache(true);

export const linhas = semFalha(async () => {
  // getClaims confere o JWT localmente, sem ida ao servidor de Auth
  const { data } = await (await createClient()).auth.getClaims();
  return data?.claims?.sub ? linhasEquipe() : linhasPublico();
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

const embarcacoesEmCache = unstable_cache(async (): Promise<Embarcacao[]> => {
  const { data, error } = await createPublicClient()
    .from("embarcacoes")
    .select(`*, assentos (*)`)
    .order("nome");

  if (error || !data) throw new Error(`[embarcacoes] ${error?.message}`);
  return data.map((e) => mapEmbarcacao(e, (e.assentos as unknown as DbAssento[]) || []));
}, ["catalogo-embarcacoes"], opcoesCache);

export const embarcacoes = semFalha(embarcacoesEmCache);

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
    .select("*, cidade:cidades(slug)")
    .order("nome");

  if (error || !data) return [];
  return data.map(mapAgencia);
});

/** uuid da cidade a partir do slug (ou do próprio uuid) — para gravar e filtrar no banco */
export const uuidCidade = cache(async (slugOuId: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("cidades").select("id").eq(ehUuid(slugOuId) ? "id" : "slug", slugOuId).maybeSingle();
  return data?.id ?? null;
});

const empresaPublicaEmCache = unstable_cache(async () => {
  const { data, error } = await createPublicClient()
    .from("empresa_publica")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`[empresa_publica] ${error.message}`);
  return data;
}, ["catalogo-empresa-publica"], opcoesCache);

export const empresaPublica = cache(() => empresaPublicaEmCache().catch((e) => {
  console.error(e);
  return null;
}));
