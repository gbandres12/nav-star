"use client";

import { useState } from "react";
import { ArrowLeftRight, CalendarDays, MapPin, Search } from "lucide-react";
import type { Cidade } from "@/lib/types";

type Props = {
  cidades: Cidade[];
  origem?: string;
  destino?: string;
  data?: string;
  hoje: string;
  compact?: boolean;
  datasDisponiveis?: string[];
};

const fmtDia = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
function rotularData(dia: string) {
  return fmtDia.format(new Date(`${dia}T12:00:00Z`));
}

export function SearchForm({ cidades, origem = "manaus", destino = "parintins", data = "", hoje, compact, datasDisponiveis }: Props) {
  const [o, setO] = useState(origem);
  const [d, setD] = useState(destino);

  return (
    <form action="/viagens" className={`grid gap-3 ${compact ? "md:grid-cols-[1fr_auto_1fr_1fr_auto]" : "md:grid-cols-[1fr_auto_1fr_1fr_auto]"} items-end`}>
      <div>
        <label className="label">Saindo de</label>
        <div className="relative">
          <MapPin size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-rio-500" />
          <select name="origem" value={o} onChange={(e) => setO(e.target.value)} className="input appearance-none pl-9">
            {cidades.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} / {c.uf}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setO(d);
          setD(o);
        }}
        className="mb-0.5 grid h-10 w-10 place-items-center self-end justify-self-center rounded-full border border-slate-300 bg-white text-slate-500 transition hover:rotate-180 hover:text-rio-700"
        aria-label="Inverter origem e destino"
      >
        <ArrowLeftRight size={16} />
      </button>
      <div>
        <label className="label">Indo para</label>
        <div className="relative">
          <MapPin size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-rubro-500" />
          <select name="destino" value={d} onChange={(e) => setD(e.target.value)} className="input appearance-none pl-9">
            {cidades.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} / {c.uf}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Data</label>
        <div className="relative">
          <CalendarDays size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          {datasDisponiveis ? (
            <select name="data" defaultValue={data} className="input appearance-none pl-9">
              <option value="">Qualquer data</option>
              {datasDisponiveis.map((dia) => (
                <option key={dia} value={dia}>{rotularData(dia)}</option>
              ))}
            </select>
          ) : (
            <input type="date" name="data" defaultValue={data} min={hoje} className="input pl-9" />
          )}
        </div>
      </div>
      <button type="submit" className="btn-sol h-[42px] px-6">
        <Search size={18} /> Buscar
      </button>
    </form>
  );
}
