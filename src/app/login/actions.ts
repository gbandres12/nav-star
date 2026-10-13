"use server";

import { redirect } from "next/navigation";
import { destinoSeguro } from "@/lib/destino-seguro";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(
  _prevState: { erro?: string } | null,
  formData: FormData
) {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/admin";

  if (!email || !password) {
    return { erro: "Por favor, preencha o e-mail e a senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { erro: "E-mail ou senha incorretos. Verifique suas credenciais." };
  }

  redirect(destinoSeguro(redirectTo, "/admin"));
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
