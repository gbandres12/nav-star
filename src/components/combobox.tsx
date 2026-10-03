"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

export type OpcaoCombo = { value: string; label: string };

type Props = {
  opcoes: OpcaoCombo[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  buscaPlaceholder?: string;
  /** Mostra a caixa de busca (útil com muitas opções) */
  busca?: boolean;
  /** Abre a lista para cima (campos perto do rodapé) */
  paraCima?: boolean;
  /** Visual: "campo" cinza arredondado (formulários) ou "branco" (sobre faixa colorida) */
  tom?: "campo" | "branco";
  id?: string;
  ariaLabel?: string;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lista suspensa com busca: o operador digita parte do nome e escolhe, sem rolar uma lista longa */
export function Combobox({ opcoes, value, onChange, placeholder = "Selecione uma opção...", buscaPlaceholder = "Buscar...", busca = true, paraCima, tom = "campo", id, ariaLabel }: Props) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const raiz = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const lista = useId();
  const atual = opcoes.find((o) => o.value === value);
  const filtradas = useMemo(() => (q ? opcoes.filter((o) => norm(o.label).includes(norm(q))) : opcoes), [opcoes, q]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function alternar() {
    setQ("");
    setAberto((a) => !a);
    if (busca) setTimeout(() => buscaRef.current?.focus(), 0);
  }

  const gatilho = tom === "branco"
    ? "border-white/40 bg-white text-slate-700"
    : `${aberto ? "border-rio-600 ring-4 ring-rio-500/15" : "border-transparent"} bg-slate-100 text-slate-700`;

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={lista}
        onClick={alternar}
        className={`flex w-full items-center justify-between gap-3 rounded-full border px-4 py-3 text-left text-sm transition ${gatilho}`}
      >
        <span className={`truncate ${atual ? "font-medium text-slate-900" : "text-slate-400"}`}>{atual?.label ?? placeholder}</span>
        {aberto ? <ChevronUp size={18} className="shrink-0 text-rio-700" /> : <ChevronDown size={18} className="shrink-0 text-rio-700" />}
      </button>
      {aberto && (
        <div className={`absolute left-0 z-40 w-full min-w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl ${paraCima ? "bottom-full mb-2" : "top-full mt-2"}`}>
          {busca && (
            <div className="relative mb-1">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                ref={buscaRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={buscaPlaceholder}
                className="w-full rounded-full bg-slate-100 py-2 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          )}
          <ul id={lista} role="listbox" className="max-h-64 overflow-y-auto">
            {filtradas.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Nada encontrado</li>}
            {filtradas.map((o) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setAberto(false);
                  }}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-rio-50 ${o.value === value ? "bg-rio-50 font-semibold text-rio-800" : "text-slate-700"}`}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
