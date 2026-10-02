import "server-only";

/** Botão de teste: só máquina local, nunca produção nem preview público da Vercel. */
export function pixSimuladoPermitido() {
  if (process.env.PAGAMENTO_SIMULADO !== "true") return false;
  if (process.env.NODE_ENV === "production") return false;
  const vercel = process.env.VERCEL_ENV;
  if (vercel === "production" || vercel === "preview") return false;
  return true;
}
