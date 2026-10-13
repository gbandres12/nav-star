"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { destinoSeguro } from "@/lib/destino-seguro";
import { createClient } from "@/lib/supabase/server";

const TIPOS: EmailOtpType[] = ["invite", "recovery", "magiclink", "signup", "email"];

/** Valida o link de uso único quando a pessoa toca em "Continuar" (e não quando um robô abre a página) */
export async function confirmarAcessoAction(form: FormData) {
  const tokenHash = String(form.get("token_hash") ?? "");
  const tipo = String(form.get("type") ?? "") as EmailOtpType;
  const next = destinoSeguro(String(form.get("next") ?? "/primeiro-acesso"), "/primeiro-acesso");
  const supabase = await createClient();

  if (tokenHash && TIPOS.includes(tipo)) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) redirect(next);
  }

  // Link já usado ou vencido: se a sessão já está aberta neste navegador, segue mesmo assim
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next);
  redirect("/acesso?erro=link");
}
