import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import type { Convenio } from "../types";

type Resultado = { ok: true } | { ok: false; erro: string };
export type TarifaConvenio = {
  id: string;
  convenioId: string;
  linhaId: string;
  origemOrdem: number;
  destinoOrdem: number;
  valor: number;
  ativa: boolean;
};

async function banco(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

async function empresaAtual(supabase: SupabaseClient) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("perfis").select("empresa_id").eq("id", auth.user.id).maybeSingle();
  return (data?.empresa_id as string | undefined) ?? null;
}

export async function listarConvenios(): Promise<Convenio[]> {
  const supabase = await banco();
  const { data, error } = await supabase.from("convenios").select("id,nome,cnpj,desconto_percentual,faturado,contato,ativo,disponivel_agencias").order("nome");
  if (error) throw new Error(`Não foi possível carregar os convênios: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id, nome: c.nome, cnpj: c.cnpj ?? undefined,
    descontoPercentual: Number(c.desconto_percentual), faturado: c.faturado,
    contato: c.contato ?? undefined, ativo: c.ativo, disponivelAgencias: !!c.disponivel_agencias,
  }));
}

export async function listarTarifasConvenio(): Promise<TarifaConvenio[]> {
  const supabase = await banco();
  const { data, error } = await supabase.from("convenio_tarifas_trecho").select("id,convenio_id,linha_id,origem_ordem,destino_ordem,valor,ativa");
  if (error) throw new Error(`Não foi possível carregar as tarifas de convênio: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id, convenioId: r.convenio_id, linhaId: r.linha_id,
    origemOrdem: r.origem_ordem, destinoOrdem: r.destino_ordem,
    valor: Number(r.valor), ativa: r.ativa,
  }));
}

export async function conveniosAtivosTrecho(linhaId: string, origemOrdem: number, destinoOrdem: number) {
  const [convenios, tarifas] = await Promise.all([listarConvenios(), listarTarifasConvenio()]);
  return convenios.filter((c) => c.ativo).map((c) => ({
    id: c.id, nome: c.nome, descontoPercentual: c.descontoPercentual, faturado: c.faturado,
    tarifaEspecial: tarifas.find((t) => t.ativa && t.convenioId === c.id && t.linhaId === linhaId && t.origemOrdem === origemOrdem && t.destinoOrdem === destinoOrdem)?.valor,
  }));
}

export async function salvarConvenio(d: Omit<Convenio, "id"> & { id?: string }): Promise<Resultado> {
  if (d.nome.trim().length < 3) return { ok: false, erro: "Informe o nome do convênio." };
  if (!Number.isFinite(d.descontoPercentual) || d.descontoPercentual < 0 || d.descontoPercentual > 100)
    return { ok: false, erro: "Desconto do convênio deve ficar entre 0% e 100%." };
  const supabase = await banco();
  const empresaId = await empresaAtual(supabase);
  if (!empresaId) return { ok: false, erro: "Empresa do operador não encontrada." };
  const campos = {
    nome: d.nome.trim(), cnpj: d.cnpj?.trim() || null, desconto_percentual: d.descontoPercentual,
    faturado: d.faturado, contato: d.contato?.trim() || null, ativo: d.ativo, disponivel_agencias: !!d.disponivelAgencias && !d.faturado,
  };
  const r = d.id
    ? await supabase.from("convenios").update(campos).eq("id", d.id).eq("empresa_id", empresaId).select("id")
    : await supabase.from("convenios").insert({ ...campos, empresa_id: empresaId }).select("id");
  if (r.error) return { ok: false, erro: r.error.message };
  if (!r.data?.length) return { ok: false, erro: "Convênio não encontrado ou sem permissão para alterar." };
  return { ok: true };
}

export async function salvarTarifaConvenio(d: {
  convenioId: string; linhaId: string; origemOrdem: number; destinoOrdem: number; valor: number; ativa: boolean;
}): Promise<Resultado> {
  if (!Number.isFinite(d.valor) || d.valor < 0) return { ok: false, erro: "Informe uma tarifa válida, sem a taxa de embarque." };
  if (!Number.isInteger(d.origemOrdem) || !Number.isInteger(d.destinoOrdem) || d.origemOrdem >= d.destinoOrdem)
    return { ok: false, erro: "Trecho inválido." };
  const supabase = await banco();
  const empresaId = await empresaAtual(supabase);
  if (!empresaId) return { ok: false, erro: "Empresa do operador não encontrada." };
  const [conv, linha, paradas] = await Promise.all([
    supabase.from("convenios").select("id").eq("id", d.convenioId).eq("empresa_id", empresaId).maybeSingle(),
    supabase.from("linhas").select("id").eq("id", d.linhaId).eq("empresa_id", empresaId).maybeSingle(),
    supabase.from("paradas_linha").select("id,ordem").eq("linha_id", d.linhaId).in("ordem", [d.origemOrdem, d.destinoOrdem]),
  ]);
  if (!conv.data || !linha.data || paradas.error) return { ok: false, erro: "Convênio ou trecho não pertence à empresa." };
  const origem = paradas.data?.find((p) => p.ordem === d.origemOrdem)?.id;
  const destino = paradas.data?.find((p) => p.ordem === d.destinoOrdem)?.id;
  if (!origem || !destino) return { ok: false, erro: "Paradas do trecho não encontradas." };
  const { data: tabela } = await supabase.from("tarifas_trecho").select("valor").eq("linha_id", d.linhaId).eq("origem_parada_id", origem).eq("destino_parada_id", destino).maybeSingle();
  if (!tabela) return { ok: false, erro: "Cadastre a tarifa de tabela deste trecho antes do convênio." };
  if (d.valor > Number(tabela.valor)) return { ok: false, erro: "A tarifa especial não pode superar a tarifa de tabela." };
  const { data, error } = await supabase.from("convenio_tarifas_trecho").upsert({
    empresa_id: empresaId, convenio_id: d.convenioId, linha_id: d.linhaId,
    origem_ordem: d.origemOrdem, destino_ordem: d.destinoOrdem,
    valor: Math.round(d.valor * 100) / 100, ativa: d.ativa,
  }, { onConflict: "convenio_id,linha_id,origem_ordem,destino_ordem" }).select("id");
  if (error) return { ok: false, erro: error.message };
  return data?.length ? { ok: true } : { ok: false, erro: "Sem permissão para alterar a tarifa especial." };
}
