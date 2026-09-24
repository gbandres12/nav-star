import "server-only";
import { headers } from "next/headers";

/** Endereço público do site: NEXT_PUBLIC_SITE_URL, ou o domínio pelo qual a pessoa está acessando */
export async function origemDoSite() {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Link de convite/recuperação que funciona em qualquer aparelho: leva o token para /auth/confirm, que valida no
 * servidor (verifyOtp) e abre a sessão. Não depende do código guardado no navegador (PKCE) nem das Redirect URLs.
 */
export function linkDeAcesso(origem: string, hashedToken: string, tipo: "invite" | "recovery") {
  return `${origem}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=${tipo}&next=/primeiro-acesso`;
}
