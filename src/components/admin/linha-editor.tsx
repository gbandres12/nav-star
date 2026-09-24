"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Mensagem } from "./action-form";
import type { Estado } from "@/lib/admin-actions";
import { salvarHorariosAction, salvarLinhaAction } from "@/lib/precos-actions";

type PortoOpcao = { id: string; nome: string; cidade: string };
type Parada = { portoId: string; h: number; m: number };
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Nome, situação e sequência de paradas (com tempo previsto desde a saída) */
export function LinhaEditor({ linha, portos }: { linha?: { id: string; nome: string; ativa: boolean; paradas: { portoId: string; minutosDesdeOrigem: number }[] }; portos: PortoOpcao[] }) {
  const [nome, setNome] = useState(linha?.nome ?? "");
  const [ativa, setAtiva] = useState(linha?.ativa ?? true);
  const [paradas, setParadas] = useState<Parada[]>(
    linha?.paradas.map((p) => ({ portoId: p.portoId, h: Math.floor(p.minutosDesdeOrigem / 60), m: p.minutosDesdeOrigem % 60 })) ?? [
      { portoId: portos[0]?.id ?? "", h: 0, m: 0 },
      { portoId: portos[1]?.id ?? "", h: 4, m: 0 },
    ],
  );
  const [estado, setEstado] = useState<Estado>();
  const [pending, start] = useTransition();

  const set = (i: number, p: Partial<Parada>) => setParadas(paradas.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const mover = (i: number, d: -1 | 1) => {
    const n = [...paradas];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setParadas(n);
  };
  const nomeSugerido = paradas.length >= 2 ? `${portos.find((p) => p.id === paradas[0].portoId)?.cidade ?? ""} → ${portos.find((p) => p.id === paradas.at(-1)!.portoId)?.cidade ?? ""}` : "";

  function salvar() {
    start(async () =>
      setEstado(
        await salvarLinhaAction({
          id: linha?.id,
          nome: nome || nomeSugerido,
          ativa,
          paradas: paradas.map((p, i) => ({ portoId: p.portoId, minutosDesdeOrigem: i === 0 ? 0 : p.h * 60 + p.m })),
        }),
      ),
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label">Nome da linha</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={nomeSugerido} className="input" />
        </div>
        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="h-4 w-4 accent-rio-700" /> Linha ativa (aparece no site)
        </label>
      </div>

      <h3 className="mt-6 mb-2 text-sm font-bold text-slate-700">Paradas, na ordem da viagem</h3>
      <ol className="space-y-2">
        {paradas.map((p, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-rio-100 text-xs font-bold text-rio-800">{i + 1}</span>
            <select value={p.portoId} onChange={(e) => set(i, { portoId: e.target.value })} className="input w-auto min-w-56 flex-1">
              {portos.map((x) => <option key={x.id} value={x.id}>{x.cidade} · {x.nome}</option>)}
            </select>
            {i === 0 ? (
              <span className="px-2 text-sm text-slate-500">saída (0h00)</span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-slate-600">
                +
                <input type="number" min={0} max={200} value={p.h} onChange={(e) => set(i, { h: Math.max(0, Number(e.target.value) || 0) })} className="input w-20" aria-label="Horas desde a saída" />h
                <input type="number" min={0} max={59} step={5} value={p.m} onChange={(e) => set(i, { m: Math.min(59, Math.max(0, Number(e.target.value) || 0)) })} className="input w-20" aria-label="Minutos" />min
              </span>
            )}
            <span className="ml-auto flex gap-1">
              <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} className="btn-ghost px-2 py-1.5" aria-label="Subir"><ArrowUp size={14} /></button>
              <button type="button" disabled={i === paradas.length - 1} onClick={() => mover(i, 1)} className="btn-ghost px-2 py-1.5" aria-label="Descer"><ArrowDown size={14} /></button>
              <button type="button" disabled={paradas.length <= 2} onClick={() => setParadas(paradas.filter((_, j) => j !== i))} className="btn-ghost px-2 py-1.5 text-red-600" aria-label="Remover"><Trash2 size={14} /></button>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setParadas([...paradas, { portoId: portos[0]?.id ?? "", h: (paradas.at(-1)?.h ?? 0) + 2, m: 0 }])} className="btn-ghost"><Plus size={16} /> Adicionar parada</button>
        <button type="button" onClick={salvar} disabled={pending} className="btn-primary">{pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar linha</button>
        <Mensagem state={estado} />
      </div>
      <p className="mt-2 text-xs text-slate-500">O tempo é contado desde a saída do primeiro porto e define o horário previsto em cada parada. Mudar a sequência de portos é bloqueado se já houver passagens vendidas para viagens futuras.</p>
    </div>
  );
}

/** Programação semanal: dias e horários de saída de cada embarcação */
export function HorariosEditor({ linhaId, horarios, embarcacoes }: { linhaId: string; horarios: { diaSemana: number; horaSaida: string; embarcacaoId: string }[]; embarcacoes: { id: string; nome: string }[] }) {
  const [lista, setLista] = useState(horarios);
  const [estado, setEstado] = useState<Estado>();
  const [pending, start] = useTransition();
  const set = (i: number, p: Partial<(typeof lista)[number]>) => setLista(lista.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div>
      {lista.length === 0 && <p className="mb-3 text-sm text-slate-500">Nenhum horário. Sem programação, a linha só tem viagens avulsas.</p>}
      <ul className="space-y-2">
        {lista.map((h, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <select value={h.diaSemana} onChange={(e) => set(i, { diaSemana: Number(e.target.value) })} className="input w-40">
              {DIAS.map((d, n) => <option key={n} value={n}>{d}</option>)}
            </select>
            <input type="time" value={h.horaSaida} onChange={(e) => set(i, { horaSaida: e.target.value })} className="input w-32" />
            <select value={h.embarcacaoId} onChange={(e) => set(i, { embarcacaoId: e.target.value })} className="input w-auto min-w-48 flex-1">
              {embarcacoes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <button type="button" onClick={() => setLista(lista.filter((_, j) => j !== i))} className="btn-ghost px-2 py-2 text-red-600" aria-label="Remover horário"><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setLista([...lista, { diaSemana: 1, horaSaida: "06:00", embarcacaoId: embarcacoes[0]?.id ?? "" }])} className="btn-ghost"><Plus size={16} /> Adicionar horário</button>
        <button type="button" onClick={() => start(async () => setEstado(await salvarHorariosAction(linhaId, lista)))} disabled={pending} className="btn-primary">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar programação
        </button>
        <Mensagem state={estado} />
      </div>
    </div>
  );
}
