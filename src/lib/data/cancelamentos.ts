import "server-only";
import { createClient } from "../supabase/server";

import { Cancelamento } from "../types";

export interface CancelamentoComDetalhes extends Cancelamento {
  pedido?: {
    codigo?: string;
    compradorNome?: string;
  };
  usuario?: {
    nome?: string;
  };
}

type DbCancelamentoJoin = {
  id: string;
  pedido_id: string;
  passagem_ids: string[] | null;
  motivo: string;
  valor_pago: number | string;
  multa: number | string;
  reembolso: number | string;
  usuario_id: string | null;
  created_at: string;
  pedidos: { id: string; codigo: string; comprador_nome: string } | null;
  perfis: { id: string; nome: string } | null;
};

export async function listarCancelamentos(inicio: Date, fim: Date): Promise<CancelamentoComDetalhes[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cancelamentos")
    .select(`
      id,
      pedido_id,
      passagem_ids,
      motivo,
      valor_pago,
      multa,
      reembolso,
      usuario_id,
      created_at,
      pedidos ( id, codigo, comprador_nome ),
      perfis ( id, nome )
    `)
    .gte("created_at", inicio.toISOString())
    .lt("created_at", fim.toISOString())
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as DbCancelamentoJoin[]).map((c) => ({
    id: c.id,
    pedidoId: c.pedido_id,
    passagemIds: c.passagem_ids || [],
    motivo: c.motivo,
    valorPago: Number(c.valor_pago),
    multa: Number(c.multa),
    reembolso: Number(c.reembolso),
    usuarioId: c.usuario_id || undefined,
    createdAt: c.created_at,
    pedido: {
      codigo: c.pedidos?.codigo,
      compradorNome: c.pedidos?.comprador_nome,
    },
    usuario: {
      nome: c.perfis?.nome,
    },
  }));
}
