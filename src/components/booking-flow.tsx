"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, CreditCard, Loader2, QrCode, Banknote, Trash2, TriangleAlert } from "lucide-react";
import { SeatMap } from "./seat-map";
import { finalizarCompra } from "@/lib/actions";
import { money } from "@/lib/format";
import type { Assento, CanalVenda, MetodoPagamento, TipoPassageiro } from "@/lib/types";

const TIPOS: { v: TipoPassageiro; l: string; desc: number }[] = [
  { v: "INTEIRA", l: "Inteira", desc: 0 },
  { v: "CRIANCA", l: "Criança 2–11 anos (50%)", desc: 0.5 },
  { v: "IDOSO", l: "Idoso 60+ (50%)", desc: 0.5 },
  { v: "ESTUDANTE", l: "Estudante (50%)", desc: 0.5 },
  { v: "PCD", l: "PCD (gratuidade)", desc: 1 },
];

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
};

type Pax = { nome: string; documento: string; tipo: TipoPassageiro };

export function BookingFlow(p: Props) {
  const balcao = p.canal !== "SITE";
  const max = balcao ? 20 : 6;
  const [sel, setSel] = useState<string[]>([]);
  const [pax, setPax] = useState<Record<string, Pax>>({});
  const [comprador, setComprador] = useState({ nome: "", email: "", telefone: "" });
  const [metodo, setMetodo] = useState<MetodoPagamento>(balcao ? "DINHEIRO" : "PIX");
  const [erro, setErro] = useState<string>();
  const [pending, start] = useTransition();
  const codigo = useMemo(() => new Map(p.assentos.map((a) => [a.id, a.codigo])), [p.assentos]);

  function toggle(id: string) {
    setErro(undefined);
    setSel((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= max) {
        setErro(`Máximo de ${max} poltronas por compra.`);
        return s;
      }
      return [...s, id];
    });
    setPax((x) => (x[id] ? x : { ...x, [id]: { nome: "", documento: "", tipo: "INTEIRA" } }));
  }

  const itens = sel.map((id) => {
    const px = pax[id];
    const desc = TIPOS.find((t) => t.v === px?.tipo)?.desc ?? 0;
    return { id, valor: Math.round(p.valor * (1 - desc) * 100) / 100 };
  });
  const subtotal = itens.reduce((s, i) => s + i.valor, 0);
  const taxas = p.taxa * sel.length;
  const total = subtotal + taxas;

  function submit() {
    setErro(undefined);
    if (!sel.length) return setErro("Escolha pelo menos uma poltrona no mapa.");
    const faltando = sel.some((id) => (pax[id]?.nome.trim().length ?? 0) < 3 || (pax[id]?.documento.replace(/\D/g, "").length ?? 0) < 5);
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
        metodo,
        comprador: balcao
          ? { nome: comprador.nome || pax[sel[0]].nome, telefone: comprador.telefone || "-", email: comprador.email }
          : comprador,
        passageiros: sel.map((id) => ({ assentoId: id, ...pax[id] })),
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">1. Escolha as poltronas</h2>
            <span className="text-sm text-slate-500">
              {p.assentos.length - p.ocupados.length} livres neste trecho
            </span>
          </div>
          <SeatMap assentos={p.assentos} colunas={p.colunas} ocupados={p.ocupados} selecionados={sel} onToggle={toggle} />
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 font-bold text-slate-900">2. Passageiros</h2>
          {!sel.length && <p className="text-sm text-slate-500">Selecione as poltronas no mapa para preencher os dados.</p>}
          <div className="space-y-4">
            {sel.map((id, i) => (
              <div key={id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">
                    Passageiro {i + 1} · <span className="text-rio-700">Poltrona {codigo.get(id)}</span>
                  </p>
                  <button type="button" onClick={() => toggle(id)} className="text-slate-400 hover:text-red-600" aria-label="Remover">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[2fr_1.2fr_1.4fr]">
                  <div>
                    <label className="label">Nome completo</label>
                    <input className="input" value={pax[id]?.nome ?? ""} onChange={(e) => setPax({ ...pax, [id]: { ...pax[id], nome: e.target.value } })} placeholder="Como no documento" />
                  </div>
                  <div>
                    <label className="label">CPF ou RG</label>
                    <input className="input" inputMode="numeric" value={pax[id]?.documento ?? ""} onChange={(e) => setPax({ ...pax, [id]: { ...pax[id], documento: e.target.value } })} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className="label">Tipo</label>
                    <select className="input" value={pax[id]?.tipo ?? "INTEIRA"} onChange={(e) => setPax({ ...pax, [id]: { ...pax[id], tipo: e.target.value as TipoPassageiro } })}>
                      {TIPOS.map((t) => (
                        <option key={t.v} value={t.v}>{t.l}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {sel.some((id) => pax[id]?.tipo && pax[id].tipo !== "INTEIRA") && (
            <p className="mt-3 flex items-start gap-2 text-xs text-amber-700">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              Descontos e gratuidades exigem apresentação de documento comprobatório no embarque.
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
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card overflow-hidden">
          <div className="bg-rio-900 p-5 text-white">{p.resumo}</div>
          <div className="space-y-2.5 p-5 text-sm">
            {sel.length === 0 && <p className="text-slate-500">Nenhuma poltrona selecionada.</p>}
            {itens.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span className="text-slate-600">Poltrona {codigo.get(i.id)}</span>
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
            {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            <button type="button" onClick={submit} disabled={pending} className={`${balcao ? "btn-primary" : "btn-sol"} mt-2 w-full py-3 text-base`}>
              {pending ? <Loader2 size={18} className="animate-spin" /> : null}
              {balcao ? (metodo === "PIX" ? "Gerar cobrança PIX" : "Confirmar venda") : "Ir para pagamento"}
              {!pending && <ArrowRight size={18} />}
            </button>
            {!balcao && <p className="text-center text-xs text-slate-500">Poltronas reservadas por 30 min até a confirmação do pagamento.</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}
