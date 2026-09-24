import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import { localDayKey } from "../format";
import { linhas, portos, uuidCidade } from "./catalogo";
import type { Festival } from "../types";

// Festivais, suas viagens e fotos. As fotos ficam no bucket público "festivais", em <festival_id>/<arquivo>.
// festivais, festival_viagens e festival_fotos ainda não estão em database.types.ts: consultas sem tipo gerado.

export const BUCKET_FESTIVAIS = "festivais";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };
const falha = (erro: string) => ({ ok: false as const, erro });

type FestivalRow = {
  id: string;
  slug: string;
  nome: string;
  chamada: string | null;
  descricao: string | null;
  cidade_id: string;
  cidade: { slug: string } | null;
  inicio: string;
  fim: string;
  acrescimo_percentual: number | string;
  cor: Festival["cor"];
  publicado: boolean;
};
type FotoRow = { id: string; festival_id: string; caminho: string; ordem: number };

async function banco() {
  return (await createClient()) as unknown as SupabaseClient;
}

export const festivais = cache(async (): Promise<Festival[]> => {
  const supabase = await banco();
  const [{ data: fData }, { data: vData }, { data: fotoData }] = await Promise.all([
    supabase
      .from("festivais")
      .select("id, slug, nome, chamada, descricao, cidade_id, cidade:cidades(slug), inicio, fim, acrescimo_percentual, cor, publicado")
      .order("inicio"),
    supabase.from("festival_viagens").select("festival_id, viagem_id"),
    supabase.from("festival_fotos").select("id, festival_id, caminho, ordem").order("ordem").order("created_at"),
  ]);
  if (!fData) return [];

  const viagensPorFestival = new Map<string, string[]>();
  for (const row of (vData ?? []) as { festival_id: string; viagem_id: string }[]) {
    viagensPorFestival.set(row.festival_id, [...(viagensPorFestival.get(row.festival_id) ?? []), row.viagem_id]);
  }
  const fotosPorFestival = new Map<string, { id: string; url: string }[]>();
  for (const row of (fotoData ?? []) as FotoRow[]) {
    const url = supabase.storage.from(BUCKET_FESTIVAIS).getPublicUrl(row.caminho).data.publicUrl;
    fotosPorFestival.set(row.festival_id, [...(fotosPorFestival.get(row.festival_id) ?? []), { id: row.id, url }]);
  }

  return (fData as unknown as FestivalRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    chamada: row.chamada ?? "",
    descricao: row.descricao ?? "",
    cidadeId: row.cidade?.slug ?? row.cidade_id,
    inicio: row.inicio,
    fim: row.fim,
    acrescimoPercentual: Number(row.acrescimo_percentual),
    viagemIds: viagensPorFestival.get(row.id) ?? [],
    cor: row.cor,
    publicado: row.publicado,
    fotos: fotosPorFestival.get(row.id) ?? [],
  }));
});

export const festival = cache(async (slug: string): Promise<Festival | null> => {
  const todos = await festivais();
  return todos.find((f) => f.slug === slug) || null;
});

export async function festivalPorId(id: string) {
  return (await festivais()).find((f) => f.id === id) ?? null;
}

