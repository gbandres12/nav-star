import "server-only";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { mapPassagem, mapPedido, type DbPagamento } from "./map";
import type { CanalVenda, MetodoPagamento, Passagem, Pedido, StatusPassagem, StatusPedido, TipoPassageiro } from "../types";
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

/**
 * Confirma o pagamento (webhook do gateway ou conferência manual do PIX no painel).
 * Usa a chave do servidor: a RPC só aceita service_role. Quem chama precisa ter checado o papel antes.
 */
export async function confirmarPagamento(codigo?: string, gatewayId?: string) {
  const { data, error } = await createAdminClient().rpc("confirmar_pagamento", {
    p_codigo: codigo || undefined,
    p_gateway_id: gatewayId || undefined,
  });

  if (error) {
    return { ok: false as const, erro: error.message };
  }
  return { ok: true as const, data };
}

// ─── Pedido visto pelo cliente (sem login) ─────────────────────────────────────

export type PassagemPublica = {
  id: string;
  nome: string;
  documento: string; // mascarado pelo banco
  tipo: TipoPassageiro;
  status: StatusPassagem;
  valor: number;
  taxaEmbarque: number;
  qrToken: string;
  assento: string; // código da poltrona ou "COLO"
  embarcacao: string;
  saida: string;
  chegada: string;
  duracaoMin: number;
  origemCidade: string;
  origemUf: string;
  origemSigla: string;
  portoEmbarque: string;
  destinoCidade: string;
  destinoUf: string;
  destinoSigla: string;
};

export type PedidoPublico = {
  id: string;
  codigo: string;
  numero: string;
  canal: CanalVenda;
  status: StatusPedido;
  compradorNome: string;
  compradorEmail?: string;
  compradorTelefone: string;
  subtotal: number;
  taxas: number;
  total: number;
  expiraEm?: string;
  pagamentoInformadoEm?: string;
  createdAt: string;
  pagamento: { metodo: MetodoPagamento; status: string; pagoEm?: string };
  passagens: PassagemPublica[];
};

type Bruto = Record<string, unknown>;
const texto = (v: unknown) => (v == null ? "" : String(v));

/** Pedido pela função pública do banco (documento mascarado); serve ao cliente, ao bilhete e ao painel */
export async function pedidoCompleto(codigo: string): Promise<PedidoPublico | null> {
  const d = (await pedidoPublico(codigo)) as Bruto | null;
  if (!d) return null;
  const pg = (d.pagamento ?? {}) as Bruto;
  return {
    id: texto(d.id),
    codigo: texto(d.codigo),
    numero: texto(d.numero),
    canal: d.canal as CanalVenda,
    status: d.status as StatusPedido,
    compradorNome: texto(d.compradorNome),
    compradorEmail: texto(d.compradorEmail) || undefined,
    compradorTelefone: texto(d.compradorTelefone),
    subtotal: Number(d.subtotal),
    taxas: Number(d.taxas),
    total: Number(d.total),
    expiraEm: texto(d.expiraEm) || undefined,
    pagamentoInformadoEm: texto(d.pagamentoInformadoEm) || undefined,
    createdAt: texto(d.createdAt),
    pagamento: { metodo: (pg.metodo as MetodoPagamento) ?? "PIX", status: texto(pg.status), pagoEm: texto(pg.pagoEm) || undefined },
    passagens: ((d.passagens ?? []) as Bruto[]).map((p) => ({
      id: texto(p.id),
      nome: texto(p.nome),
      documento: texto(p.documento),
      tipo: p.tipo as TipoPassageiro,
      status: p.status as StatusPassagem,
      valor: Number(p.valor),
      taxaEmbarque: Number(p.taxaEmbarque),
      qrToken: texto(p.qrToken),
      assento: texto(p.assento),
      embarcacao: texto(p.embarcacao),
      saida: texto(p.saida),
      chegada: texto(p.chegada),
      duracaoMin: Number(p.duracaoMin),
      origemCidade: texto(p.origemCidade),
      origemUf: texto(p.origemUf),
      origemSigla: texto(p.origemSigla),
      portoEmbarque: texto(p.portoEmbarque),
      destinoCidade: texto(p.destinoCidade),
      destinoUf: texto(p.destinoUf),
      destinoSigla: texto(p.destinoSigla),
    })),
  };
}

/** Cliente avisou que pagou: o banco segura a reserva até a conferência */
export async function informarPagamento(codigo: string) {
  const supabase = (await createClient()) as unknown as DynamicRpcClient;
  const { error } = await supabase.rpc("informar_pagamento", { codigo: codigo.toUpperCase().trim() });
  return error ? { ok: false as const, erro: error.message } : { ok: true as const };
}

export async function pedidosAdmin(params?: {
  busca?: string;
  status?: string;
  canal?: string;
  aConferir?: boolean; // PIX informado pelo cliente, esperando a equipe
  pagina?: number;
  limite?: number;
}) {
  const supabase = await createClient();
  const pagina = params?.pagina || 1;
  const limite = params?.limite || 25;
  const offset = (pagina - 1) * limite;

  let query = supabase.from("pedidos").select(`*, pagamentos (*)`, { count: "exact" });

  if (params?.aConferir) {
    query = query.eq("status", "AGUARDANDO_PAGAMENTO").not("pagamento_informado_em" as never, "is", null);
  } else if (params?.status && params.status !== "TODOS") {
    query = query.eq("status", params.status as DbStatusPedido);
  }
  if (params?.canal) query = query.eq("canal", params.canal as CanalVenda);

  if (params?.busca) {
    // Vírgula e parênteses quebram a sintaxe do filtro "or"
    const b = params.busca.trim().replace(/[,()]/g, " ");
    query = query.or(`codigo.ilike.%${b}%,comprador_nome.ilike.%${b}%,numero.ilike.%${b}%,comprador_telefone.ilike.%${b}%`);
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

/** Quantos pedidos do site têm PIX informado esperando conferência (aviso no painel) */
export async function pedidosAConferir() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("status", "AGUARDANDO_PAGAMENTO")
    .not("pagamento_informado_em" as never, "is", null);
  return count ?? 0;
}

/** Primeira passagem de cada pedido (trecho e viagem) e a quantidade de passageiros */
export async function resumoPassagens(pedidoIds: string[]) {
  const resumo = new Map<string, { quantidade: number; viagemId: string; linhaId: string; partida: string; origemOrdem: number; destinoOrdem: number }>();
  if (pedidoIds.length === 0) return resumo;
  const supabase = await createClient();
  const { data } = await supabase
    .from("passagens")
    .select("pedido_id, origem_ordem, destino_ordem, viagem:viagens(id, linha_id, partida)")
    .in("pedido_id", pedidoIds);
  for (const p of (data ?? []) as unknown as { pedido_id: string; origem_ordem: number; destino_ordem: number; viagem: { id: string; linha_id: string; partida: string } | null }[]) {
    const atual = resumo.get(p.pedido_id);
    if (atual) atual.quantidade++;
    else if (p.viagem)
      resumo.set(p.pedido_id, {
        quantidade: 1,
        viagemId: p.viagem.id,
        linhaId: p.viagem.linha_id,
        partida: p.viagem.partida,
        origemOrdem: p.origem_ordem,
        destinoOrdem: p.destino_ordem,
      });
  }
  return resumo;
}
