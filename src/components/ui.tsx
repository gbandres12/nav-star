import { label } from "@/lib/format";
import type { ReactNode } from "react";

const TONE: Record<string, string> = {
  // verde
  PAGO: "emerald", EMITIDA: "emerald", EMBARCADA: "emerald", ENTREGUE: "emerald", ATIVA: "emerald", CONCLUIDA: "slate", APROVADO: "emerald",
  // azul
  PROGRAMADA: "blue", EM_TRANSITO: "blue", EMBARCADO: "blue", EM_CURSO: "blue", RECEBIDA: "blue",
  // amarelo
  AGUARDANDO_PAGAMENTO: "amber", RESERVADA: "amber", EMBARQUE: "amber", DISPONIVEL_RETIRADA: "amber", MANUTENCAO: "amber", PENDENTE: "amber",
  // vermelho
  CANCELADO: "red", CANCELADA: "red", EXPIRADO: "red", NAO_COMPARECEU: "red", DEVOLVIDA: "red", INATIVA: "red", REEMBOLSADO: "red",
};

const TONES: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  blue: "bg-rio-50 text-rio-700 ring-rio-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${TONES[TONE[status] ?? "slate"]}`}>
      {children ?? label(status)}
    </span>
  );
}

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${light ? "bg-white" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-emblema.png" alt="" className={light ? "h-8 w-8" : "h-10 w-10"} />
      </span>
      {!compact && (
        <span className="leading-none italic">
          <span className={`block text-[17px] font-extrabold tracking-tight uppercase ${light ? "text-white" : "text-rio-900"}`}>São Tomé</span>
          <span className={`mt-0.5 block text-[11px] font-extrabold tracking-[0.2em] uppercase ${light ? "text-rio-300" : "text-rubro-500"}`}>Expresso</span>
        </span>
      )}
    </span>
  );
}

export function Stat({ label: l, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{l}</p>
        {icon && <span className="grid h-9 w-9 place-items-center rounded-xl bg-rio-50 text-rio-600">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function OccupancyBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 tabular-nums">{pct}%</span>
    </div>
  );
}
