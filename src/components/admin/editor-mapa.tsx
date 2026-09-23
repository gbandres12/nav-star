"use client";

import { useMemo, useState, useTransition } from "react";
import { Eraser, Hash, LayoutGrid, Loader2, Save } from "lucide-react";
import { Mensagem } from "./action-form";
import { salvarMapaAction, type Estado } from "@/lib/admin-actions";
import type { Assento, TipoAssento } from "@/lib/types";

type Celula = { codigo: string; tipo: TipoAssento; comodoId?: string };
type Pincel = TipoAssento | "VAZIO";
type ComodoOpcao = { id: string; nome: string; cor: string; acrescimo: number };

const COR: Record<string, string> = {
  rio: "bg-rio-100 border-rio-400 text-rio-800",
  sol: "bg-sol-300/60 border-sol-500 text-rio-950",
  rubro: "bg-rubro-100 border-rubro-500 text-rubro-700",
  emerald: "bg-emerald-100 border-emerald-500 text-emerald-800",
  slate: "bg-white border-slate-300 text-slate-600",
};
const LETRAS = "ABCDEFGHI";

/**
 * Editor do mapa de poltronas. Mesma orientação do mapa de venda: fileiras da popa (esquerda) para a proa (direita);
 * cada fileira tem N posições (inclui o corredor, que fica vazio).
 */
