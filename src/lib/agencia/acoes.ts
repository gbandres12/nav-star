"use server";

import { redirect } from "next/navigation";
import { dentroDoLimite, LIMITES, MSG_LIMITE } from "../limite";
import { bancoAgencia, empresaDoPortal, UUID } from "./banco";
import { conferirSenha, hashSenha } from "./senha";
import { abrirSessaoAgencia, agenciaAtual, encerrarSessaoAgencia } from "./sessao";
import type { Estado } from "../admin-actions";

const campo = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cadastro público: a agência nasce PENDENTE e só vende depois que a empresa aprovar */
export async function cadastrarAgenciaAction(_: Estado, form: FormData): Promise<Estado> {
  if (!(await dentroDoLimite(LIMITES.cadastroAgencia))) return { erro: MSG_LIMITE };

  const empresaId = campo(form, "empresaId");
  const nome = campo(form, "nome");
  const responsavel = campo(form, "responsavel");
  const email = campo(form, "email").toLowerCase();
  const telefone = campo(form, "telefone");
  const documento = campo(form, "documento").replace(/[^0-9A-Za-z]/g, "");
  const senha = String(form.get("senha") ?? "");

  if (!UUID.test(empresaId) || !(await empresaDoPortal(empresaId))) return { erro: "Link de cadastro inválido. Peça um novo à empresa." };
  if (nome.length < 2) return { erro: "Informe o nome da agência." };
  if (responsavel.length < 2) return { erro: "Informe o nome do responsável." };
  if (!EMAIL.test(email)) return { erro: "Informe um e-mail válido." };
  if (telefone.replace(/\D/g, "").length < 10) return { erro: "Informe o telefone com DDD." };
  if (documento && documento.length !== 11 && documento.length !== 14) return { erro: "CPF ou CNPJ inválido." };
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha !== String(form.get("confirmar") ?? "")) return { erro: "As senhas não conferem." };

  const { error } = await bancoAgencia().from("agencias_parceiras").insert({
    empresa_id: empresaId,
    nome,
    responsavel,
    email,
    telefone,
    documento: documento || null,
    senha_hash: await hashSenha(senha),
  });
  if (error) {
    if (error.code === "23505") return { erro: "Já existe um cadastro com este e-mail." };
    console.error("[agencia] cadastro:", error.message);
    return { erro: "Não foi possível enviar o cadastro agora. Tente novamente." };
  }
  return { ok: "Cadastro enviado! Assim que a empresa aprovar, você poderá entrar e vender." };
}

const MSG_GENERICA = "Não foi possível entrar. Confira e-mail e senha, ou tente de novo em alguns minutos.";
const MSG_STATUS: Record<string, string> = {
  PENDENTE: "Seu cadastro ainda está em análise pela empresa. Você será liberada assim que for aprovada.",
  SUSPENSA: "O acesso desta agência está suspenso. Fale com a empresa.",
  RECUSADA: "O cadastro desta agência não foi aprovado. Fale com a empresa.",
};

export async function entrarAgenciaAction(_: Estado, form: FormData): Promise<Estado> {
  if (!(await dentroDoLimite(LIMITES.loginAgencia))) return { erro: MSG_LIMITE };

  const empresaId = campo(form, "empresaId");
  const email = campo(form, "email").toLowerCase();
  const senha = String(form.get("senha") ?? "");
  if (!UUID.test(empresaId) || !email || !senha) return { erro: MSG_GENERICA };

  const banco = bancoAgencia();
  // e-mail é gravado em minúsculas no cadastro; o índice único é sobre lower(email)
  const { data: ag } = await banco
    .from("agencias_parceiras")
    .select("id, empresa_id, senha_hash, status, bloqueado_ate")
    .eq("empresa_id", empresaId)
    .eq("email", email)
    .maybeSingle();

  // Bloqueada: não confere a senha (não conta nova tentativa) e responde igual a qualquer outra falha
  if (ag?.bloqueado_ate && new Date(ag.bloqueado_ate).getTime() > Date.now()) {
    await conferirSenha(senha, null);
    return { erro: MSG_GENERICA };
  }

  const confere = await conferirSenha(senha, ag?.senha_hash);
  if (!ag || !confere) {
    if (ag) await banco.rpc("agencia_login_falha", { p_id: ag.id });
    return { erro: MSG_GENERICA };
  }

  // Senha correta: só agora é seguro dizer em que pé está o cadastro
  if (ag.status !== "APROVADA") return { erro: MSG_STATUS[ag.status] ?? MSG_GENERICA };

  await banco.rpc("agencia_login_ok", { p_id: ag.id });
  await abrirSessaoAgencia(ag.id, ag.empresa_id);
  redirect("/agencia/painel");
}

export async function sairAgenciaAction() {
  const ag = await agenciaAtual();
  await encerrarSessaoAgencia();
  redirect(ag ? `/agencia?empresa=${ag.empresaId}` : "/agencia");
}
