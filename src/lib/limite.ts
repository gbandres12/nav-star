import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

type Regra = { acao: string; max: number; janelaSeg: number };

/** Limites por IP. Folgados de propósito: nas cidades do interior muita gente sai pelo mesmo IP da operadora (CGNAT) */
export const LIMITES = {
  criarPedido: { acao: "criar-pedido", max: 20, janelaSeg: 600 },
  informarPagamento: { acao: "informar-pagamento", max: 40, janelaSeg: 600 },
  consultarPedido: { acao: "consultar-pedido", max: 120, janelaSeg: 60 },
} satisfies Record<string, Regra>;

export const MSG_LIMITE = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";

async function ipDoVisitante() {
  const h = await headers();
  // Na Vercel o x-forwarded-for é definido pela plataforma; o primeiro item é o cliente
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

/** true = pode seguir. A equipe logada não é limitada. Se o contador falhar, deixa passar (o banco continua se defendendo). */
export async function dentroDoLimite(regra: Regra) {
  const { data } = await (await createClient()).auth.getClaims();
  if (data?.claims?.sub) return true;

  const chave = `${regra.acao}:${await ipDoVisitante()}`;
  // checar_limite ainda não está em database.types.ts (gerado antes desta migração)
  const admin = createAdminClient() as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data: ok, error } = await admin.rpc("checar_limite", {
    p_chave: chave,
    p_max: regra.max,
    p_janela_seg: regra.janelaSeg,
  });
  if (error) {
    console.error("[limite] falha ao contar:", error.message);
    return true;
  }
  return ok !== false;
}
