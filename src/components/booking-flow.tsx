"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, CreditCard, Loader2, QrCode, Banknote, Plus, Trash2, TriangleAlert, Armchair, Sparkles } from "lucide-react";
import { SeatMap } from "./seat-map";
import { finalizarCompra } from "@/lib/actions";
import { money } from "@/lib/format";
import type { Assento, CanalVenda, MetodoPagamento, TipoPassageiro } from "@/lib/types";

const TIPOS: { v: TipoPassageiro; l: string }[] = [
  { v: "INTEIRA", l: "Inteira" },
  { v: "CRIANCA", l: "Criança 2–11 anos" },
  { v: "IDOSO", l: "Idoso 60+" },
  { v: "ESTUDANTE", l: "Estudante" },
  { v: "PCD", l: "PCD" },
];
const rotuloDesconto = (d: number) => (d >= 1 ? " (gratuidade)" : d > 0 ? ` (${Math.round(d * 100)}%)` : "");

export type ConvenioOpcao = { id: string; nome: string; descontoPercentual: number; faturado: boolean };

type Props = {
  viagemId: string;
  origemOrdem: number;
  destinoOrdem: number;
  valor: number;
  taxa: number;
  assentos: Assento[];
  colunas: number;
  ocupados: string[];
  canal: CanalVenda;
  vendedorId?: string;
  resumo: React.ReactNode;
  descontos: Record<TipoPassageiro, number>; // 0.5 = 50%
  acrescimos: Record<string, number>; // acréscimo do cômodo por poltrona
  comodos?: Record<string, { nome: string; cor: string }>; // cômodo de cada poltrona (legenda do mapa)
  convenios?: ConvenioOpcao[]; // só balcão
  livresSemAcrescimo: number; // poltronas livres sem acréscimo de cômodo no trecho
  livres: number; // lugares livres no trecho
  assentoLivre?: boolean; // embarcação sem poltrona numerada
};

type Pax = { key: number; assentoId?: string; nome: string; documento: string; tipo: TipoPassageiro };
type Modo = "auto" | "mapa";

