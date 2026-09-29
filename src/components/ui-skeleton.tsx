/** Blocos cinza pulsantes: mostram a forma da página enquanto os dados chegam */
export function Bloco({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} aria-hidden />;
}

export function EsqueletoPagina({ cards = 3, tabela = true }: { cards?: number; tabela?: boolean }) {
  return (
    <div role="status" aria-label="Carregando">
      <Bloco className="mb-2 h-8 w-64" />
      <Bloco className="mb-6 h-4 w-96 max-w-full" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <Bloco key={i} className="h-24" />
        ))}
      </div>
      {tabela && <Bloco className="h-72" />}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
