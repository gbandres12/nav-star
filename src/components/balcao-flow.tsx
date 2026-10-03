"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Armchair, Banknote, Calendar, Check, Clock, CreditCard, Loader2, Minus, Plus, QrCode, RefreshCw, Search, Ship, Sparkles, Ticket, Trash2, TriangleAlert, User, X } from "lucide-react";
import { Combobox } from "./combobox";
import { QR } from "./qr";
import { SeatMap } from "./seat-map";
import { finalizarCompra } from "@/lib/actions";
import { date, money, time } from "@/lib/format";
import { brCodePix, type RecebedorPix } from "@/lib/pix";
import type { Assento, MetodoPagamento, TipoPassageiro } from "@/lib/types";
import type { ConvenioOpcao } from "./booking-flow";

// Criança de colo não é um "tipo" escolhido na lista: entra pelo contador do passo 2
const TIPOS: { v: TipoPassageiro; l: string }[] = [
  { v: "INTEIRA", l: "Inteira" },
  { v: "CRIANCA", l: "Criança" },
  { v: "IDOSO", l: "Idoso 60+" },
  { v: "ESTUDANTE", l: "Estudante" },
  { v: "PCD", l: "PCD" },
];
const rotuloDesconto = (d: number) => (d >= 1 ? " - gratuidade" : d > 0 ? ` - ${Math.round(d * 100)}%` : "");
const ehColo = (x: { tipo: TipoPassageiro }) => x.tipo === "COLO";

const PADRAO = "padrao";
const LIVRE = "livre";
const BARRA: Record<string, string> = { rio: "bg-rio-500", rubro: "bg-rubro-500", sol: "bg-amber-500", emerald: "bg-emerald-500" };

export type ComodoOpcao = { id: string; nome: string; acrescimo: number; cor: string };

type Props = {
  viagemId: string;
  origemOrdem: number;
  destinoOrdem: number;
  valor: number;
  taxa: number;
  assentos: Assento[];
  colunas: number;
  ocupados: string[];
  descontos: Record<TipoPassageiro, number>; // 0.5 = 50%
  isentosTaxa: Record<TipoPassageiro, boolean>;
  acrescimos: Record<string, number>;
  comodos: ComodoOpcao[];
  comodosMapa?: Record<string, { nome: string; cor: string }>; // legenda do mapa
  convenios: ConvenioOpcao[];
  livresSemAcrescimo: number;
  livres: number;
  assentoLivre: boolean;
  pix: RecebedorPix | null;
  caixaAberto: boolean;
  cabecalho: { origem: string; destino: string; saida: string; embarcacao: string };
  trechos: { value: string; label: string }[]; // "o-d" de cada trecho da linha
  voltarHref: string;
  resumo: React.ReactNode;
};

type Pax = { key: number; assentoId?: string; comodoId: string; nome: string; documento: string; nascimento?: string; tipo: TipoPassageiro };
type Modo = "auto" | "mapa";
type Passo = 1 | 2 | 3;

const campo = "w-full rounded-full border border-transparent bg-slate-100 py-3 pr-4 pl-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rio-600 focus:ring-4 focus:ring-rio-500/15";
const rotulo = "mb-1.5 block text-sm font-semibold text-rio-700";

