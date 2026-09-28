import "server-only";
import { createClient } from "../supabase/server";
import { localDayKey } from "../format";
import { embarcacoes as listarEmbarcacoes } from "./catalogo";
import { passageirosPorSegmento } from "./utils";
import { mapPedido, mapViagem } from "./map";
import type { CanalVenda } from "../types";

// Números do painel inicial, lidos do banco. A RLS decide o alcance: gerente e admin veem a empresa;
// vendedor vê só as próprias vendas.

const LIMITE = 5000; // pedidos por mês lidos de uma vez (o PostgREST corta em 1000 sem range explícito)

export async function resumoDoMes(inicio: Date, fim: Date, dias: number, mes: string) {
  const supabase = await createClient();
  const [{ data: pedidos }, { count: passagens }, { data: encomendas }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id, total, taxas, comissao_agencia, canal, created_at")
      .eq("status", "PAGO")
      .gte("created_at", inicio.toISOString())
      .lt("created_at", fim.toISOString())
      .range(0, LIMITE - 1),
    supabase
      .from("passagens")
      .select("id, pedidos!inner(status, created_at)", { count: "exact", head: true })
      .in("status", ["EMITIDA", "EMBARCADA", "NAO_COMPARECEU"])
      .eq("pedidos.status", "PAGO")
      .gte("pedidos.created_at", inicio.toISOString())
      .lt("pedidos.created_at", fim.toISOString()),
    supabase.from("encomendas").select("frete").gte("created_at", inicio.toISOString()).lt("created_at", fim.toISOString()).range(0, LIMITE - 1),
  ]);

  const lista = (pedidos ?? []).map((p) => ({ ...p, total: Number(p.total), taxas: Number(p.taxas), comissao: Number(p.comissao_agencia) }));
  const total = lista.reduce((s, p) => s + p.total, 0);
  const taxas = lista.reduce((s, p) => s + p.taxas, 0);
  const comissao = lista.reduce((s, p) => s + p.comissao, 0);

  const porCanal = new Map<CanalVenda, number>();
  for (const p of lista) porCanal.set(p.canal as CanalVenda, (porCanal.get(p.canal as CanalVenda) ?? 0) + p.total);

  const porDia = Array.from({ length: dias }, (_, i) => {
    const key = `${mes}-${String(i + 1).padStart(2, "0")}`;
    const doDia = lista.filter((p) => localDayKey(p.created_at) === key);
    return {
      label: String(i + 1),
      sub: `${String(i + 1).padStart(2, "0")}/${mes.slice(5)}`,
      value: doDia.reduce((s, p) => s + p.total, 0),
      hint: `${doDia.length} pedido(s)`,
    };
  });

  return {
    pedidos: lista.length,
    total,
    taxas,
    comissao,
    passagens: passagens ?? 0,
    fretes: (encomendas ?? []).reduce((s, e) => s + Number(e.frete), 0),
    encomendas: (encomendas ?? []).length,
    porCanal: Array.from(porCanal.entries()).map(([canal, valor]) => ({ canal, valor })),
    porDia,
  };
}

/** Próximas saídas (e as das últimas 24 h ainda não concluídas) com a lotação do trecho mais cheio */
export async function proximasViagensPainel(limite = 5) {
  const supabase = await createClient();
  const desde = new Date(Date.now() - 86_400_000).toISOString();
  const [{ data }, embarcacoes] = await Promise.all([
    supabase.from("viagens").select("*").gte("partida", desde).neq("status", "CONCLUIDA").order("partida").limit(limite),
    listarEmbarcacoes(),
  ]);
  return Promise.all(
    (data ?? []).map(async (row) => {
      const v = mapViagem(row);
      const capacidade = embarcacoes.find((e) => e.id === v.embarcacaoId)?.capacidadePassageiros ?? 0;
      const maior = Math.max(0, ...(await passageirosPorSegmento(v)));
      return { viagem: v, ocupados: maior, capacidade, pct: capacidade ? Math.round((maior / capacidade) * 100) : 0 };
    }),
  );
}

export async function ultimosPedidos(limite = 7) {
  const supabase = await createClient();
  const { data } = await supabase.from("pedidos").select("*").order("created_at", { ascending: false }).limit(limite);
  return (data ?? []).map((p) => mapPedido(p));
}

export async function encomendasPendentes() {
  const supabase = await createClient();
  const contar = async (status: "RECEBIDA" | "DISPONIVEL_RETIRADA") =>
    (await supabase.from("encomendas").select("id", { count: "exact", head: true }).eq("status", status)).count ?? 0;
  const [noPorto, retirada] = await Promise.all([contar("RECEBIDA"), contar("DISPONIVEL_RETIRADA")]);
  return { noPorto, retirada };
}

