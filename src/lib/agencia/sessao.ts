import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { bancoAgencia } from "./banco";

// Sessão da agência: token assinado (HMAC-SHA256) num cookie httpOnly. Independente do Supabase Auth:
// a agência nunca vira usuário nem membro da empresa. O token só identifica; a cada chamada o banco é
// consultado de novo e a agência precisa continuar APROVADA.
export const COOKIE_AGENCIA = "agencia_sessao";
const VALIDADE_SEG = 12 * 60 * 60;

type Carga = { a: string; e: string; exp: number };

function segredo() {
  const s = process.env.AGENCIA_SESSAO_SECRET;
  if (!s || s.length < 32) throw new Error("AGENCIA_SESSAO_SECRET não configurada (mínimo 32 caracteres).");
  return s;
}

const assinar = (corpo: string) => createHmac("sha256", segredo()).update(corpo).digest("base64url");

function emitir(carga: Carga) {
  const corpo = Buffer.from(JSON.stringify(carga)).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

function ler(token: string | undefined): Carga | null {
  const [corpo, assinatura, ...resto] = token?.split(".") ?? [];
  if (!corpo || !assinatura || resto.length) return null;
  const esperada = Buffer.from(assinar(corpo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  try {
    const c = JSON.parse(Buffer.from(corpo, "base64url").toString()) as Carga;
    return typeof c.a === "string" && typeof c.e === "string" && c.exp > Date.now() / 1000 ? c : null;
  } catch {
    return null;
  }
}

export async function abrirSessaoAgencia(agenciaId: string, empresaId: string) {
  (await cookies()).set(COOKIE_AGENCIA, emitir({ a: agenciaId, e: empresaId, exp: Math.floor(Date.now() / 1000) + VALIDADE_SEG }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/agencia",
    maxAge: VALIDADE_SEG,
  });
}

export async function encerrarSessaoAgencia() {
  (await cookies()).delete({ name: COOKIE_AGENCIA, path: "/agencia" });
}

export type AgenciaLogada = { id: string; empresaId: string; nome: string; email: string };

/** Agência da sessão, só se o token vale e ela continua aprovada no banco. Uma consulta por requisição. */
export const agenciaAtual = cache(async (): Promise<AgenciaLogada | null> => {
  const carga = ler((await cookies()).get(COOKIE_AGENCIA)?.value);
  if (!carga) return null;
  const { data } = await bancoAgencia()
    .from("agencias_parceiras")
    .select("id, empresa_id, nome, email, status")
    .eq("id", carga.a)
    .eq("empresa_id", carga.e)
    .maybeSingle();
  if (!data || data.status !== "APROVADA") return null;
  return { id: data.id, empresaId: data.empresa_id, nome: data.nome, email: data.email };
});