export function BalcaoFlow(p: Props) {
  const router = useRouter();
  const max = Math.min(20, p.livres);
  const [passo, setPasso] = useState<Passo>(1);
  const [modo, setModo] = useState<Modo>("auto");
  const [seq, setSeq] = useState(1);
  const [pax, setPax] = useState<Pax[]>([]);
  const [comprador, setComprador] = useState({ nome: "", email: "", telefone: "" });
  const [metodo, setMetodo] = useState<MetodoPagamento>("DINHEIRO");
  const [convenioId, setConvenioId] = useState("");
  const [erro, setErro] = useState<string>();
  const [pending, start] = useTransition();
  const conv = p.convenios.find((c) => c.id === convenioId);
  const codigo = useMemo(() => new Map(p.assentos.map((a) => [a.id, a.codigo])), [p.assentos]);

  // Cômodos com lugares livres: o que o operador escolhe no passo 1
  const grupos = useMemo(() => {
    if (p.assentoLivre) return [{ id: LIVRE, nome: "Assento livre", acrescimo: 0, cor: "emerald", livres: p.livres, assentos: [] as Assento[] }];
    const ocup = new Set(p.ocupados);
    const info = new Map(p.comodos.map((c) => [c.id, c]));
    const por = new Map<string, { id: string; nome: string; acrescimo: number; cor: string; livres: number; assentos: Assento[] }>();
    for (const a of p.assentos) {
      const c = a.comodoId ? info.get(a.comodoId) : undefined;
      const id = c?.id ?? PADRAO;
      const g = por.get(id) ?? { id, nome: c?.nome ?? "Poltrona", acrescimo: c?.acrescimo ?? 0, cor: c?.cor ?? "emerald", livres: 0, assentos: [] };
      if (!ocup.has(a.id)) {
        g.livres++;
        g.assentos.push(a);
      }
      por.set(id, g);
    }
    for (const g of por.values()) g.assentos.sort((a, b) => a.fileira - b.fileira || a.coluna - b.coluna);
    return [...por.values()].sort((a, b) => a.acrescimo - b.acrescimo);
  }, [p.assentoLivre, p.livres, p.assentos, p.comodos, p.ocupados]);
  const grupo = (id: string) => grupos.find((g) => g.id === id);
  const assentoGrupo = useMemo(() => new Map(p.assentos.map((a) => [a.id, a.comodoId ?? PADRAO])), [p.assentos]);
  const grupoDe = (x: Pax) => (x.assentoId ? (assentoGrupo.get(x.assentoId) ?? PADRAO) : x.comodoId);

  const adultos = pax.filter((x) => !ehColo(x));
  const colos = pax.filter(ehColo);
  const sel = modo === "mapa" ? adultos.map((x) => x.assentoId).filter((a): a is string => !!a) : [];

  const novoPax = (comodoId: string, assentoId?: string): Pax => ({ key: seq, comodoId, assentoId, nome: "", documento: "", tipo: "INTEIRA" });
  const editar = (key: number, campos: Partial<Pax>) => setPax((l) => l.map((x) => (x.key === key ? { ...x, ...campos } : x)));
  const incluir = (x: Pax) => {
    setPax((l) => [...l.filter((y) => !ehColo(y)), x, ...l.filter(ehColo)]); // colos ficam sempre no fim
    setSeq((s) => s + 1);
  };

  function maisUm(g: (typeof grupos)[number]) {
    setErro(undefined);
    if (pax.length >= max) return setErro(max ? `Máximo de ${max} passageiros por venda.` : "Não há lugares livres neste trecho.");
    const jaNoGrupo = adultos.filter((x) => grupoDe(x) === g.id).length;
    if (jaNoGrupo >= g.livres) return setErro(`Não há mais lugares livres em ${g.nome}.`);
    if (modo === "mapa" && !p.assentoLivre) {
      const usados = new Set(adultos.map((x) => x.assentoId));
      const livre = g.assentos.find((a) => !usados.has(a.id));
      if (!livre) return setErro(`Não há mais lugares livres em ${g.nome}.`);
      return incluir(novoPax(g.id, livre.id));
    }
    incluir(novoPax(g.id));
  }

  function menosUm(g: (typeof grupos)[number]) {
    setErro(undefined);
    const ultimo = [...adultos].reverse().find((x) => grupoDe(x) === g.id);
    if (ultimo) setPax((l) => l.filter((x) => x.key !== ultimo.key));
  }

  function remover(key: number) {
    setErro(undefined);
    setPax((l) => l.filter((x) => x.key !== key));
  }

  function trocarModo(m: Modo) {
    setErro(undefined);
    if (m === modo) return;
    // No automático o sistema escolhe a poltrona: cômodos com acréscimo só no mapa
    if (m === "auto") setPax((l) => l.filter((x) => ehColo(x) || (grupo(grupoDe(x))?.acrescimo ?? 0) === 0).map((x) => ({ ...x, assentoId: undefined })));
    setModo(m);
  }

  /** No mapa: clicar numa poltrona livre dá ela ao próximo passageiro sem poltrona (ou cria um novo) */
  function toggle(id: string) {
    setErro(undefined);
    const dono = adultos.find((x) => x.assentoId === id);
    if (dono) return remover(dono.key);
    const semPoltrona = adultos.find((x) => !x.assentoId);
    const gid = assentoGrupo.get(id) ?? PADRAO;
    if (semPoltrona) return editar(semPoltrona.key, { assentoId: id, comodoId: gid });
    if (pax.length >= max) return setErro(`Máximo de ${max} passageiros por venda.`);
    incluir(novoPax(gid, id));
  }

  function maisColo() {
    setErro(undefined);
    if (colos.length >= adultos.length) return setErro("Cada criança de colo precisa de um adulto com lugar no mesmo pedido.");
    if (pax.length >= max) return setErro(`Máximo de ${max} passageiros por venda.`);
    setPax((l) => [...l, { key: seq, comodoId: PADRAO, nome: "", documento: "", tipo: "COLO" }]);
    setSeq((s) => s + 1);
  }

  // Desconto do passageiro parte da tabela; tarifa de convênio é outro teto para a passagem.
  const itens = pax.map((x) => {
    const acrescimo = modo === "mapa" && x.assentoId ? (p.acrescimos[x.assentoId] ?? 0) : 0;
    const desc = Math.min(1, Math.max(p.descontos[x.tipo] ?? 0, (conv?.descontoPercentual ?? 0) / 100));
    const tarifa = Math.min(p.valor * (1 - desc), conv?.tarifaEspecial ?? Infinity);
    return { key: x.key, valor: Math.round((tarifa + acrescimo) * 100) / 100, acrescimo };
  });
  const valorDe = (key: number) => itens.find((i) => i.key === key)?.valor ?? 0;
  const subtotal = itens.reduce((s, i) => s + i.valor, 0);
  const taxas = p.taxa * pax.filter((x) => !p.isentosTaxa[x.tipo]).length;
  const total = subtotal + taxas;
  const podeTerAcrescimo = modo === "auto" && adultos.length > p.livresSemAcrescimo;
  const nomeGrupo = (x: Pax) => (ehColo(x) ? "Criança de colo" : (grupo(grupoDe(x))?.nome ?? "Poltrona"));

  function validar(alvo: Passo): string | undefined {
    if (alvo >= 2) {
      if (!adultos.length) return "Selecione ao menos um lugar para continuar.";
      if (modo === "mapa" && !p.assentoLivre && adultos.some((x) => !x.assentoId)) return "Escolha uma poltrona no mapa para cada passageiro, ou volte para “Sistema escolhe a poltrona”.";
      if (podeTerAcrescimo) return "Restam poucas poltronas sem acréscimo: escolha as poltronas no mapa para conferir o valor exato.";
    }
    if (alvo >= 3) {
      if (colos.length > adultos.length) return "Cada criança de colo precisa de um adulto com lugar no mesmo pedido.";
      if (pax.some((x) => x.nome.trim().length < 3 || x.documento.replace(/\D/g, "").length < 5)) return "Preencha nome completo e documento de cada passageiro.";
    }
  }

  function ir(alvo: Passo) {
    if (alvo > passo) {
      const e = validar(alvo);
      if (e) return setErro(e);
    }
    setErro(undefined);
    setPasso(alvo);
  }

  function emitir() {
    const e = validar(3);
    if (e) return setErro(e);
    setErro(undefined);
    start(async () => {
      const r = await finalizarCompra({
        viagemId: p.viagemId,
        origemOrdem: p.origemOrdem,
        destinoOrdem: p.destinoOrdem,
        canal: "BALCAO",
        // No balcão a venda sai paga: o PIX é conferido na tela antes de confirmar
        pagoNoAto: true,
        metodo: conv?.faturado ? "FATURADO" : metodo,
        convenioId: convenioId || undefined,
        comprador: { nome: comprador.nome || pax[0].nome, telefone: comprador.telefone, email: comprador.email },
        passageiros: pax.map(({ assentoId, nome, documento, nascimento, tipo }) => ({ assentoId: modo === "mapa" && tipo !== "COLO" ? assentoId : undefined, nome, documento, nascimento: nascimento || undefined, tipo })),
      });
      if (r?.erro) setErro(r.erro);
    });
  }

  function trocarTrecho(v: string) {
    const [o, d] = v.split("-");
    if (`${o}-${d}` === `${p.origemOrdem}-${p.destinoOrdem}`) return;
    if (pax.some((x) => x.nome || x.documento) && !window.confirm("Trocar o trecho apaga os dados já digitados. Continuar?")) return;
    router.push(`/admin/vender/${p.viagemId}?o=${o}&d=${d}`);
  }

  const metodos: { v: MetodoPagamento; l: string; icon: React.ReactNode; hint: string }[] = [
    { v: "DINHEIRO", l: "Dinheiro", icon: <Banknote size={18} />, hint: "Recebido no caixa" },
    { v: "PIX", l: "PIX", icon: <QrCode size={18} />, hint: "Gera QR para o cliente" },
    { v: "CARTAO_DEBITO", l: "Débito", icon: <CreditCard size={18} />, hint: "Maquininha" },
    { v: "CARTAO_CREDITO", l: "Crédito", icon: <CreditCard size={18} />, hint: "Maquininha" },
  ];
  const etapas = ["Escolha o Cômodo", "Dados dos Passageiros", "Pagamento e Emissão"];
  const saida = new Date(p.cabecalho.saida);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-rubro-500 px-4 py-3 text-white sm:px-5">
        <Ship size={22} className="shrink-0" />
        <h1 className="text-lg font-bold">{p.cabecalho.origem} <span className="font-normal">→</span> {p.cabecalho.destino}</h1>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Ida</span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold"><Clock size={13} /> {date(saida)} às {time(saida)}</span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase"><Ship size={13} /> {p.cabecalho.embarcacao}</span>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <div className="w-56 sm:w-72">
            <Combobox
              tom="branco"
              ariaLabel="Alterar trecho"
              placeholder="Alterar trecho"
              buscaPlaceholder="Alterar trecho"
              opcoes={p.trechos}
              value={`${p.origemOrdem}-${p.destinoOrdem}`}
              onChange={trocarTrecho}
            />
          </div>
          <Link href={p.voltarHref} aria-label="Fechar e voltar à lista de saídas" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 hover:bg-white/30">
            <X size={20} />
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
        <ol className="mx-auto flex max-w-4xl items-start px-4 pt-5 pb-2" aria-label="Etapas da venda">
          {etapas.map((nome, i) => {
            const n = (i + 1) as Passo;
            const feito = passo > n;
            return (
              <li key={nome} className={`flex items-start ${i < etapas.length - 1 ? "flex-1" : ""}`}>
                <button
                  type="button"
                  onClick={() => (n < passo ? ir(n) : undefined)}
                  disabled={n >= passo}
                  aria-current={passo === n ? "step" : undefined}
                  className="flex w-24 shrink-0 flex-col items-center gap-1.5 text-center sm:w-40"
                >
                  <span className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold transition ${passo === n ? "bg-rio-900 text-white ring-4 ring-rio-200" : feito ? "bg-rio-900 text-white" : "border-2 border-slate-300 bg-white text-slate-400"}`}>
                    {feito ? <Check size={18} strokeWidth={3} /> : n}
                  </span>
                  <span className={`text-xs leading-tight font-semibold ${passo >= n ? "text-rio-900" : "text-slate-400"}`}>{nome}</span>
                </button>
                {i < etapas.length - 1 && <span className={`mt-5 h-0.5 flex-1 rounded ${feito ? "bg-rio-900" : "bg-slate-200"}`} />}
              </li>
            );
          })}
        </ol>

        <div className="mx-auto max-w-7xl px-4 pt-4 pb-8 sm:px-6">
          {erro && <p role="alert" className="sticky top-2 z-30 mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 shadow-sm">{erro}</p>}

          {passo === 1 && (
            <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
              <div className="min-w-0 space-y-5">
                <section className="card">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h2 className="font-bold text-slate-900">Cômodos</h2>
                    <button type="button" onClick={() => router.refresh()} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-rio-700">
                      <RefreshCw size={15} /> Atualizar
                    </button>
                  </div>
                  <div className="p-5">
                    {!p.assentoLivre && (
                      <div className="mb-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Como escolher a poltrona">
                        {([
                          ["auto", <Sparkles key="i" size={18} />, "Sistema escolhe a poltrona", "Reserva lugares juntos, sem acréscimo, na hora da venda"],
                          ["mapa", <Armchair key="i" size={18} />, "Escolher no mapa", "Marque cada poltrona; cômodos com acréscimo só aqui"],
                        ] as const).map(([v, icon, titulo, desc]) => (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={modo === v}
                            onClick={() => trocarModo(v)}
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
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {grupos.map((g) => {
                        const qtd = adultos.filter((x) => grupoDe(x) === g.id).length;
                        const bloqueado = modo === "auto" && !p.assentoLivre && g.acrescimo > 0;
                        const semLugar = g.livres === 0;
                        return (
                          <div key={g.id} className={`overflow-hidden rounded-2xl border-2 bg-white transition ${qtd ? "border-rio-600 shadow-md" : "border-slate-200"} ${bloqueado || semLugar ? "opacity-60" : ""}`}>
                            <div className={`h-1.5 ${semLugar ? "bg-slate-300" : (BARRA[g.cor] ?? BARRA.emerald)}`} />
                            <div className="p-4">
                              <div className="flex items-center justify-between">
                                <Armchair size={20} className="text-slate-400" />
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${semLugar ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{g.livres} disp.</span>
                              </div>
                              <p className="mt-3 text-sm font-extrabold tracking-wide text-slate-900 uppercase">{g.nome}</p>
                              <p className="mt-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Preço/pessoa</p>
                              <div className="mt-0.5 flex items-center justify-between gap-2">
                                <p className="text-xl font-extrabold text-slate-900 tabular-nums">{money(p.valor + g.acrescimo)}</p>
                                {qtd > 0 ? (
                                  <div className="flex items-center gap-1 rounded-xl bg-rio-50 p-1">
                                    <button type="button" onClick={() => menosUm(g)} aria-label={`Tirar um lugar de ${g.nome}`} className="grid h-8 w-8 place-items-center rounded-lg text-rio-800 hover:bg-white"><Minus size={16} /></button>
                                    <span className="w-6 text-center text-sm font-bold text-rio-900 tabular-nums">{qtd}</span>
                                    <button type="button" onClick={() => maisUm(g)} disabled={semLugar || bloqueado} aria-label={`Mais um lugar em ${g.nome}`} className="grid h-8 w-8 place-items-center rounded-lg text-rio-800 hover:bg-white disabled:opacity-40"><Plus size={16} /></button>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => maisUm(g)} disabled={semLugar || bloqueado} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200 disabled:cursor-not-allowed">
                                    Selecionar
                                  </button>
                                )}
                              </div>
                              {bloqueado && <p className="mt-2 text-xs text-amber-700">Acréscimo de cômodo: escolha no mapa.</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {p.assentoLivre && (
                      <p className="mt-4 rounded-xl border border-rio-200 bg-rio-50 p-4 text-sm text-rio-900">
                        <strong>Assento livre.</strong> Nesta embarcação as poltronas não são numeradas: cada passageiro escolhe o lugar ao embarcar, por ordem de chegada.
                      </p>
                    )}
                  </div>
                </section>

                {modo === "mapa" && !p.assentoLivre && (
                  <section className="card p-5">
                    <h2 className="mb-4 font-bold text-slate-900">Mapa da embarcação</h2>
                    <SeatMap assentos={p.assentos} colunas={p.colunas} ocupados={p.ocupados} selecionados={sel} onToggle={toggle} comodos={p.comodosMapa} />
                  </section>
                )}
              </div>

              <aside className="card overflow-hidden lg:sticky lg:top-0">
                <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
                  <Ticket size={20} className="text-rio-900" />
                  <h2 className="font-bold text-slate-900">Lugares Selecionados <span className="font-normal">— Ida</span></h2>
                </div>
                {pax.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-slate-400">
                    <Ticket size={36} className="mx-auto mb-3 text-slate-300" />
                    Nenhum cômodo selecionado.<br />Escolha um ao lado.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {pax.map((x, i) => (
                      <li key={x.key} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">Passageiro {i + 1}</p>
                          <p className="truncate text-xs text-slate-500">
                            {nomeGrupo(x)}
                            {!ehColo(x) && modo === "mapa" && (x.assentoId ? ` · Poltrona ${codigo.get(x.assentoId)}` : " · escolha a poltrona no mapa")}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums">{money(valorDe(x.key))}</span>
                        <button type="button" onClick={() => remover(x.key)} className="text-slate-400 hover:text-red-600" aria-label={`Remover passageiro ${i + 1}`}><Trash2 size={16} /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-baseline justify-between border-t border-slate-200 bg-slate-50 px-5 py-4">
                  <span className="font-semibold text-slate-800">Total</span>
                  <span className="text-xl font-extrabold text-rio-900 tabular-nums">{money(total)}</span>
                </div>
              </aside>
            </div>
          )}

          {passo === 2 && (
            <section className="mx-auto max-w-5xl space-y-4">
              <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <h2 className="font-bold text-slate-900">Dados da Ida</h2>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>há crianças de colo?</span>
                  <span className="font-bold text-rio-900 tabular-nums">{colos.length}/{adultos.length}</span>
                  <button type="button" onClick={() => colos.length && remover(colos[colos.length - 1].key)} disabled={!colos.length} aria-label="Tirar uma criança de colo" className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Minus size={16} /></button>
                  <button type="button" onClick={maisColo} aria-label="Adicionar uma criança de colo" className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50"><Plus size={16} /></button>
                </div>
              </div>

              {pax.map((x, i) => (
                <div key={x.key} className="card p-5">
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <p className="text-sm font-semibold text-slate-700">
                      Passageiro {i + 1} · {nomeGrupo(x)}
                      {!ehColo(x) && modo === "mapa" && x.assentoId && ` · Poltrona ${codigo.get(x.assentoId)}`}
                      {ehColo(x) && <span className="font-normal text-slate-500"> · no colo de um adulto, sem poltrona</span>}
                      {" : "}
                      <span className="font-bold text-emerald-600">{money(valorDe(x.key))}</span>
                    </p>
                    {pax.length > 1 && (
                      <button type="button" onClick={() => remover(x.key)} className="text-slate-400 hover:text-red-600" aria-label={`Remover passageiro ${i + 1}`}><Trash2 size={16} /></button>
                    )}
                  </div>
                  <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                    <div>
                      <label className={rotulo} htmlFor={`doc-${x.key}`}>Número do Documento</label>
                      <div className="relative">
                        <Search size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
                        <input id={`doc-${x.key}`} className={campo} inputMode="numeric" value={x.documento} onChange={(e) => editar(x.key, { documento: e.target.value })} placeholder="CPF ou RG" />
                      </div>
                    </div>
                    <div>
                      <label className={rotulo} htmlFor={`nome-${x.key}`}>Nome do Passageiro</label>
                      <div className="relative">
                        <User size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
                        <input id={`nome-${x.key}`} className={campo} value={x.nome} onChange={(e) => editar(x.key, { nome: e.target.value })} placeholder="Digite o nome completo" />
                      </div>
                    </div>
                    {!ehColo(x) && (
                      <div>
                        <label className={rotulo} htmlFor={`tipo-${x.key}`}>Tipo de passageiro</label>
                        <Combobox
                          id={`tipo-${x.key}`}
                          busca={false}
                          opcoes={TIPOS.map((t) => ({ value: t.v, label: `${t.l}${rotuloDesconto(p.descontos[t.v] ?? 0)}` }))}
                          value={x.tipo}
                          onChange={(v) => editar(x.key, { tipo: v as TipoPassageiro })}
                        />
                      </div>
                    )}
                    <div>
                      <label className={rotulo} htmlFor={`nasc-${x.key}`}>Data de Nascimento <span className="font-normal text-slate-400">(opcional)</span></label>
                      <div className="relative">
                        <Calendar size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
                        <input id={`nasc-${x.key}`} type="date" min="1900-01-01" className={campo} value={x.nascimento ?? ""} onChange={(e) => editar(x.key, { nascimento: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {pax.some((x) => x.tipo !== "INTEIRA") && (
                <p className="flex items-start gap-2 text-xs text-amber-700">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  Descontos e gratuidades exigem apresentação de documento comprobatório no embarque.
                  {modo === "auto" && !p.assentoLivre && " Idosos e PCD ficam na fileira preferencial quando houver lugar."}
                </p>
              )}
            </section>
          )}

          {passo === 3 && (
            <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
              <section className="card min-w-0 p-5 sm:p-6">
                <h2 className="mb-4 font-bold text-slate-900">Cliente e pagamento</h2>
                {!p.caixaAberto && (
                  <p className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Seu caixa está fechado: vendas em dinheiro ficam bloqueadas (PIX e cartão continuam liberados).
                    <Link href="/admin/caixa" className="font-semibold underline">Abrir caixa</Link>
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">Nome do comprador (opcional)</label>
                    <input className="input" value={comprador.nome} onChange={(e) => setComprador({ ...comprador, nome: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">WhatsApp (opcional)</label>
                    <input className="input" inputMode="tel" value={comprador.telefone} onChange={(e) => setComprador({ ...comprador, telefone: e.target.value })} placeholder="(92) 9 0000-0000" />
                  </div>
                  <div>
                    <label className="label">E-mail (opcional)</label>
                    <input className="input" type="email" value={comprador.email} onChange={(e) => setComprador({ ...comprador, email: e.target.value })} />
                  </div>
                </div>
                {p.convenios.length > 0 && (
                  <div className="mt-4 max-w-md">
                    <label className="label" htmlFor="convenio">Convênio (opcional)</label>
                    <Combobox
                      id="convenio"
                      busca={p.convenios.length > 6}
                      paraCima
                      opcoes={[
                        { value: "", label: "Sem convênio" },
                        ...p.convenios.map((c) => ({
                          value: c.id,
                          label: `${c.nome}${c.tarifaEspecial != null ? ` · tarifa ${money(c.tarifaEspecial)}` : ` · −${c.descontoPercentual}%`}${c.faturado ? " · faturado" : ""}`,
                        })),
                      ]}
                      value={convenioId}
                      onChange={setConvenioId}
                    />
                  </div>
                )}
                {conv?.faturado ? (
                  <p className="mt-5 rounded-xl border border-rio-200 bg-rio-50 p-4 text-sm text-rio-900">
                    Convênio <strong>faturado</strong>: o passageiro não paga agora. O valor entra na fatura de {conv.nome} e o bilhete é emitido na hora.
                  </p>
                ) : (
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {metodos.map((m) => (
                      <button
                        key={m.v}
                        type="button"
                        onClick={() => setMetodo(m.v)}
                        className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${metodo === m.v ? "border-rio-600 bg-rio-50 ring-2 ring-rio-600/20" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <span className={metodo === m.v ? "text-rio-700" : "text-slate-400"}>{m.icon}</span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">{m.l}</span>
                          <span className="block text-xs text-slate-500">{m.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <aside className="card overflow-hidden lg:sticky lg:top-0">
                <div className="bg-rio-900 p-5 text-white">{p.resumo}</div>
                <div className="space-y-2.5 p-5 text-sm">
                  {pax.map((x, n) => (
                    <div key={x.key} className="flex justify-between">
                      <span className="text-slate-600">
                        {ehColo(x) ? "Criança de colo" : modo === "mapa" && x.assentoId ? `Poltrona ${codigo.get(x.assentoId)}` : `Passageiro ${n + 1}`}
                        {!ehColo(x) && (grupo(grupoDe(x))?.acrescimo ?? 0) > 0 && modo === "mapa" && <span className="text-xs text-slate-400"> · {nomeGrupo(x)}</span>}
                      </span>
                      <span className="font-medium tabular-nums">{money(valorDe(x.key))}</span>
                    </div>
                  ))}
                  {taxas > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Taxa de embarque</span>
                      <span className="font-medium tabular-nums">{money(taxas)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-slate-400">
                      <span>Taxa de embarque</span>
                      <span>não cobrada</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
                    <span className="font-semibold text-slate-800">Total</span>
                    <span className="text-2xl font-extrabold text-rio-900 tabular-nums">{money(total)}</span>
                  </div>
                  {modo === "auto" && !p.assentoLivre && (
                    <p className="text-xs text-slate-500">Poltronas escolhidas pelo sistema na confirmação; os números saem no bilhete.</p>
                  )}
                  {metodo === "PIX" && !conv?.faturado && total > 0 && (
                    <div className="rounded-xl border border-slate-200 p-3 text-center">
                      {p.pix ? (
                        <>
                          <div className="mx-auto w-fit"><QR value={brCodePix(p.pix, { valor: total, txid: "BALCAO" })} size={168} /></div>
                          <p className="mt-2 text-xs text-slate-600">Mostre ao cliente. Confirme a venda <strong>só depois de ver o PIX de {money(total)} recebido</strong>.</p>
                        </>
                      ) : (
                        <p className="text-xs text-amber-800">Chave PIX não cadastrada (Configurações → Pagamento). Receba pela chave da empresa e confirme.</p>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>

      <footer className="flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">{pax.length} {pax.length === 1 ? "passageiro" : "passageiros"}</p>
          <p className="text-lg leading-tight font-extrabold text-rio-900 tabular-nums">{money(total)}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {passo > 1 && (
            <button type="button" onClick={() => ir((passo - 1) as Passo)} disabled={pending} className="btn bg-slate-200 px-6 text-rio-900 uppercase hover:bg-slate-300">Voltar</button>
          )}
          {passo < 3 ? (
            <button type="button" onClick={() => ir((passo + 1) as Passo)} className="btn-primary btn px-8 uppercase">Avançar</button>
          ) : (
            <button type="button" onClick={emitir} disabled={pending} className="btn-sol btn px-6 py-3 text-base">
              {pending ? <Loader2 size={18} className="animate-spin" /> : null}
              {conv?.faturado ? "Emitir (faturado)" : metodo === "PIX" ? "PIX recebido — emitir" : "Confirmar venda"}
              {!pending && <ArrowRight size={18} />}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
