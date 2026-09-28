import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Entrada dos links de convite e de recuperação de senha.
 * Link com token_hash NÃO é validado aqui: leva para /acesso, onde a pessoa toca em "Continuar". O token é de uso
 * único, e WhatsApp, e-mail (ex.: Outlook) e navegadores abrem links sozinhos para gerar prévia ou checar segurança —
 * se a validação fosse no GET, o robô gastaria o token e a pessoa cairia em "link inválido".
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") || "/primeiro-acesso";
  const code = searchParams.get("code");

  if (token_hash && type) {
    const destino = new URL("/acesso", request.url);
    destino.search = new URLSearchParams({ token_hash, type, next }).toString();
    return NextResponse.redirect(destino);
  }

  const supabase = await createClient();

  // Link no formato antigo do Supabase (?code=): só funciona no mesmo navegador em que foi pedido
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  // Se já estiver logado, prossegue para o primeiro acesso
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(new URL(next, request.url));

  return NextResponse.redirect(new URL("/login?erro=link_invalido", request.url));
}
