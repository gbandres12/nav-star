import "server-only";
import { createClient } from "../supabase/server";

export async function listarCancelamentos(inicio: Date, fim: Date): Promise<any[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
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

  return data.map((c: any) => ({
    id: c.id,
    pedidoId: c.pedido_id,
    passagemIds: c.passagem_ids,
    motivo: c.motivo,
    valorPago: Number(c.valor_pago),
    multa: Number(c.multa),
    reembolso: Number(c.reembolso),
    usuarioId: c.usuario_id,
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
