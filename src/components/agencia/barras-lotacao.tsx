import type { ParadaPortal, Trecho } from "@/lib/agencia/dados";

/** Uma barra por trecho (par de paradas consecutivas): quanto da capacidade já está ocupado */
export function BarrasLotacao({ trechos, paradas, destaque }: { trechos: Trecho[]; paradas: ParadaPortal[]; destaque?: { de: number; ate: number } }) {
  const nome = (o: number) => paradas.find((p) => p.ordem === o)?.nome ?? "—";
  return (
    <ul className="space-y-2">
      {trechos.map((t) => {
        const pct = t.capacidade ? Math.min(100, Math.round((t.ocupados / t.capacidade) * 100)) : 100;
        const cor = t.livres === 0 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
        const emFoco = destaque && t.ordemOrigem >= destaque.de && t.ordemOrigem < destaque.ate;
        return (
          <li key={t.ordemOrigem} className={`rounded-lg px-2 py-1.5 ${emFoco ? "bg-rio-50 ring-1 ring-rio-200" : ""}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-medium text-slate-700">{nome(t.ordemOrigem)} → {nome(t.ordemDestino)}</span>
              <span className={`text-xs font-semibold tabular-nums ${t.livres === 0 ? "text-red-700" : "text-slate-600"}`}>
                {t.livres === 0 ? "Lotado" : `${t.livres} vaga${t.livres === 1 ? "" : "s"}`} · {t.ocupados}/{t.capacidade}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${t.ocupados} de ${t.capacidade} lugares ocupados`}>
              <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
