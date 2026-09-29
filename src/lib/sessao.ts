import "server-only";
import { redirect } from "next/navigation";
import { podeAcessar } from "./permissoes";
import type { PapelUsuario } from "./types";

import { usuarioAtual } from "./auth";

// Operador atual: só vale a sessão real do Supabase Auth (server actions podem ser chamadas de qualquer rota, sem passar pelo proxy)
async function operadorOuNulo() {
  const u = await usuarioAtual();
  return u?.ativo ? u : null;
}

/** Para páginas e rotas: sem sessão, manda para o login */
export async function operadorAtual() {
  const op = await operadorOuNulo();
  if (!op) redirect("/login");
  return op;
}

/** Para páginas: redireciona quem não tem acesso à rota */
export async function garantirAcesso(rota: string) {
  const op = await operadorAtual();
  if (!podeAcessar(op.papel, rota)) redirect("/admin/sem-acesso");
  return op;
}

/** Para server actions: devolve o operador ou uma mensagem de erro */
export async function exigirPapel(...papeis: PapelUsuario[]) {
  const op = await operadorOuNulo();
  if (!op) return { erro: "Sua sessão expirou. Entre novamente." } as const;
  return papeis.includes(op.papel) ? { op } : { erro: "Seu perfil não tem permissão para esta ação." };
}
