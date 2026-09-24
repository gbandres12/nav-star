import "server-only";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import type { CaixaSessao } from "../types";
import { money } from "../format";

export async function caixaAberto(usuarioId: string): Promise<CaixaSessao | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("caixa_sessoes")
    .select(`
      id,
      usuario_id,
      aberto_em,
      fechado_em,
      valor_abertura,
      valor_fechamento,
      observacao,
      caixa_movimentos (
        tipo,
        valor,
        observacao,
        created_at
      )
    `)
    .eq("usuario_id", usuarioId)
    .is("fechado_em", null)
    .maybeSingle();

  if (!data) return undefined;

  return {
    id: data.id,
    usuarioId: data.usuario_id,
    abertoEm: data.aberto_em,
    fechadoEm: data.fechado_em || undefined,
    valorAbertura: Number(data.valor_abertura),
    valorContado: data.valor_fechamento ? Number(data.valor_fechamento) : undefined,
    observacao: data.observacao || undefined,
    movimentos: (((data as any).caixa_movimentos as any[]) || []).map(m => ({
      tipo: m.tipo,
      valor: Number(m.valor),
      observacao: m.observacao || "",
      createdAt: m.created_at
    }))
  };
}

export async function resumoCaixa(caixaId: string) {
  const supabase = await createClient();
  
  // As RPCs for caixa might be mocks, we'll manually aggregate for now.
  const { data: caixa } = await supabase
    .from("caixa_sessoes")
    .select("*, caixa_movimentos(*)")
    .eq("id", caixaId)
    .single();

  if (!caixa) return { esperado: 0, vendido: 0, sangrias: 0, suprimentos: 0, dinheiro: 0, pagamentos: [], porMetodo: [], diferenca: undefined };

  const { data: pagamentos } = await supabase
    .from("pagamentos")
    .select(`
      id,
      metodo,
      status,
      valor,
      pago_em,
      pedidos ( id, codigo, comprador_nome, status, created_at )
    `)
    .eq("caixa_id", caixaId);

  const pags = (pagamentos || []).map((pg: any) => ({
    pg: { id: pg.id, metodo: pg.metodo, status: pg.status, valor: Number(pg.valor), pagoEm: pg.pago_em },
    pedido: { id: pg.pedidos?.id, codigo: pg.pedidos?.codigo, compradorNome: pg.pedidos?.comprador_nome, status: pg.pedidos?.status, createdAt: pg.pedidos?.created_at }
  }));

  const porMetodo = new Map<string, { qtd: number; valor: number }>();
  for (const p of pags) {
    const m = porMetodo.get(p.pg.metodo) ?? { qtd: 0, valor: 0 };
    porMetodo.set(p.pg.metodo, { qtd: m.qtd + 1, valor: m.valor + p.pg.valor });
  }

  const dinheiro = porMetodo.get("DINHEIRO")?.valor ?? 0;
  const movimentos = ((caixa as any).caixa_movimentos as any[]) || [];
  const suprimentos = movimentos.filter(m => m.tipo === "SUPRIMENTO").reduce((s, m) => s + Number(m.valor), 0);
  const sangrias = movimentos.filter(m => m.tipo === "SANGRIA").reduce((s, m) => s + Number(m.valor), 0);
  const esperado = Number(caixa.valor_abertura) + dinheiro + suprimentos - sangrias;
  const vendido = pags.reduce((s, x) => s + x.pg.valor, 0);

  return {
    pagamentos: pags,
    porMetodo: Array.from(porMetodo.entries()).map(([metodo, v]) => ({ metodo, ...v })),
    dinheiro,
    suprimentos,
    sangrias,
    esperado,
    vendido,
    diferenca: caixa.valor_fechamento ? Number(caixa.valor_fechamento) - esperado : undefined,
  };
}

export async function listarCaixasAbertos() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("caixa_sessoes")
    .select("*, perfis(nome)")
    .is("fechado_em", null);
  
  if (!data) return [];
  return data.map((c: any) => ({
    id: c.id,
    usuarioId: c.usuario_id,
    abertoEm: c.aberto_em,
    usuarioNome: c.perfis?.nome
  }));
}

export async function ultimosCaixasFechados(usuarioId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("caixa_sessoes")
    .select("*")
    .eq("usuario_id", usuarioId)
    .not("fechado_em", "is", null)
    .order("fechado_em", { ascending: false })
    .limit(5);
  
  if (!data) return [];
  return data.map((c: any) => ({
    id: c.id,
    fechadoEm: c.fechado_em,
    valorContado: Number(c.valor_fechamento)
  }));
}

export async function abrirCaixa(usuarioId: string, valorAbertura: number) {
  const supabase = await createClient();
  
  // Verify user is from current empresa
  const { data: userData } = await supabase.from("perfis").select("empresa_id").eq("id", usuarioId).single();
  if (!userData?.empresa_id) return { ok: false as const, erro: "Empresa não encontrada" };

  const admin = createAdminClient();
  const { data, error } = await admin.from("caixa_sessoes" as any).insert({
    usuario_id: usuarioId,
    empresa_id: userData.empresa_id,
    valor_abertura: valorAbertura
  }).select().single();

  if (error) return { ok: false as const, erro: error.message };
  return { ok: true as const, caixa: { id: (data as any).id } };
}

export async function movimentarCaixa(usuarioId: string, tipo: string, valor: number, observacao: string) {
  const aberto = await caixaAberto(usuarioId);
  if (!aberto) return { ok: false as const, erro: "Nenhum caixa aberto." };

  const admin = createAdminClient();
  const { error } = await admin.from("caixa_movimentos" as any).insert({
    caixa_id: aberto.id,
    tipo,
    valor,
    observacao
  });

  if (error) return { ok: false as const, erro: error.message };
  return { ok: true as const };
}

export async function fecharCaixa(usuarioId: string, valorContado: number, observacao: string) {
  const aberto = await caixaAberto(usuarioId);
  if (!aberto) return { ok: false as const, erro: "Nenhum caixa aberto." };

  const admin = createAdminClient();
  const { data, error } = await admin.from("caixa_sessoes").update({
    valor_fechamento: valorContado,
    observacao: observacao || null,
    fechado_em: new Date().toISOString()
  }).eq("id", aberto.id).select().single();

  if (error) return { ok: false as const, erro: error.message };
  return { ok: true as const, caixa: { id: data.id } };
}
