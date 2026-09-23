import { Check } from "lucide-react";
import { dateTime, label } from "@/lib/format";
import { FLUXO_ENCOMENDA } from "@/lib/store";
import type { Encomenda } from "@/lib/types";

export function EncomendaTimeline({ e }: { e: Encomenda }) {
  const atual = FLUXO_ENCOMENDA.indexOf(e.status);
  return (
    <ol className="space-y-0">
      {FLUXO_ENCOMENDA.map((s, i) => {
        const ev = e.eventos.find((x) => x.status === s);
        const feito = i <= atual;
        return (
          <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
            {i < FLUXO_ENCOMENDA.length - 1 && (
              <span className={`absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-0.5 ${i < atual ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
            <span className={`z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ${feito ? "bg-emerald-500 text-white" : "border-2 border-slate-200 bg-white"} ${i === atual ? "ring-4 ring-emerald-500/20" : ""}`}>
              {feito && <Check size={14} strokeWidth={3} />}
            </span>
            <div className="pt-0.5">
              <p className={`text-sm font-semibold ${feito ? "text-slate-900" : "text-slate-400"}`}>{label(s)}</p>
              {ev && (
                <p className="text-xs text-slate-500">
                  {dateTime(ev.createdAt)}
                  {ev.descricao ? ` · ${ev.descricao}` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
