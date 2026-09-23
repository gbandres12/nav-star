import "server-only";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { mapPassagem, mapPedido, type DbPagamento } from "./map";
import type { Passagem, Pedido } from "../types";
import type { Database, Json } from "../supabase/database.types";

type DbStatusPedido = Database["public"]["Enums"]["status_pedido"];

type DynamicRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function criarPedidoSite(payload: {
  viagemId: string;
  origemOrdem: number;
  destinoOrdem: number;
  compradorNome: string;
  compradorEmail?: string;
  compradorTelefone: string;
  metodoPagamento?: string;
  passageiros: Array<{
    nome: string;
    documento: string;
    telefone?: string;
    tipo?: string;
    assentoId?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_pedido_site", {
    payload: {
      viagem_id: payload.viagemId,
      origem_ordem: payload.origemOrdem,
      destino_ordem: payload.destinoOrdem,
      comprador_nome: payload.compradorNome,
      comprador_email: payload.compradorEmail,
      comprador_telefone: payload.compradorTelefone,
      metodo_pagamento: payload.metodoPagamento || "PIX",
      passageiros: payload.passageiros.map((p) => ({
        nome: p.nome,
        documento: p.documento,
        telefone: p.telefone,
        tipo: p.tipo || "INTEIRA",
        assento_id: p.assentoId || null,
      })),
    } as unknown as Json,
  });

  if (error) {
    return { ok: false as const, erro: error.message };
  }
  const res = data as { codigo: string; id: string };
  return { ok: true as const, codigo: res.codigo, id: res.id };
}

export async function criarPedidoBalcao(payload: {
  viagemId: string;
  origemOrdem: number;
  destinoOrdem: number;
  compradorNome: string;
  compradorEmail?: string;
  compradorTelefone: string;
  metodoPagamento?: string;
  passageiros: Array<{
    nome: string;
    documento: string;
    telefone?: string;
    tipo?: string;
    assentoId?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("criar_pedido_balcao", {
    payload: {
      viagem_id: payload.viagemId,
      origem_ordem: payload.origemOrdem,
      destino_ordem: payload.destinoOrdem,
      comprador_nome: payload.compradorNome,
      comprador_email: payload.compradorEmail,
      comprador_telefone: payload.compradorTelefone,
      metodo_pagamento: payload.metodoPagamento || "DINHEIRO",
      passageiros: payload.passageiros.map((p) => ({
        nome: p.nome,
        documento: p.documento,
        telefone: p.telefone,
        tipo: p.tipo || "INTEIRA",
        assento_id: p.assentoId || null,
      })),
    } as unknown as Json,
  });

  if (error) {
    return { ok: false as const, erro: error.message };
  }
  const res = data as { codigo: string; id: string };
  return { ok: true as const, codigo: res.codigo, id: res.id };
}

export async function pedidoPublico(codigo: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pedido_publico", {
    codigo: codigo.toUpperCase().trim(),
  });

  if (error || !data) return null;
  return data;
}

export async function pedidoPorCodigo(codigo: string): Promise<Pedido | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pedidos")
    .select(`*, pagamentos (*)`)
    .eq("codigo", codigo.toUpperCase().trim())
    .maybeSingle();

  if (!data) return null;
  return mapPedido(data, (data.pagamentos as unknown as DbPagamento[]) || []);
}

export async function passagensDoPedido(pedidoId: string): Promise<Passagem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("passagens")
    .select("*")
    .eq("pedido_id", pedidoId)
    .order("origem_ordem");

  if (error || !data) return [];
  return data.map(mapPassagem);
}

export async function cancelarPedido(codigo: string, motivo?: string) {
  const supabase = await createClient();
  const dynamicClient = supabase as unknown as DynamicRpcClient;
  const { data, error } = await dynamicClient.rpc("cancelar_pedido", {
    codigo: codigo.toUpperCase().trim(),
    motivo: motivo || null,
  });

  if (error) {
    return { ok: false as const, erro: error.message };
  }
  return { ok: true as const, data };
}

export async function validarEmbarque(qrToken: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validar_embarque", {
    qr_token: qrToken.trim(),
  });

  if (error) {
    return { ok: false as const, erro: error.message };
  }
  return { ok: true as const, resultado: data };
}

export async function confirmarPagamento(codigo?: string, gatewayId?: string) {
  // Chamado no webhook ou na simulação de desenvolvimento
  const isDev = process.env.PAGAMENTO_SIMULADO === "true";
  const client = isDev ? createAdminClient() : await createClient();

  const { data, error } = await client.rpc("confirmar_pagamento", {
    p_codigo: codigo || undefined,
    p_gateway_id: gatewayId || undefined,
  });

  if (error) {
    return { ok: false as const, erro: error.message };
  }
  return { ok: true as const, data };
}

export async function pedidosAdmin(params?: {
  busca?: string;
  status?: string;
  pagina?: number;
  limite?: number;
}) {
  const supabase = await createClient();
  const pagina = params?.pagina || 1;
  const limite = params?.limite || 25;
  const offset = (pagina - 1) * limite;

  let query = supabase.from("pedidos").select(`*, pagamentos (*)`, { count: "exact" });

  if (params?.status && params.status !== "TODOS") {
    query = query.eq("status", params.status as DbStatusPedido);
  }

  if (params?.busca) {
    const b = params.busca.trim();
    query = query.or(`codigo.ilike.%${b}%,comprador_nome.ilike.%${b}%,numero.ilike.%${b}%`);
  }

  query = query.order("created_at", { ascending: false }).range(offset, offset + limite - 1);

  const { data, count, error } = await query;
  if (error || !data) return { pedidos: [], total: 0, paginas: 1 };

  return {
    pedidos: data.map((p) => mapPedido(p, (p.pagamentos as unknown as DbPagamento[]) || [])),
    total: count || 0,
    paginas: Math.ceil((count || 0) / limite) || 1,
  };
}
