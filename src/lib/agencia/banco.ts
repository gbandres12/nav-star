import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin";

/**
 * Cliente do portal das agências: service role, só no servidor. As tabelas e funções de agências
 * ainda não estão em database.types.ts (gerado antes das migrações), por isso o cliente é sem tipos.
 */
export function bancoAgencia() {
  return createAdminClient() as unknown as SupabaseClient;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Empresa do portal: a do link (?empresa=<id>) ou, se o link não trouxer e só houver uma empresa, ela */
export async function empresaDoPortal(param?: string | null) {
  const banco = bancoAgencia();
  if (param) {
    if (!UUID.test(param)) return null;
    const { data } = await banco.from("empresas").select("id, nome_fantasia").eq("id", param).maybeSingle();
    return data ? { id: data.id as string, nome: data.nome_fantasia as string } : null;
  }
  const { data } = await banco.from("empresas").select("id, nome_fantasia").limit(2);
  return data?.length === 1 ? { id: data[0].id as string, nome: data[0].nome_fantasia as string } : null;
}
