import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MonthNav({ base, nome, anterior, proximo, atual }: { base: string; nome: string; anterior: string; proximo: string; atual: boolean }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
      <Link href={`${base}?mes=${anterior}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Mês anterior">
        <ChevronLeft size={16} />
      </Link>
      <span className="min-w-36 text-center text-sm font-semibold text-slate-700">{nome}</span>
      {atual ? (
        <span className="grid h-8 w-8 place-items-center text-slate-300"><ChevronRight size={16} /></span>
      ) : (
        <Link href={`${base}?mes=${proximo}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Próximo mês">
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}
