import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import type { CaixaSessao, MetodoPagamento, StatusPedido } from "../types";

// Caixa do balcão. Leitura pelas tabelas (RLS: o operador vê o seu caixa; gerente e admin veem todos).
// Gravação só pelas funções do banco (abrir_caixa, movimentar_caixa, fechar_caixa — migração …0025), que conferem
// quem opera, impedem dois caixas abertos e sangria maior que a gaveta.

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

type MovimentoRow = { tipo: "SANGRIA" | "SUPRIMENTO"; valor: number | string; observacao: string | null; created_at: string };
type SessaoRow = {
  id: string;
  usuario_id: string;
  aberto_em: string;
  fechado_em: string | null;
  valor_abertura: number | string;
  valor_fechamento: number | string | null;
  observacao: string | null;
  caixa_movimentos?: MovimentoRow[];
  perfis?: { nome: string } | null;
};

// caixa_movimentos e as RPCs do caixa ainda não estão em database.types.ts
async function banco() {
  return (await createClient()) as unknown as SupabaseClient;
}

function mapSessao(c: SessaoRow): CaixaSessao {
  return {
    id: c.id,
    usuarioId: c.usuario_id,
    abertoEm: c.aberto_em,
    fechadoEm: c.fechado_em || undefined,
    valorAbertura: Number(c.valor_abertura),
    valorContado: c.valor_fechamento == null ? undefined : Number(c.valor_fechamento),
    observacao: c.observacao || undefined,
    movimentos: (c.caixa_movimentos ?? [])
      .map((m) => ({ tipo: m.tipo, valor: Number(m.valor), observacao: m.observacao || "", createdAt: m.created_at }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export async function caixaAberto(usuarioId: string): Promise<CaixaSessao | undefined> {
  const { data } = await (await banco())
    .from("caixa_sessoes")
    .select("id, usuario_id, aberto_em, fechado_em, valor_abertura, valor_fechamento, observacao, caixa_movimentos (tipo, valor, observacao, created_at)")
    .eq("usuario_id", usuarioId)
    .is("fechado_em", null)
    .maybeSingle();
  return data ? mapSessao(data as SessaoRow) : undefined;
}

type PagamentoRow = {
  id: string;
  metodo: MetodoPagamento;
  status: string;
  valor: number | string;
  pago_em: string | null;
  pedidos: { id: string; codigo: string; comprador_nome: string; status: StatusPedido; created_at: string } | null;
};

/** Vendas do caixa por forma de pagamento e o dinheiro esperado na gaveta (mesma conta de private.dinheiro_esperado) */
export async function resumoCaixa(caixaId: string) {
  const supabase = await banco();
  const [{ data: caixa }, { data: pagamentos }] = await Promise.all([
    supabase.from("caixa_sessoes").select("valor_abertura, valor_fechamento, caixa_movimentos (tipo, valor)").eq("id", caixaId).maybeSingle(),
    supabase
      .from("pagamentos")
      .select("id, metodo, status, valor, pago_em, pedidos ( id, codigo, comprador_nome, status, created_at )")
      .eq("caixa_id", caixaId)
      .order("created_at"),
  ]);

  const pags = ((pagamentos ?? []) as unknown as PagamentoRow[]).map((pg) => ({
    pg: { id: pg.id, metodo: pg.metodo, status: pg.status, valor: Number(pg.valor), pagoEm: pg.pago_em },
    pedido: {
      id: pg.pedidos?.id ?? "",
      codigo: pg.pedidos?.codigo ?? "",
      compradorNome: pg.pedidos?.comprador_nome ?? "",
      status: pg.pedidos?.status ?? ("CANCELADO" as StatusPedido),
      createdAt: pg.pedidos?.created_at ?? pg.pago_em ?? "",
    },
  }));
  // Venda cancelada (pagamento estornado) continua listada, mas não entra no vendido nem na gaveta
  const aprovados = pags.filter((p) => p.pg.status === "APROVADO");

  const porMetodo = new Map<MetodoPagamento, { qtd: number; valor: number }>();
  for (const p of aprovados) {
    const m = porMetodo.get(p.pg.metodo) ?? { qtd: 0, valor: 0 };
    porMetodo.set(p.pg.metodo, { qtd: m.qtd + 1, valor: m.valor + p.pg.valor });
  }

  const c = caixa as { valor_abertura: number | string; valor_fechamento: number | string | null; caixa_movimentos: { tipo: string; valor: number | string }[] } | null;
  const movimentos = c?.caixa_movimentos ?? [];
  const soma = (tipo: string) => movimentos.filter((m) => m.tipo === tipo).reduce((s, m) => s + Number(m.valor), 0);
  const dinheiro = porMetodo.get("DINHEIRO")?.valor ?? 0;
  const suprimentos = soma("SUPRIMENTO");
  const sangrias = soma("SANGRIA");
  const esperado = Number(c?.valor_abertura ?? 0) + dinheiro + suprimentos - sangrias;

  return {
    pagamentos: pags,
    porMetodo: Array.from(porMetodo.entries()).map(([metodo, v]) => ({ metodo, ...v })),
    dinheiro,
    suprimentos,
    sangrias,
    esperado,
    vendido: aprovados.reduce((s, x) => s + x.pg.valor, 0),
    diferenca: c?.valor_fechamento == null ? undefined : Number(c.valor_fechamento) - esperado,
  };
}

export async function listarCaixasAbertos() {
  const { data } = await (await banco()).from("caixa_sessoes").select("id, usuario_id, aberto_em, perfis(nome)").is("fechado_em", null);
  return ((data ?? []) as unknown as (SessaoRow & { perfis: { nome: string } | null })[]).map((c) => ({
    id: c.id,
    usuarioId: c.usuario_id,
    abertoEm: c.aberto_em,
    usuarioNome: c.perfis?.nome ?? "—",
  }));
}

export async function ultimosCaixasFechados(usuarioId: string) {
  const { data } = await (await banco())
    .from("caixa_sessoes")
    .select("id, fechado_em, valor_fechamento")
    .eq("usuario_id", usuarioId)
    .not("fechado_em", "is", null)
    .order("fechado_em", { ascending: false })
    .limit(5);
  return ((data ?? []) as { id: string; fechado_em: string; valor_fechamento: number | string | null }[]).map((c) => ({
    id: c.id,
    fechadoEm: c.fechado_em,
    valorContado: Number(c.valor_fechamento ?? 0),
  }));
}

// ─── Gravação: sempre pela função do banco, com a sessão de quem opera ─────────

export async function abrirCaixa(valorAbertura: number): Promise<Resultado<{ caixa: { id: string } }>> {
  const { data, error } = await (await banco()).rpc("abrir_caixa", { p_valor_abertura: valorAbertura });
  if (error) return { ok: false, erro: error.message };
  return { ok: true, caixa: { id: (data as { id: string }).id } };
}

export async function movimentarCaixa(tipo: "SANGRIA" | "SUPRIMENTO", valor: number, observacao: string): Promise<Resultado> {
  const { error } = await (await banco()).rpc("movimentar_caixa", { p_tipo: tipo, p_valor: valor, p_observacao: observacao });
  return error ? { ok: false, erro: error.message } : { ok: true };
}

export async function fecharCaixa(valorContado: number, observacao: string): Promise<Resultado<{ caixa: { id: string } }>> {
  const { data, error } = await (await banco()).rpc("fechar_caixa", { p_valor_contado: valorContado, p_observacao: observacao });
  if (error) return { ok: false, erro: error.message };
  return { ok: true, caixa: { id: (data as { id: string }).id } };
}
