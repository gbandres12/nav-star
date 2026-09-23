"use client";

import type { Assento } from "@/lib/types";

type Props = {
  assentos: Assento[];
  colunas: number;
  ocupados: Set<string> | string[];
  selecionados?: string[];
  onToggle?: (id: string) => void;
  labels?: Record<string, string>; // texto extra no tooltip (ex.: nome do passageiro)
};

/** Mapa da lancha na horizontal: proa à direita, fileiras da popa (esq.) para a proa */
export function SeatMap({ assentos, colunas, ocupados, selecionados = [], onToggle, labels }: Props) {
  const occ = ocupados instanceof Set ? ocupados : new Set(ocupados);
  const fileiras = Math.max(...assentos.map((a) => a.fileira));
  const byPos = new Map(assentos.map((a) => [`${a.fileira}-${a.coluna}`, a]));
  // Coluna do mapa (0..n) vira linha visual, de cima (lado D) para baixo (lado A)
  const linhasVisuais = Array.from({ length: colunas }, (_, i) => colunas - 1 - i);

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="relative inline-flex min-w-max items-stretch">
          {/* Casco */}
          <div className="rounded-l-[28px] rounded-r-[90px] border-2 border-rio-200 bg-gradient-to-b from-rio-50 to-white py-4 pr-16 pl-5">
            <div className="flex gap-3">
              <div className="flex flex-col justify-center gap-1 pr-1 text-[10px] font-bold text-rio-300">
                {linhasVisuais.map((c) => {
                  const any = assentos.find((a) => a.coluna === c);
                  return (
                    <span key={c} className="flex h-7 items-center">
                      {any ? any.codigo.replace(/\d+/, "") : ""}
                    </span>
                  );
                })}
              </div>
              {Array.from({ length: fileiras }, (_, f) => f + 1).map((f) => (
                <div key={f} className="flex flex-col gap-1">
                  {linhasVisuais.map((c) => {
                    const a = byPos.get(`${f}-${c}`);
                    if (!a) return <span key={c} className="flex h-7 w-7 items-center justify-center text-[9px] font-semibold text-rio-300">{c === 2 ? f : ""}</span>;
                    const ocupado = occ.has(a.id);
                    const sel = selecionados.includes(a.id);
                    const base = "h-7 w-7 rounded-md text-[9px] font-bold transition flex items-center justify-center";
                    const cls = ocupado
                      ? "bg-slate-300 text-slate-400 cursor-not-allowed"
                      : sel
                        ? "bg-rubro-500 text-white ring-2 ring-rubro-600 scale-110 shadow"
                        : a.tipo === "ESPECIAL"
                          ? "bg-rio-100 text-rio-700 border border-rio-300 hover:bg-rio-200"
                          : "bg-white text-slate-500 border border-slate-300 hover:border-rio-500 hover:text-rio-700";
                    const title = `Poltrona ${a.codigo}${a.tipo === "POLTRONA_JANELA" ? " · janela" : a.tipo === "ESPECIAL" ? " · preferencial" : ""}${ocupado ? " · ocupada" : ""}${labels?.[a.id] ? ` · ${labels[a.id]}` : ""}`;
                    return (
                      <button
                        key={c}
                        type="button"
                        title={title}
                        aria-label={title}
                        aria-pressed={sel}
                        disabled={ocupado || !onToggle}
                        onClick={() => onToggle?.(a.id)}
                        className={`${base} ${cls} ${!onToggle && !ocupado ? "cursor-default" : ""}`}
                      >
                        {a.codigo.replace(/\D/g, "")}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <span className="absolute top-1/2 right-6 -translate-y-1/2 text-[10px] font-bold tracking-widest text-rio-300 uppercase [writing-mode:vertical-rl]">Proa</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <Legend cls="bg-white border border-slate-300">Livre</Legend>
        <Legend cls="bg-rubro-500">Selecionada</Legend>
        <Legend cls="bg-slate-300">Ocupada</Legend>
        <Legend cls="bg-rio-100 border border-rio-300">Preferencial (idoso/PCD)</Legend>
      </div>
    </div>
  );
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3.5 w-3.5 rounded ${cls}`} />
      {children}
    </span>
  );
}