export function EditorMapa({ embarcacaoId, assentos, colunasIniciais, comodos }: { embarcacaoId: string; assentos: Assento[]; colunasIniciais: number; comodos: ComodoOpcao[] }) {
  const [colunas, setColunas] = useState(colunasIniciais || 5);
  const [fileiras, setFileiras] = useState(Math.max(1, ...assentos.map((a) => a.fileira), assentos.length ? 1 : 10));
  const [celulas, setCelulas] = useState<Record<string, Celula>>(() =>
    Object.fromEntries(assentos.map((a) => [`${a.fileira}-${a.coluna}`, { codigo: a.codigo, tipo: a.tipo, comodoId: a.comodoId }])),
  );
  const [pincel, setPincel] = useState<Pincel>("POLTRONA");
  const [comodoId, setComodoId] = useState(comodos[0]?.id ?? "");
  const [estado, setEstado] = useState<Estado>();
  const [pending, start] = useTransition();
  const cor = useMemo(() => new Map(comodos.map((c) => [c.id, c.cor])), [comodos]);
  const total = Object.keys(celulas).filter((k) => {
    const [f, c] = k.split("-").map(Number);
    return f <= fileiras && c < colunas;
  }).length;

  function pintar(f: number, c: number) {
    const k = `${f}-${c}`;
    setEstado(undefined);
    setCelulas((x) => {
      const n = { ...x };
      if (pincel === "VAZIO") delete n[k];
      else n[k] = { codigo: x[k]?.codigo ?? `${f}${LETRAS[c]}`, tipo: pincel, comodoId: comodoId || undefined };
      return n;
    });
  }

  function renomear(f: number, c: number) {
    const k = `${f}-${c}`;
    const atual = celulas[k];
    if (!atual) return;
    const novo = window.prompt("Código da poltrona (ex.: 12A, CAM1)", atual.codigo);
    if (novo && novo.trim()) setCelulas({ ...celulas, [k]: { ...atual, codigo: novo.trim().toUpperCase() } });
  }

  /** Layout padrão de lancha: A B | corredor | C D, 1ª fileira preferencial, janelas nas pontas */
  function padrao() {
    if (Object.keys(celulas).length && !window.confirm("Substituir o mapa atual pelo layout padrão?")) return;
    const corredor = Math.floor(colunas / 2);
    const n: Record<string, Celula> = {};
    for (let f = 1; f <= fileiras; f++) {
      for (let c = 0; c < colunas; c++) {
        if (c === corredor) continue;
        n[`${f}-${c}`] = { codigo: "", tipo: f === 1 ? "ESPECIAL" : c === 0 || c === colunas - 1 ? "POLTRONA_JANELA" : "POLTRONA", comodoId: comodoId || undefined };
      }
    }
    setCelulas(renumerar(n));
  }

  /** Fileira + letra em ordem (pula o corredor): 1A 1B 1C 1D… */
  function renumerar(base = celulas) {
    const n: Record<string, Celula> = {};
    for (let f = 1; f <= fileiras; f++) {
      let i = 0;
      for (let c = 0; c < colunas; c++) {
        const cel = base[`${f}-${c}`];
        if (cel) n[`${f}-${c}`] = { ...cel, codigo: `${f}${LETRAS[i++]}` };
      }
    }
    return n;
  }

  function salvar() {
    const lista: Omit<Assento, "id">[] = Object.entries(celulas)
      .map(([k, cel]) => {
        const [f, c] = k.split("-").map(Number);
        return { fileira: f, coluna: c, ...cel };
      })
      .filter((a) => a.fileira <= fileiras && a.coluna < colunas);
    start(async () => setEstado(await salvarMapaAction(embarcacaoId, colunas, lista)));
  }

  const linhasVisuais = Array.from({ length: colunas }, (_, i) => colunas - 1 - i);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Fileiras</label>
          <input type="number" min={1} max={60} value={fileiras} onChange={(e) => setFileiras(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} className="input w-24" />
        </div>
        <div>
          <label className="label">Posições por fileira</label>
          <input type="number" min={2} max={9} value={colunas} onChange={(e) => setColunas(Math.min(9, Math.max(2, Number(e.target.value) || 2)))} className="input w-24" />
        </div>
        <div>
          <label className="label">Pincel</label>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {([["POLTRONA", "Poltrona"], ["POLTRONA_JANELA", "Janela"], ["ESPECIAL", "Preferencial"], ["VAZIO", "Corredor"]] as [Pincel, string][]).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setPincel(v)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${pincel === v ? "bg-white text-rio-800 shadow" : "text-slate-500"}`}>
                {v === "VAZIO" && <Eraser size={12} className="mr-1 inline" />}
                {l}
              </button>
            ))}
          </div>
        </div>
        {comodos.length > 0 && (
          <div>
            <label className="label">Cômodo</label>
            <select value={comodoId} onChange={(e) => setComodoId(e.target.value)} className="input">
              {comodos.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.acrescimo ? ` (+R$ ${c.acrescimo})` : ""}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border-2 border-rio-200 bg-gradient-to-b from-rio-50 to-white p-4">
        <div className="inline-flex gap-1">
          {Array.from({ length: fileiras }, (_, i) => i + 1).map((f) => (
            <div key={f} className="flex flex-col gap-1">
              <span className="h-4 text-center text-[9px] font-bold text-rio-300">{f}</span>
              {linhasVisuais.map((c) => {
                const cel = celulas[`${f}-${c}`];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => pintar(f, c)}
                    onDoubleClick={() => renomear(f, c)}
                    title={cel ? `${cel.codigo} · clique para pintar, duplo clique para renomear` : "Vazio (corredor) · clique para pintar"}
                    className={`flex h-8 w-8 items-center justify-center rounded-md border text-[9px] font-bold transition ${
                      cel ? `${COR[cor.get(cel.comodoId ?? "") ?? "slate"]} ${cel.tipo === "ESPECIAL" ? "ring-2 ring-rio-500" : ""} ${cel.tipo === "POLTRONA_JANELA" ? "rounded-t-lg" : ""}` : "border-dashed border-slate-200 text-slate-300 hover:border-rio-300"
                    }`}
                  >
                    {cel?.codigo ?? ""}
                  </button>
                );
              })}
            </div>
          ))}
          <span className="ml-2 self-center text-[10px] font-bold tracking-widest text-rio-300 uppercase [writing-mode:vertical-rl]">Proa</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Clique para aplicar o pincel; duplo clique para renomear (ex.: CAM1 para camarote). Anel azul = preferencial; canto arredondado = janela; cor = cômodo.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={padrao} className="btn-ghost"><LayoutGrid size={16} /> Layout padrão</button>
        <button type="button" onClick={() => setCelulas(renumerar())} className="btn-ghost"><Hash size={16} /> Renumerar</button>
        <button type="button" onClick={salvar} disabled={pending} className="btn-primary">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar mapa ({total} poltronas)
        </button>
        <Mensagem state={estado} />
      </div>
    </div>
  );
}
