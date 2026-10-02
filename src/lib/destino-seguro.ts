/** Só caminhos internos (evita redirecionar para outro site, inclusive `//evil.com`). */
export function destinoSeguro(next: string, fallback: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
