import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { PapelUsuario, Usuario } from "./types";
import { mapUsuario } from "./data/map";

export async function usuarioAtual(): Promise<Usuario | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: perfil, error: perfilError } = await supabase
    .from("perfis")
    .select(`*, perfis_linhas (*)`)
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError || !perfil || !perfil.ativo) return null;

  // Atualiza último acesso silenciosamente
  await supabase
    .from("perfis")
    .update({ ultimo_acesso: new Date().toISOString() })
    .eq("id", user.id);

  const linhas = ((perfil.perfis_linhas as unknown as Array<{ linha_id: string }>) || []).map(
    (pl) => pl.linha_id
  );
  return mapUsuario(perfil, linhas, user.email || "");
}

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
