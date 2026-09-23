import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, PartyPopper } from "lucide-react";
import { date } from "@/lib/format";
import type { Festival } from "@/lib/types";

// Classes fixas por cor (o Tailwind precisa encontrá-las no código)
export const COR_FESTIVAL: Record<Festival["cor"], { fundo: string; texto: string; selo: string }> = {
  rubro: { fundo: "from-rubro-600 to-rubro-800", texto: "text-rubro-100", selo: "bg-rubro-50 text-rubro-700 ring-rubro-600/20" },
  rio: { fundo: "from-rio-600 to-rio-900", texto: "text-rio-100", selo: "bg-rio-50 text-rio-700 ring-rio-600/20" },
  sol: { fundo: "from-sol-500 to-sol-600", texto: "text-rio-950/80", selo: "bg-amber-50 text-amber-800 ring-amber-600/25" },
  emerald: { fundo: "from-emerald-600 to-emerald-800", texto: "text-emerald-100", selo: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
};

export const periodoFestival = (f: Festival) =>
  f.inicio === f.fim ? date(f.inicio + "T12:00:00Z") : `${date(f.inicio + "T12:00:00Z").slice(0, 5)} a ${date(f.fim + "T12:00:00Z")}`;

export function FestivalCard({ f, cidade, aPartirDe }: { f: Festival; cidade: string; aPartirDe?: string }) {
  const c = COR_FESTIVAL[f.cor];
  return (
    <Link href={`/festivais/${f.slug}`} className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.fundo} p-6 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl`}>
      <PartyPopper className="absolute -right-4 -bottom-4 h-28 w-28 opacity-15" aria-hidden />
      <p className={`flex items-center gap-3 text-xs font-semibold ${c.texto}`}>
        <span className="flex items-center gap-1"><CalendarDays size={14} /> {periodoFestival(f)}</span>
        <span className="flex items-center gap-1"><MapPin size={14} /> {cidade}</span>
      </p>
      <h3 className="mt-3 text-2xl font-extrabold tracking-tight">{f.nome}</h3>
      {f.chamada && <p className={`mt-1 ${c.texto}`}>{f.chamada}</p>}
      <p className="mt-5 inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold backdrop-blur group-hover:bg-white/25">
        {aPartirDe ? `Passagens a partir de ${aPartirDe}` : "Ver viagens"} <ArrowRight size={16} />
      </p>
    </Link>
  );
}
