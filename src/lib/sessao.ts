import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { podeAcessar } from "./permissoes";
import { db, usuario } from "./store";
import type { PapelUsuario } from "./types";

import { usuarioAtual } from "./auth";

// Operador atual do painel integrado com Supabase Auth (etapa B8).
// Prioriza a sessão real do Supabase Auth; se não houver (ex.: dev local), recorre ao cookie simulador.
export const COOKIE_OPERADOR = "navstar_operador";

export async function operadorAtual() {
  const realUser = await usuarioAtual();
  if (realUser?.ativo) return realUser;

  const id = (await cookies()).get(COOKIE_OPERADOR)?.value;
  const u = usuario(id);
  return u?.ativo ? u : db().usuarios.find((x) => x.papel === "ADMIN" && x.ativo)!;
}

/** Para páginas: redireciona quem não tem acesso à rota */
export async function garantirAcesso(rota: string) {
  const op = await operadorAtual();
  if (!podeAcessar(op.papel, rota)) redirect("/admin/sem-acesso");
  return op;
}

/** Para server actions: devolve o operador ou uma mensagem de erro */
export async function exigirPapel(...papeis: PapelUsuario[]) {
  const op = await operadorAtual();
  return papeis.includes(op.papel) ? { op } : { erro: "Seu perfil não tem permissão para esta ação." };
}
