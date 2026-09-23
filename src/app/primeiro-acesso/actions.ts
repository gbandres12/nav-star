"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function definirSenhaPrimeiroAcessoAction(
  _prevState: { erro?: string; ok?: string } | null,
  formData: FormData
) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const telefone = (formData.get("telefone") as string)?.trim();

  if (!password || password.length < 6) {
    return { erro: "A senha deve ter pelo menos 6 caracteres." };
  }

  if (password !== confirmPassword) {
    return { erro: "As senhas digitadas não coincidem." };
  }

  const supabase = await createClient();

  // 1. Atualiza a senha no Supabase Auth
  const { error: updateAuthError } = await supabase.auth.updateUser({
    password,
  });

  if (updateAuthError) {
    return { erro: `Falha ao salvar senha: ${updateAuthError.message}` };
  }

  // 2. Registra o passo 1 do onboarding e telefone na base
  const { error: rpcError } = await supabase.rpc("atualizar_onboarding", {
    p_passo: 1,
    p_concluido: false,
    p_telefone: telefone || undefined,
  });

  if (rpcError) {
    console.warn("Aviso ao atualizar perfil no primeiro acesso:", rpcError.message);
  }

  redirect("/admin?bemvindo=1");
}

export async function solicitarRecuperacaoAction(
  _prevState: { erro?: string; ok?: string } | null,
  formData: FormData
) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { erro: "Por favor, digite um e-mail válido." };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = `${origin}/auth/confirm?next=/primeiro-acesso`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { erro: `Erro ao enviar link: ${error.message}` };
  }

  return {
    ok: "Se o e-mail estiver cadastrado, você receberá as instruções em instantes.",
  };
}
