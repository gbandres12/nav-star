import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { PapelUsuario, Usuario } from "./types";
import { mapUsuario } from "./data/map";

// cache: uma única consulta por requisição, mesmo com várias chamadas (layout, página, dados)
export const usuarioAtual = cache(async (): Promise<Usuario | null> => {
  const supabase = await createClient();

  // getClaims valida o JWT localmente (sem ida ao servidor de Auth a cada chamada)
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const user = claims?.claims ? { id: claims.claims.sub, email: claims.claims.email as string | undefined } : null;

  if (authError || !user) return null;

  const { data: perfil, error: perfilError } = await supabase
    .from("perfis")
    .select(`*, perfis_linhas (*)`)
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError || !perfil || !perfil.ativo) return null;

  // Atualiza último acesso fora do caminho da resposta e no máximo a cada 5 minutos
  const ultimo = perfil.ultimo_acesso ? new Date(perfil.ultimo_acesso).getTime() : 0;
  if (Date.now() - ultimo > 5 * 60_000) {
    after(async () => {
      await supabase.from("perfis").update({ ultimo_acesso: new Date().toISOString() }).eq("id", user.id);
    });
  }

  const linhas = ((perfil.perfis_linhas as unknown as Array<{ linha_id: string }>) || []).map(
    (pl) => pl.linha_id
  );
  return mapUsuario(perfil, linhas, user.email || "");
});

export async function exigirPapel(...papeis: PapelUsuario[]): Promise<Usuario> {
  const usuario = await usuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  if (papeis.length > 0 && !papeis.includes(usuario.papel)) {
    redirect("/admin");
  }

  return usuario;
}