export async function festivaisNoSite(agora = new Date()) {
  const hoje = localDayKey(agora);
  const todos = await festivais();
  return todos.filter((f) => f.publicado && f.fim >= hoje).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export async function festivalDaViagem(viagemId: string) {
  const todos = await festivais();
  return todos.find((f) => f.viagemIds.includes(viagemId));
}

/** Passagens vendidas (emitidas ou já embarcadas) de cada viagem, com o total cobrado */
export async function vendasPorViagem(viagemIds: string[]) {
  const vendas = new Map<string, { quantidade: number; valor: number }>();
  if (viagemIds.length === 0) return vendas;
  const supabase = await createClient();
  const { data } = await supabase
    .from("passagens")
    .select("viagem_id, valor")
    .in("viagem_id", viagemIds)
    .in("status", ["EMITIDA", "EMBARCADA", "NAO_COMPARECEU"]);
  for (const p of data ?? []) {
    const atual = vendas.get(p.viagem_id) ?? { quantidade: 0, valor: 0 };
    vendas.set(p.viagem_id, { quantidade: atual.quantidade + 1, valor: atual.valor + Number(p.valor) });
  }
  return vendas;
}

/** A linha tem alguma parada na cidade (slug)? */
export async function linhaPassaNaCidade(linhaId: string, cidadeSlug: string) {
  const [ls, ps] = await Promise.all([linhas(), portos()]);
  const l = ls.find((x) => x.id === linhaId);
  return !!l?.paradas.some((p) => ps.find((x) => x.id === p.portoId)?.cidadeId === cidadeSlug);
}

// ─── Gravação (chamadas pelas server actions, depois de exigirPapel) ───────────

const paraSlug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export type DadosFestival = Omit<Festival, "id" | "viagemIds" | "fotos"> & { id?: string };

export async function salvarFestival(d: DadosFestival): Promise<Resultado<{ id: string }>> {
  if (d.nome.trim().length < 3) return falha("Informe o nome do festival.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(d.fim) || d.fim < d.inicio)
    return falha("Datas inválidas: o fim precisa ser igual ou depois do início.");
  if (!(d.acrescimoPercentual >= 0 && d.acrescimoPercentual <= 200)) return falha("Reajuste entre 0% e 200%.");
  const slug = paraSlug(d.slug || d.nome);
  if (!slug) return falha("Endereço (slug) inválido.");
  const cidadeId = await uuidCidade(d.cidadeId);
  if (!cidadeId) return falha("Escolha a cidade do evento.");

  const supabase = await banco();
  const { data: repetido } = await supabase.from("festivais").select("id").eq("slug", slug).neq("id", d.id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
  if (repetido) return falha("Já existe festival com este endereço.");

  const campos = {
    slug,
    nome: d.nome.trim(),
    chamada: d.chamada.trim(),
    descricao: d.descricao.trim(),
    cidade_id: cidadeId,
    inicio: d.inicio,
    fim: d.fim,
    acrescimo_percentual: d.acrescimoPercentual,
    cor: d.cor,
    publicado: d.publicado,
  };

  if (d.id) {
    const { data, error } = await supabase.from("festivais").update(campos).eq("id", d.id).select("id").maybeSingle();
    if (error) return falha(`Não foi possível salvar: ${error.message}`);
    if (!data) return falha("Festival não encontrado.");
    return { ok: true, id: d.id };
  }

  const { data: auth } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("empresa_id").eq("id", auth.user?.id ?? "").maybeSingle();
  if (!perfil?.empresa_id) return falha("Seu usuário não está ligado a uma empresa.");
  const { data, error } = await supabase.from("festivais").insert({ ...campos, empresa_id: perfil.empresa_id }).select("id").single();
  if (error) return falha(`Não foi possível cadastrar: ${error.message}`);
  return { ok: true, id: data.id as string };
}

export async function vincularViagem(festivalId: string, viagemId: string, vincular: boolean): Promise<Resultado> {
  const supabase = await banco();
  const [f, { data: v }] = await Promise.all([
    festivalPorId(festivalId),
    supabase.from("viagens").select("id, linha_id").eq("id", viagemId).maybeSingle(),
  ]);
  if (!f || !v) return falha("Festival ou viagem não encontrado.");
  // Mudar o preço de viagem com passagens vendidas geraria bilhetes com valores diferentes na mesma saída
  const vendidas = (await vendasPorViagem([viagemId])).get(viagemId)?.quantidade ?? 0;

  if (!vincular) {
    if (f.acrescimoPercentual && vendidas) return falha("Há passagens vendidas com o preço do festival nesta viagem; não dá para desvincular.");
    const { error } = await supabase.from("festival_viagens").delete().eq("festival_id", festivalId).eq("viagem_id", viagemId);
    return error ? falha(error.message) : { ok: true };
  }

  if (!(await linhaPassaNaCidade(v.linha_id as string, f.cidadeId))) return falha("Esta viagem não passa pela cidade do festival.");
  const outro = await festivalDaViagem(viagemId);
  if (outro && outro.id !== f.id) return falha(`Esta viagem já está no festival ${outro.nome}.`);
  if (f.acrescimoPercentual && vendidas) return falha("A viagem já tem passagens vendidas pelo preço normal; crie uma viagem extra para o festival.");
  const { error } = await supabase.from("festival_viagens").upsert({ festival_id: festivalId, viagem_id: viagemId });
  return error ? falha(error.message) : { ok: true };
}

/** Registra uma foto já enviada ao bucket pelo navegador; entra no fim da galeria */
export async function registrarFoto(festivalId: string, caminho: string): Promise<Resultado> {
  const [pasta, arquivo, ...resto] = caminho.split("/");
  if (pasta !== festivalId || resto.length || !/^[0-9a-f-]{36}\.(webp|jpg)$/.test(arquivo ?? "")) return falha("Arquivo inválido.");
  const supabase = await banco();
  const { data: ultima } = await supabase
    .from("festival_fotos").select("ordem").eq("festival_id", festivalId).order("ordem", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("festival_fotos").insert({ festival_id: festivalId, caminho, ordem: (ultima?.ordem ?? -1) + 1 });
  return error ? falha(`Não foi possível salvar a foto: ${error.message}`) : { ok: true };
}

export async function removerFoto(fotoId: string): Promise<Resultado> {
  const supabase = await banco();
  const { data: foto } = await supabase.from("festival_fotos").select("caminho").eq("id", fotoId).maybeSingle();
  if (!foto) return falha("Foto não encontrada.");
  const { error } = await supabase.from("festival_fotos").delete().eq("id", fotoId);
  if (error) return falha(error.message);
  // Sem a linha a foto some do site; o arquivo é apagado em seguida
  await supabase.storage.from(BUCKET_FESTIVAIS).remove([foto.caminho as string]);
  return { ok: true };
}

/** Põe a foto antes de todas as outras: vira a capa */
export async function usarComoCapa(fotoId: string): Promise<Resultado> {
  const supabase = await banco();
  const { data: foto } = await supabase.from("festival_fotos").select("festival_id").eq("id", fotoId).maybeSingle();
  if (!foto) return falha("Foto não encontrada.");
  const { data: primeira } = await supabase
    .from("festival_fotos").select("ordem").eq("festival_id", foto.festival_id).order("ordem").limit(1).single();
  const { error } = await supabase.from("festival_fotos").update({ ordem: (primeira?.ordem ?? 0) - 1 }).eq("id", fotoId);
  return error ? falha(error.message) : { ok: true };
}