export function BookingFlow(p: Props) {
  const balcao = p.canal !== "SITE";
  const max = Math.min(balcao ? 20 : 6, p.livres);
  const [modo, setModo] = useState<Modo>("auto");
  const [seq, setSeq] = useState(2);
  const [pax, setPax] = useState<Pax[]>([{ key: 1, nome: "", documento: "", tipo: "INTEIRA" }]);
  const [comprador, setComprador] = useState({ nome: "", email: "", telefone: "" });
  const [metodo, setMetodo] = useState<MetodoPagamento>(balcao ? "DINHEIRO" : "PIX");
  const [erro, setErro] = useState<string>();
  const [convenioId, setConvenioId] = useState("");
  const conv = p.convenios?.find((c) => c.id === convenioId);
  const [pending, start] = useTransition();
  const codigo = useMemo(() => new Map(p.assentos.map((a) => [a.id, a.codigo])), [p.assentos]);
  const sel = modo === "mapa" ? pax.map((x) => x.assentoId).filter((a): a is string => !!a) : [];

  const novoPax = (assentoId?: string): Pax => ({ key: seq, assentoId, nome: "", documento: "", tipo: "INTEIRA" });
  const editar = (key: number, campos: Partial<Pax>) => setPax((l) => l.map((x) => (x.key === key ? { ...x, ...campos } : x)));

  function adicionar() {
    setErro(undefined);
    if (pax.length >= max) return setErro(max ? `Máximo de ${max} passageiros por compra.` : "Não há poltronas livres neste trecho.");
    setPax([...pax, novoPax()]);
    setSeq(seq + 1);
  }

  function remover(key: number) {
    setErro(undefined);
    setPax((l) => (l.length > 1 ? l.filter((x) => x.key !== key) : l.map((x) => ({ ...x, assentoId: undefined }))));
  }

  /** No mapa: clicar numa poltrona livre dá ela ao próximo passageiro sem poltrona (ou cria um novo) */
  function toggle(id: string) {
    setErro(undefined);
    const dono = pax.find((x) => x.assentoId === id);
    if (dono) return editar(dono.key, { assentoId: undefined });
    const semPoltrona = pax.find((x) => !x.assentoId);
    if (semPoltrona) return editar(semPoltrona.key, { assentoId: id });
    if (pax.length >= max) return setErro(`Máximo de ${max} passageiros por compra.`);
    setPax([...pax, novoPax(id)]);
    setSeq(seq + 1);
  }

  // Mesma regra do servidor (store.precoPassagem): tarifa + cômodo, com o maior desconto entre tipo e convênio.
  // No automático o sistema escolhe primeiro poltronas sem acréscimo.
  const itens = pax.map((x) => {
    const acrescimo = modo === "mapa" && x.assentoId ? (p.acrescimos[x.assentoId] ?? 0) : 0;
    const desc = Math.min(1, Math.max(p.descontos[x.tipo] ?? 0, (conv?.descontoPercentual ?? 0) / 100));
    return { key: x.key, assentoId: modo === "mapa" ? x.assentoId : undefined, valor: Math.round((p.valor + acrescimo) * (1 - desc) * 100) / 100, acrescimo };
  });
  const subtotal = itens.reduce((s, i) => s + i.valor, 0);
  const taxas = p.taxa * pax.length;
  const total = subtotal + taxas;
  const podeTerAcrescimo = modo === "auto" && pax.length > p.livresSemAcrescimo;

  function submit() {
    setErro(undefined);
    if (!pax.length) return setErro("Adicione pelo menos um passageiro.");
    if (modo === "mapa" && pax.some((x) => !x.assentoId)) return setErro("Escolha uma poltrona no mapa para cada passageiro, ou use “Sem escolher poltrona”.");
    const faltando = pax.some((x) => x.nome.trim().length < 3 || x.documento.replace(/\D/g, "").length < 5);
    if (faltando) return setErro("Preencha nome completo e documento de cada passageiro.");
    if (!balcao && (comprador.nome.trim().length < 3 || comprador.telefone.replace(/\D/g, "").length < 10))
      return setErro("Informe nome e WhatsApp do comprador para receber os bilhetes.");
    start(async () => {
      const r = await finalizarCompra({
        viagemId: p.viagemId,
        origemOrdem: p.origemOrdem,
        destinoOrdem: p.destinoOrdem,
        canal: p.canal,
        vendedorId: p.vendedorId,
        pagoNoAto: balcao && metodo !== "PIX",
        metodo: conv?.faturado ? "FATURADO" : metodo,
        convenioId: convenioId || undefined,
        comprador: balcao
          ? { nome: comprador.nome || pax[0].nome, telefone: comprador.telefone || "-", email: comprador.email }
          : comprador,
        passageiros: pax.map(({ assentoId, nome, documento, tipo }) => ({ assentoId: modo === "mapa" ? assentoId : undefined, nome, documento, tipo })),
      });
      if (r?.erro) setErro(r.erro);
    });
  }

  const metodos: { v: MetodoPagamento; l: string; icon: React.ReactNode; hint: string }[] = balcao
    ? [
        { v: "DINHEIRO", l: "Dinheiro", icon: <Banknote size={18} />, hint: "Recebido no caixa" },
        { v: "PIX", l: "PIX", icon: <QrCode size={18} />, hint: "Gera QR para o cliente" },
        { v: "CARTAO_DEBITO", l: "Débito", icon: <CreditCard size={18} />, hint: "Maquininha" },
        { v: "CARTAO_CREDITO", l: "Crédito", icon: <CreditCard size={18} />, hint: "Maquininha" },
      ]
    : [
        { v: "PIX", l: "PIX", icon: <QrCode size={18} />, hint: "Aprovação na hora" },
        { v: "CARTAO_CREDITO", l: "Cartão de crédito", icon: <CreditCard size={18} />, hint: "Em breve" },
      ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">1. {p.assentoLivre ? "Lugares" : "Poltronas"}</h2>
            <span className="text-sm text-slate-500">{p.livres} {p.assentoLivre ? "lugares" : "poltronas"} livres neste trecho</span>
          </div>
          {p.assentoLivre ? (
            <p className="rounded-xl border border-rio-200 bg-rio-50 p-4 text-sm text-rio-900">
              <strong>Assento livre.</strong> Nesta embarcação as poltronas não são numeradas: cada passageiro escolhe o lugar ao embarcar, por ordem de chegada.
            </p>
          ) : (
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Como escolher a poltrona">
            {([
              ["auto", <Sparkles key="i" size={18} />, "Sem escolher poltrona", "O sistema reserva lugares juntos, sem acréscimo, na hora da compra"],
              ["mapa", <Armchair key="i" size={18} />, "Escolher no mapa", "Veja o mapa da embarcação e marque cada poltrona"],
            ] as const).map(([v, icon, titulo, desc]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={modo === v}
                onClick={() => {
                  setErro(undefined);
                  setModo(v);
                }}
                className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${modo === v ? "border-rio-600 bg-rio-50 ring-2 ring-rio-600/20" : "border-slate-200 hover:border-slate-300"}`}
              >
                <span className={`mt-0.5 ${modo === v ? "text-rio-700" : "text-slate-400"}`}>{icon}</span>
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{titulo}</span>
                  <span className="block text-xs text-slate-500">{desc}</span>
                </span>
              </button>
            ))}
          </div>
          )}
          {modo === "mapa" && !p.assentoLivre && (
            <div className="mt-5">
              <SeatMap assentos={p.assentos} colunas={p.colunas} ocupados={p.ocupados} selecionados={sel} onToggle={toggle} comodos={p.comodos} />
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">2. Passageiros</h2>
            <button type="button" onClick={adicionar} className="btn-ghost py-1.5"><Plus size={16} /> Adicionar passageiro</button>
          </div>
          <div className="space-y-4">
            {pax.map((x, i) => (
              <div key={x.key} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">
                    Passageiro {i + 1}
                    {modo === "mapa" && (
                      <span className={x.assentoId ? "text-rio-700" : "text-amber-700"}> · {x.assentoId ? `Poltrona ${codigo.get(x.assentoId)}` : "escolha a poltrona no mapa"}</span>
                    )}
                  </p>
                  {(pax.length > 1 || x.assentoId) && (
                    <button type="button" onClick={() => remover(x.key)} className="text-slate-400 hover:text-red-600" aria-label={`Remover passageiro ${i + 1}`}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_1.2fr_1.4fr]">
                  <div>
                    <label className="label" htmlFor={`nome-${x.key}`}>Nome completo</label>
                    <input id={`nome-${x.key}`} className="input" value={x.nome} onChange={(e) => editar(x.key, { nome: e.target.value })} placeholder="Como no documento" />
                  </div>
                  <div>
                    <label className="label" htmlFor={`doc-${x.key}`}>CPF ou RG</label>
                    <input id={`doc-${x.key}`} className="input" inputMode="numeric" value={x.documento} onChange={(e) => editar(x.key, { documento: e.target.value })} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className="label" htmlFor={`tipo-${x.key}`}>Tipo</label>
                    <select id={`tipo-${x.key}`} className="input" value={x.tipo} onChange={(e) => editar(x.key, { tipo: e.target.value as TipoPassageiro })}>
                      {TIPOS.map((t) => (
                        <option key={t.v} value={t.v}>{t.l}{rotuloDesconto(p.descontos[t.v] ?? 0)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {pax.some((x) => x.tipo !== "INTEIRA") && (
            <p className="mt-3 flex items-start gap-2 text-xs text-amber-700">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              Descontos e gratuidades exigem apresentação de documento comprobatório no embarque.
              {modo === "auto" && !p.assentoLivre && " Idosos e PCD ficam na fileira preferencial quando houver lugar."}
            </p>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 font-bold text-slate-900">3. {balcao ? "Cliente e pagamento" : "Seus dados e pagamento"}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Nome do comprador{balcao && " (opcional)"}</label>
              <input className="input" value={comprador.nome} onChange={(e) => setComprador({ ...comprador, nome: e.target.value })} />
            </div>
            <div>
              <label className="label">WhatsApp{balcao && " (opcional)"}</label>
              <input className="input" inputMode="tel" value={comprador.telefone} onChange={(e) => setComprador({ ...comprador, telefone: e.target.value })} placeholder="(92) 9 0000-0000" />
            </div>
            <div>
              <label className="label">E-mail (opcional)</label>
              <input className="input" type="email" value={comprador.email} onChange={(e) => setComprador({ ...comprador, email: e.target.value })} />
            </div>
          </div>
          {balcao && p.convenios && p.convenios.length > 0 && (
            <div className="mt-4 max-w-md">
              <label className="label">Convênio (opcional)</label>
              <select className="input" value={convenioId} onChange={(e) => setConvenioId(e.target.value)}>
                <option value="">Sem convênio</option>
                {p.convenios.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} · −{c.descontoPercentual}%{c.faturado ? " · faturado" : ""}</option>
                ))}
              </select>
            </div>
          )}
          {conv?.faturado ? (
            <p className="mt-5 rounded-xl border border-rio-200 bg-rio-50 p-4 text-sm text-rio-900">
              Convênio <strong>faturado</strong>: o passageiro não paga agora. O valor entra na fatura de {conv.nome} e o bilhete é emitido na hora.
            </p>
          ) : (
          <div className={`mt-5 grid gap-3 ${balcao ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-2"}`}>
            {metodos.map((m) => {
              const disabled = !balcao && m.v === "CARTAO_CREDITO";
              return (
                <button
                  key={m.v}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMetodo(m.v)}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${metodo === m.v ? "border-rio-600 bg-rio-50 ring-2 ring-rio-600/20" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <span className={metodo === m.v ? "text-rio-700" : "text-slate-400"}>{m.icon}</span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{m.l}</span>
                    <span className="block text-xs text-slate-500">{m.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card overflow-hidden">
          <div className="bg-rio-900 p-5 text-white">{p.resumo}</div>
          <div className="space-y-2.5 p-5 text-sm">
            {itens.map((i, n) => (
              <div key={i.key} className="flex justify-between">
                <span className="text-slate-600">
                  {i.assentoId ? `Poltrona ${codigo.get(i.assentoId)}` : `Passageiro ${n + 1}`}
                  {i.assentoId && i.acrescimo > 0 && p.comodos?.[i.assentoId] && <span className="text-xs text-slate-400"> · {p.comodos[i.assentoId].nome}</span>}
                </span>
                <span className="font-medium tabular-nums">{money(i.valor)}</span>
              </div>
            ))}
            {taxas > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Taxa de embarque</span>
                <span className="font-medium tabular-nums">{money(taxas)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
              <span className="font-semibold text-slate-800">Total</span>
              <span className="text-2xl font-extrabold text-rio-900 tabular-nums">{money(total)}</span>
            </div>
            {modo === "auto" && !p.assentoLivre && (
              <p className="text-xs text-slate-500">
                Poltronas escolhidas pelo sistema na confirmação; os números saem no bilhete.
                {podeTerAcrescimo && " Restam poucas poltronas sem acréscimo: o valor final pode mudar e aparece antes do pagamento."}
              </p>
            )}
            {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            <button type="button" onClick={submit} disabled={pending} className={`${balcao ? "btn-primary" : "btn-sol"} mt-2 w-full py-3 text-base`}>
              {pending ? <Loader2 size={18} className="animate-spin" /> : null}
              {balcao ? (conv?.faturado ? "Emitir (faturado)" : metodo === "PIX" ? "Gerar cobrança PIX" : "Confirmar venda") : "Ir para pagamento"}
              {!pending && <ArrowRight size={18} />}
            </button>
            {!balcao && <p className="text-center text-xs text-slate-500">Poltronas reservadas por 30 min até a confirmação do pagamento.</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}
