import { money } from "@/lib/format";

/** Barras verticais de uma série, com tooltip por barra (hover/foco) */
export function BarChart({ data, height = 220 }: { data: { label: string; sub?: string; value: number; hint?: string }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div className="flex gap-2">
      <div className="relative w-16 shrink-0 text-right text-[11px] text-slate-400 tabular-nums" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0" style={{ bottom: `${(t / top) * 100}%`, transform: "translateY(50%)" }}>
            {t >= 1000 ? `${(t / 1000).toLocaleString("pt-BR")} mil` : t}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="relative" style={{ height, minWidth: data.length * 16 }}>
          {ticks.map((t) => (
            <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? "border-slate-300" : "border-slate-100"}`} style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <div key={i} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center outline-none">
                <div
                  className="w-full max-w-7 rounded-t-[4px] bg-rio-500 transition group-hover:bg-rio-700 group-focus:bg-rio-700"
                  style={{ height: `${(d.value / top) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg group-hover:block group-focus:block">
                  <p className="text-slate-300">{d.sub ?? d.label}</p>
                  <p className="font-semibold tabular-nums">{money(d.value)}</p>
                  {d.hint && <p className="text-slate-300">{d.hint}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex gap-[2px]" style={{ minWidth: data.length * 16 }}>
          {data.map((d, i) => (
            <span key={i} className="flex-1 text-center text-[10px] text-slate-400 tabular-nums">
              {data.length > 16 && i % 2 ? "" : d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

/** Barras horizontais com rótulo e valor — para comparar categorias */
export function BarList({ items, format = money }: { items: { label: string; value: number; extra?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium text-slate-700">{i.label}</span>
            <span className="text-slate-600 tabular-nums">
              {format(i.value)} <span className="text-xs text-slate-400">· {total ? Math.round((i.value / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-rio-500" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          {i.extra && <p className="mt-0.5 text-xs text-slate-400">{i.extra}</p>}
        </li>
      ))}
    </ul>
  );
}
