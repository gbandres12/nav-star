import "server-only";
import { randomBytes } from "node:crypto";
import { addMinutes, localDayKey, manausDate } from "./format";
import { seed, type Db } from "./seed";
import type {
  Assento,
  CaixaSessao,
  CanalVenda,
  Configuracao,
  Encomenda,
  Festival,
  Linha,
  MetodoPagamento,
  Passagem,
  Pedido,
  StatusEncomenda,
  StatusViagem,
  TipoPassageiro,
  Viagem,
} from "./types";

// Banco em memória do protótipo. Na Fase A é trocado pelo Supabase mantendo as mesmas funções
// (a interface das telas não muda). VERSAO força um novo seed quando o formato dos dados muda.
const VERSAO = 4;
const g = globalThis as unknown as { __navstarDb?: Db; __navstarDbVersao?: number };
export function db(): Db {
  if (!g.__navstarDb || g.__navstarDbVersao !== VERSAO) {
    g.__navstarDb = seed();
    g.__navstarDbVersao = VERSAO;
  }
  return g.__navstarDb;
}

export const config = () => db().config;

/** Dados da empresa — sempre lidos da configuração atual (editável em /admin/configuracoes) */
export const EMPRESA = new Proxy({} as Configuracao["empresa"], {
  get: (_, k) => db().config.empresa[k as keyof Configuracao["empresa"]],
});

const code = (prefix: string, len = 6) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(len);
  return `${prefix}-${Array.from(bytes, (b) => chars[b % chars.length]).join("")}`;
};
const uid = (prefix: string) => `${prefix}-${randomBytes(6).toString("hex")}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };
const falha = (erro: string) => ({ ok: false as const, erro });

// ─── Leituras básicas ──────────────────────────────────────────

export const cidade = (id: string) => db().cidades.find((c) => c.id === id)!;
export const porto = (id: string) => db().portos.find((p) => p.id === id)!;
export const linha = (id: string) => db().linhas.find((l) => l.id === id)!;
export const embarcacao = (id: string) => db().embarcacoes.find((e) => e.id === id)!;
export const viagem = (id: string) => db().viagens.find((v) => v.id === id);
export const pedidoPorCodigo = (c: string) => db().pedidos.find((p) => p.codigo === c.toUpperCase());
export const passagensDoPedido = (pedidoId: string) => db().passagens.filter((p) => p.pedidoId === pedidoId);
export const encomendaPorCodigo = (c: string) => db().encomendas.find((e) => e.codigo === c.toUpperCase().trim());
export const usuario = (id?: string) => db().usuarios.find((u) => u.id === id);
export const tripulante = (id: string) => db().tripulantes.find((t) => t.id === id);
export const convenio = (id?: string) => db().convenios.find((c) => c.id === id);
export const comodosDaEmbarcacao = (id: string) => db().comodos.filter((c) => c.embarcacaoId === id);

export function paradaInfo(linhaId: string, ordem: number) {
  const l = linha(linhaId);
  const parada = l.paradas[ordem];
  const p = porto(parada.portoId);
  return { ...parada, porto: p, cidade: cidade(p.cidadeId) };
}

export function horarioParada(v: Viagem, ordem: number) {
  return addMinutes(v.partida, linha(v.linhaId).paradas[ordem].minutosDesdeOrigem);
}

export const chegadaFinal = (v: Viagem) => horarioParada(v, linha(v.linhaId).paradas.length - 1);

/** Cidades atendidas, na ordem do rio */
export function cidadesAtendidas() {
  const ids = new Set(db().linhas.filter((l) => l.ativa).flatMap((l) => l.paradas.map((p) => porto(p.portoId).cidadeId)));
  return db().cidades.filter((c) => ids.has(c.id));
}

// ─── Ocupação por trecho ───────────────────────────────────────

function passagemAtiva(p: Passagem, agora = new Date()) {
  if (p.status === "CANCELADA") return false;
  if (p.status === "RESERVADA") {
    const ped = db().pedidos.find((x) => x.id === p.pedidoId)!;
    return ped.status === "AGUARDANDO_PAGAMENTO" && !!ped.expiraEm && new Date(ped.expiraEm) > agora;
  }
  return true;
}

/** Assentos indisponíveis para o trecho [origem, destino) — sobreposição de segmentos */
export function assentosOcupados(viagemId: string, origem: number, destino: number) {
  const set = new Set<string>();
  for (const p of db().passagens) {
    if (p.viagemId !== viagemId || !p.assentoId || !passagemAtiva(p)) continue;
    if (p.origemOrdem < destino && origem < p.destinoOrdem) set.add(p.assentoId);
  }
  return set;
}

/** Lugares da embarcação: poltronas do mapa ou, no assento livre, a lotação cadastrada */
export const capacidade = (e: { assentoLivre?: boolean; capacidadePassageiros: number; assentos: Assento[] }) =>
  e.assentoLivre ? e.capacidadePassageiros : e.assentos.length;

/** Passageiros a bordo em cada segmento (segmento N = entre a parada N e a N+1) */
export function passageirosPorSegmento(v: Viagem) {
  const cont = new Array(linha(v.linhaId).paradas.length - 1).fill(0);
  for (const p of db().passagens) {
    if (p.viagemId !== v.id || !passagemAtiva(p)) continue;
    for (let s = p.origemOrdem; s < p.destinoOrdem; s++) cont[s]++;
  }
  return cont as number[];
}

export function lugaresLivres(v: Viagem, origem: number, destino: number) {
  const e = embarcacao(v.embarcacaoId);
  if (!e.assentoLivre) return e.assentos.length - assentosOcupados(v.id, origem, destino).size;
  const seg = passageirosPorSegmento(v).slice(origem, destino);
  return Math.max(0, e.capacidadePassageiros - Math.max(0, ...seg));
}

/** Ocupação máxima entre os segmentos (para lotação da viagem inteira) */
export function ocupacaoViagem(v: Viagem) {
  const total = capacidade(embarcacao(v.embarcacaoId));
  const max = Math.max(0, ...passageirosPorSegmento(v));
  return { ocupados: max, total, pct: total ? Math.round((max / total) * 100) : 0 };
}

/** Código da poltrona para telas e bilhete ("Livre" no assento livre) */
export function rotuloAssento(p: Passagem) {
  if (!p.assentoId) return "Livre";
  const v = viagem(p.viagemId);
  return (v && embarcacao(v.embarcacaoId).assentos.find((a) => a.id === p.assentoId)?.codigo) ?? "—";
}

export const passagensDaViagem = (viagemId: string) => db().passagens.filter((p) => p.viagemId === viagemId && p.status !== "CANCELADA");

// ─── Preço ─────────────────────────────────────────────────────

/** Acréscimo de cada poltrona conforme o cômodo (acomodação) */
export function acrescimosEmbarcacao(embarcacaoId: string): Record<string, number> {
  const cm = new Map(comodosDaEmbarcacao(embarcacaoId).map((c) => [c.id, c.acrescimo]));
  return Object.fromEntries(embarcacao(embarcacaoId).assentos.map((a) => [a.id, a.comodoId ? (cm.get(a.comodoId) ?? 0) : 0]));
}

/** Cômodo de cada poltrona, para a legenda/faixa do mapa */
export function mapaComodos(embarcacaoId: string): Record<string, { nome: string; cor: string }> {
  const cm = new Map(comodosDaEmbarcacao(embarcacaoId).map((c) => [c.id, c]));
  return Object.fromEntries(
    embarcacao(embarcacaoId)
      .assentos.filter((a) => a.comodoId && cm.has(a.comodoId))
      .map((a) => [a.id, { nome: `${cm.get(a.comodoId!)!.nome}${cm.get(a.comodoId!)!.acrescimo ? ` (+R$ ${cm.get(a.comodoId!)!.acrescimo})` : ""}`, cor: cm.get(a.comodoId!)!.cor }]),
  );
}

// ─── Festivais ─────────────────────────────────────────────────

export const festivalDaViagem = (viagemId: string) => db().festivais.find((f) => f.viagemIds.includes(viagemId));

/** Tarifa do trecho nesta viagem: preço da linha, com o reajuste do festival quando a viagem é de festival */
export function tarifaViagem(v: Viagem, origem: number, destino: number) {
  const base = linha(v.linhaId).tarifas[origem]?.[destino] ?? 0;
  const f = festivalDaViagem(v.id);
  return f?.acrescimoPercentual ? round2(base * (1 + f.acrescimoPercentual / 100)) : base;
}

/** Festivais publicados que ainda não terminaram, do mais próximo ao mais distante */
export function festivaisNoSite(agora = new Date()) {
  const hoje = localDayKey(agora);
  return db().festivais.filter((f) => f.publicado && f.fim >= hoje).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export type OpcaoFestival = { viagem: Viagem; origem: number; destino: number; saida: Date; chegada: Date; valor: number; taxa: number; livres: number; de: string; para: string };

/** Trechos à venda para um festival: chegando à cidade do evento (ida) e saindo dela (volta) */
export function opcoesFestival(f: Festival, agora = new Date()) {
  const ida: OpcaoFestival[] = [];
  const volta: OpcaoFestival[] = [];
  for (const id of f.viagemIds) {
    const v = viagem(id);
    if (!v || v.status === "CANCELADA" || !v.vendasAbertas) continue;
    const l = linha(v.linhaId);
    const c = l.paradas.findIndex((p) => porto(p.portoId).cidadeId === f.cidadeId);
    if (c < 0) continue;
    const opcao = (o: number, d: number): OpcaoFestival => ({
      viagem: v,
      origem: o,
      destino: d,
      saida: horarioParada(v, o),
      chegada: horarioParada(v, d),
      valor: tarifaViagem(v, o, d),
      taxa: porto(l.paradas[o].portoId).taxaEmbarque,
      livres: lugaresLivres(v, o, d),
      de: paradaInfo(l.id, o).cidade.nome,
      para: paradaInfo(l.id, d).cidade.nome,
    });
    for (let o = 0; o < c; o++) if (horarioParada(v, o) > agora && tarifaViagem(v, o, c) > 0) ida.push(opcao(o, c));
    for (let d = c + 1; d < l.paradas.length; d++) if (horarioParada(v, c) > agora && tarifaViagem(v, c, d) > 0) volta.push(opcao(c, d));
  }
  const ord = (a: OpcaoFestival, b: OpcaoFestival) => a.saida.getTime() - b.saida.getTime() || a.de.localeCompare(b.de);
  return { ida: ida.sort(ord), volta: volta.sort(ord) };
}

export function salvarFestival(d: Omit<Festival, "id" | "viagemIds"> & { id?: string }): Resultado<{ id: string }> {
  if (d.nome.trim().length < 3) return falha("Informe o nome do festival.");
  if (!db().cidades.some((c) => c.id === d.cidadeId)) return falha("Escolha a cidade do evento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(d.fim) || d.fim < d.inicio) return falha("Datas inválidas: o fim precisa ser igual ou depois do início.");
  if (!(d.acrescimoPercentual >= 0 && d.acrescimoPercentual <= 200)) return falha("Reajuste entre 0% e 200%.");
  const s = slug(d.slug || d.nome);
  if (!s) return falha("Endereço (slug) inválido.");
  if (db().festivais.some((f) => f.slug === s && f.id !== d.id)) return falha("Já existe festival com este endereço.");
  const campos = { ...d, slug: s, nome: d.nome.trim(), chamada: d.chamada.trim(), descricao: d.descricao.trim() };
  delete (campos as { id?: string }).id;
  if (d.id) {
    const f = db().festivais.find((x) => x.id === d.id);
    if (!f) return falha("Festival não encontrado.");
    Object.assign(f, campos);
    return { ok: true, id: f.id };
  }
  const id = idUnico(`fest-${s}`.slice(0, 40), (x) => db().festivais.some((f) => f.id === x));
  db().festivais.push({ id, ...campos, viagemIds: [] });
  return { ok: true, id };
}

export function vincularViagemFestival(festivalId: string, viagemId: string, vincular: boolean): Resultado {
  const f = db().festivais.find((x) => x.id === festivalId);
  const v = viagem(viagemId);
  if (!f || !v) return falha("Festival ou viagem não encontrado.");
  if (vincular) {
    if (!linha(v.linhaId).paradas.some((p) => porto(p.portoId).cidadeId === f.cidadeId)) return falha(`Esta viagem não passa por ${cidade(f.cidadeId).nome}.`);
    const outro = festivalDaViagem(v.id);
    if (outro && outro.id !== f.id) return falha(`Esta viagem já está no festival ${outro.nome}.`);
    // Mudar o preço de viagem com passagens já vendidas geraria bilhetes com valores diferentes na mesma saída
    if (f.acrescimoPercentual && passagensDaViagem(v.id).length) return falha("A viagem já tem passagens vendidas pelo preço normal; crie uma viagem extra para o festival.");
    if (!f.viagemIds.includes(v.id)) f.viagemIds.push(v.id);
  } else {
    if (f.acrescimoPercentual && passagensDaViagem(v.id).length) return falha("Há passagens vendidas com o preço do festival nesta viagem; não dá para desvincular.");
    f.viagemIds = f.viagemIds.filter((x) => x !== v.id);
  }
  return { ok: true };
}

/** Tarifa do trecho + cômodo, com o maior desconto entre o tipo de passageiro e o convênio */
export function precoPassagem(tarifa: number, acrescimo: number, tipo: TipoPassageiro, convenioId?: string) {
  const desc = Math.max(config().valores.descontos[tipo] ?? 0, (convenio(convenioId)?.descontoPercentual ?? 0) / 100);
  return round2((tarifa + acrescimo) * (1 - Math.min(1, desc)));
}

// ─── Busca do e-commerce ───────────────────────────────────────

export type ResultadoBusca = {
  viagem: Viagem;
  linhaNome: string;
  origemOrdem: number;
  destinoOrdem: number;
  saida: Date;
  chegada: Date;
  duracaoMin: number;
  valor: number;
  taxa: number;
  livres: number;
  portoEmbarque: string;
  origemCidade: string;
  destinoCidade: string;
  embarcacao: string;
};

export function buscarViagens(origemCidadeId: string, destinoCidadeId: string, dia?: string): ResultadoBusca[] {
  const agora = new Date();
  const out: ResultadoBusca[] = [];
  for (const l of db().linhas.filter((x) => x.ativa)) {
    const cid = l.paradas.map((p) => porto(p.portoId).cidadeId);
    const o = cid.indexOf(origemCidadeId);
    const d = cid.indexOf(destinoCidadeId);
    if (o < 0 || d < 0 || o >= d) continue;
    for (const v of db().viagens.filter((x) => x.linhaId === l.id && x.vendasAbertas && x.status !== "CANCELADA")) {
      const saida = horarioParada(v, o);
      if (saida <= agora) continue;
      if (dia && localDayKey(saida) !== dia) continue;
      const chegada = horarioParada(v, d);
      out.push({
        viagem: v,
        linhaNome: l.nome,
        origemOrdem: o,
        destinoOrdem: d,
        saida,
        chegada,
        duracaoMin: (chegada.getTime() - saida.getTime()) / 60_000,
        valor: tarifaViagem(v, o, d),
        taxa: porto(l.paradas[o].portoId).taxaEmbarque,
        livres: lugaresLivres(v, o, d),
        portoEmbarque: porto(l.paradas[o].portoId).nome,
        origemCidade: cidade(origemCidadeId).nome,
        destinoCidade: cidade(destinoCidadeId).nome,
        embarcacao: embarcacao(v.embarcacaoId).nome,
      });
    }
  }
  return out.sort((a, b) => a.saida.getTime() - b.saida.getTime());
}

export function proximasSaidas(limit = 6) {
  const agora = new Date();
  return db()
    .viagens.filter((v) => new Date(v.partida) > agora && v.status !== "CANCELADA")
    .slice(0, limit);
}

/** Lista de viagens do admin: próximas (até 30 dias) ou anteriores */
export function viagensAdmin({ aba, linhaId, agora = new Date() }: { aba: "proximas" | "anteriores"; linhaId?: string; agora?: Date }) {
  const lista = db()
    .viagens.filter((v) => !linhaId || v.linhaId === linhaId)
    .filter((v) => (aba === "proximas" ? v.status !== "CONCLUIDA" : v.status === "CONCLUIDA"))
    .filter((v) => aba === "anteriores" || new Date(v.partida).getTime() - agora.getTime() < 30 * 86_400_000);
  return aba === "anteriores" ? lista.reverse() : lista;
}

// ─── Escolha automática de poltronas ───────────────────────────

const PREFERENCIAL: TipoPassageiro[] = ["IDOSO", "PCD"];

/**
 * Escolhe poltronas livres no trecho para quem compra sem marcar assento.
 * Critérios: sem acréscimo de cômodo primeiro; idoso/PCD na fileira preferencial; demais fora dela
 * enquanto houver lugar; o grupo junto na mesma fileira quando possível; da proa para a popa (fileira 1 em diante).
 */
export function alocarAssentos(viagemId: string, origem: number, destino: number, tipos: TipoPassageiro[], reservados: string[] = []): string[] | null {
  const v = viagem(viagemId);
  if (!v) return null;
  const e = embarcacao(v.embarcacaoId);
  const acr = acrescimosEmbarcacao(e.id);
  const bloqueados = new Set([...assentosOcupados(viagemId, origem, destino), ...reservados]);
  const livres = e.assentos.filter((a) => !bloqueados.has(a.id));
  if (livres.length < tipos.length) return null;
  const ordem = (a: Assento, pref: boolean) => [acr[a.id] ?? 0, pref === (a.tipo === "ESPECIAL") ? 0 : 1, a.fileira, a.coluna];
  const cmp = (pref: boolean) => (a: Assento, b: Assento) => {
    const x = ordem(a, pref);
    const y = ordem(b, pref);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  const usados = new Set<string>();
  const resultado: string[] = new Array(tipos.length);
  // 1) Preferenciais primeiro, cada um no melhor lugar para eles
  tipos.forEach((t, i) => {
    if (!PREFERENCIAL.includes(t)) return;
    const a = livres.filter((x) => !usados.has(x.id)).sort(cmp(true))[0];
    usados.add(a.id);
    resultado[i] = a.id;
  });
  // 2) Demais: tenta uma fileira inteira com lugares para o grupo, no menor acréscimo possível
  const resto = tipos.map((t, i) => i).filter((i) => !resultado[i]);
  if (resto.length) {
    const disponiveis = livres.filter((x) => !usados.has(x.id)).sort(cmp(false));
    const melhorAcr = acr[disponiveis[0].id] ?? 0;
    const porFileira = new Map<number, Assento[]>();
    for (const a of disponiveis.filter((x) => (acr[x.id] ?? 0) === melhorAcr && x.tipo !== "ESPECIAL")) {
      porFileira.set(a.fileira, [...(porFileira.get(a.fileira) ?? []), a]);
    }
    // Preferência: poltronas lado a lado (colunas vizinhas, sem o corredor no meio); depois, qualquer fileira com lugar para todos
    const ladoALado = (f: Assento[]) => {
      const cols = [...f].sort((x, y) => x.coluna - y.coluna);
      for (let i = 0; i + resto.length <= cols.length; i++) {
        const janela = cols.slice(i, i + resto.length);
        if (janela.every((x, j) => j === 0 || x.coluna === janela[j - 1].coluna + 1)) return janela;
      }
      return null;
    };
    const fileiras = [...porFileira.values()];
    const escolhidos =
      fileiras.map(ladoALado).find((x) => x) ??
      fileiras.find((f) => f.length >= resto.length)?.slice(0, resto.length) ??
      disponiveis.slice(0, resto.length);
    resto.forEach((i, k) => (resultado[i] = escolhidos[k].id));
  }
  return resultado;
}

/** Quantas poltronas livres no trecho não têm acréscimo (o preço mostrado na compra automática vale para elas) */
export function livresSemAcrescimo(viagemId: string, origem: number, destino: number) {
  const v = viagem(viagemId)!;
  if (embarcacao(v.embarcacaoId).assentoLivre) return lugaresLivres(v, origem, destino);
  const acr = acrescimosEmbarcacao(v.embarcacaoId);
  const ocup = assentosOcupados(viagemId, origem, destino);
  return embarcacao(v.embarcacaoId).assentos.filter((a) => !ocup.has(a.id) && !(acr[a.id] > 0)).length;
}

// ─── Criação de pedido ─────────────────────────────────────────

export type NovoPedidoInput = {
  viagemId: string;
  origemOrdem: number;
  destinoOrdem: number;
  canal: CanalVenda;
  comprador: { nome: string; email?: string; telefone: string };
  // assentoId vazio = o sistema escolhe a poltrona (compra sem marcar assento)
  passageiros: { assentoId?: string; nome: string; documento: string; tipo: TipoPassageiro }[];
  metodo: MetodoPagamento;
  vendedorId?: string;
  convenioId?: string; // só balcão/agência
  pagoNoAto?: boolean; // balcão: dinheiro/cartão recebidos na hora
};

export function criarPedido(input: NovoPedidoInput): { ok: true; pedido: Pedido } | { ok: false; erro: string } {
  const v = viagem(input.viagemId);
  if (!v || !v.vendasAbertas || v.status === "CANCELADA" || v.status === "CONCLUIDA") return falha("Viagem indisponível para venda.");
  const l = linha(v.linhaId);
  const { origemOrdem: o, destinoOrdem: d } = input;
  if (!(o >= 0 && d < l.paradas.length && o < d)) return falha("Trecho inválido.");
  if (!input.passageiros.length) return falha("Selecione ao menos um assento.");
  if (input.passageiros.some((p) => p.nome.trim().length < 3 || p.documento.replace(/\D/g, "").length < 5))
    return falha("Preencha nome e documento de todos os passageiros.");

  const vendedor = usuario(input.vendedorId);
  const interno = input.canal !== "SITE";
  if (interno && !vendedor) return falha("Operador não identificado.");
  if (vendedor?.linhasPermitidas.length && !vendedor.linhasPermitidas.includes(l.id))
    return falha("Seu usuário não tem permissão para vender nesta linha.");
  const canal: CanalVenda = interno && vendedor?.agenciaId ? "AGENCIA" : input.canal;
  const agencia = canal === "AGENCIA" ? db().agencias.find((a) => a.id === vendedor?.agenciaId) : undefined;

  const conv = interno ? convenio(input.convenioId) : undefined;
  if (input.convenioId && (!conv || !conv.ativo)) return falha("Convênio inválido ou inativo.");
  const metodo: MetodoPagamento = conv?.faturado ? "FATURADO" : input.metodo;
  if (metodo === "FATURADO" && !conv) return falha("Pagamento faturado só é possível com convênio.");

  const barco = embarcacao(v.embarcacaoId);
  if (barco.assentoLivre) {
    // Assento livre: sem poltrona; basta caber na lotação do trecho
    const livres = lugaresLivres(v, o, d);
    if (livres < input.passageiros.length) return falha(livres ? `Restam só ${livres} lugares neste trecho.` : "Viagem lotada neste trecho.");
    input = { ...input, passageiros: input.passageiros.map((p) => ({ ...p, assentoId: undefined })) };
  }
  const assentosValidos = new Set(barco.assentos.map((a) => a.id));
  const ocupados = assentosOcupados(v.id, o, d);
  const escolhidos = input.passageiros.map((p) => p.assentoId).filter((a): a is string => !!a);
  if (new Set(escolhidos).size !== escolhidos.length || escolhidos.some((a) => !assentosValidos.has(a)))
    return falha("Seleção de assentos inválida.");
  if (escolhidos.some((a) => ocupados.has(a))) return falha("Um dos assentos acabou de ser vendido. Escolha outro.");
  // Quem veio sem poltrona recebe uma agora, na mesma operação que confere a ocupação
  const semAssento = input.passageiros.filter((p) => !p.assentoId);
  if (semAssento.length && !barco.assentoLivre) {
    const alocados = alocarAssentos(v.id, o, d, semAssento.map((p) => p.tipo), escolhidos);
    if (!alocados) return falha(`Não há poltronas livres suficientes neste trecho (restam ${lugaresLivres(v, o, d) - escolhidos.length}).`);
    let k = 0;
    input = { ...input, passageiros: input.passageiros.map((p) => (p.assentoId ? p : { ...p, assentoId: alocados[k++] })) };
  }

  const pago = metodo === "FATURADO" || (interno && !!input.pagoNoAto);
  let caixa: CaixaSessao | undefined;
  if (interno && pago && metodo !== "FATURADO") {
    caixa = caixaAberto(vendedor!.id);
    if (!caixa && metodo === "DINHEIRO") return falha("Abra o caixa antes de vender em dinheiro (menu Comercial → Caixa).");
  }

  const agora = new Date();
  const taxa = porto(l.paradas[o].portoId).taxaEmbarque;
  const acr = acrescimosEmbarcacao(v.embarcacaoId);
  const pedidoId = uid("ped");
  const ano = agora.getFullYear();
  const seq = db().pedidos.filter((x) => x.numero.split("-")[1] === String(ano)).length + 1;
  let subtotal = 0;
  for (const p of input.passageiros) {
    const assentoId = p.assentoId;
    const acrescimo = assentoId ? (acr[assentoId] ?? 0) : 0;
    const valor = precoPassagem(tarifaViagem(v, o, d), acrescimo, p.tipo, conv?.id);
    subtotal += valor;
    db().passagens.push({
      id: uid("pas"),
      pedidoId,
      viagemId: v.id,
      assentoId,
      origemOrdem: o,
      destinoOrdem: d,
      nome: p.nome.trim(),
      documento: p.documento.trim(),
      tipo: p.tipo,
      valor,
      taxaEmbarque: taxa,
      status: pago ? "EMITIDA" : "RESERVADA",
      qrToken: code("QR", 12),
      convenioId: conv?.id,
      acrescimo,
      impressoes: 0,
    });
  }
  subtotal = round2(subtotal);
  const taxas = round2(taxa * input.passageiros.length);
  const total = round2(subtotal + taxas);
  const pedido: Pedido = {
    id: pedidoId,
    codigo: code("ST"),
    numero: `${cidade(porto(l.paradas[o].portoId).cidadeId).sigla}-${ano}-${String(seq).padStart(4, "0")}`,
    canal,
    status: pago ? "PAGO" : "AGUARDANDO_PAGAMENTO",
    compradorNome: input.comprador.nome.trim(),
    compradorEmail: input.comprador.email?.trim() || undefined,
    compradorTelefone: input.comprador.telefone.trim(),
    vendedorId: vendedor?.id,
    agenciaId: agencia?.id,
    subtotal,
    taxas,
    desconto: 0,
    total,
    comissaoAgencia: agencia ? round2((subtotal * agencia.comissaoPercentual) / 100) : 0,
    expiraEm: pago ? undefined : addMinutes(agora, config().empresa.minutosReservaSite).toISOString(),
    createdAt: agora.toISOString(),
    pagamentos: [
      {
        id: uid("pg"),
        metodo,
        status: pago && metodo !== "FATURADO" ? "APROVADO" : "PENDENTE",
        valor: total,
        pagoEm: pago && metodo !== "FATURADO" ? agora.toISOString() : undefined,
        caixaId: caixa?.id,
        // Placeholder: o gateway real devolve o "copia e cola" do PIX
        pixCopiaCola:
          metodo === "PIX" && !pago
            ? `00020126580014BR.GOV.BCB.PIX0136navstar-demo-${pedidoId}5204000053039865406${total.toFixed(2)}5802BR`
            : undefined,
      },
    ],
  };
  db().pedidos.push(pedido);
  return { ok: true, pedido };
}

/** Simula a confirmação do gateway (webhook) */
export function confirmarPagamento(codigo: string) {
  const p = pedidoPorCodigo(codigo);
  if (!p || p.status !== "AGUARDANDO_PAGAMENTO") return false;
  if (p.expiraEm && new Date(p.expiraEm) < new Date()) {
    p.status = "EXPIRADO";
    return false;
  }
  p.status = "PAGO";
  p.expiraEm = undefined;
  for (const pg of p.pagamentos) {
    pg.status = "APROVADO";
    pg.pagoEm = new Date().toISOString();
  }
  for (const pas of passagensDoPedido(p.id)) pas.status = "EMITIDA";
  return true;
}

/** Marca como expirados os pedidos do site não pagos no prazo (em produção: job agendado) */
export function expirarPedidos(agora = new Date()) {
  for (const p of db().pedidos) {
    if (p.status === "AGUARDANDO_PAGAMENTO" && p.expiraEm && new Date(p.expiraEm) <= agora) {
      p.status = "EXPIRADO";
      for (const pas of passagensDoPedido(p.id)) pas.status = "CANCELADA";
    }
  }
}

/** Conta uma impressão do bilhete; a partir da segunda, o bilhete sai marcado como "2ª VIA" */
export function registrarImpressao(codigo: string, passagemId?: string) {
  const p = pedidoPorCodigo(codigo);
  if (!p || p.status !== "PAGO") return false;
  for (const x of passagensDoPedido(p.id)) {
    if ((x.status === "EMITIDA" || x.status === "EMBARCADA") && (!passagemId || x.id === passagemId)) x.impressoes++;
  }
  return true;
}

// ─── Cancelamento ──────────────────────────────────────────────

export function calcularCancelamento(pedido: Pedido, passagemIds: string[], agora = new Date()) {
  const pas = passagensDoPedido(pedido.id).filter((x) => passagemIds.includes(x.id));
  const v = viagem(pas[0]?.viagemId ?? "");
  const saida = v && pas[0] ? horarioParada(v, pas[0].origemOrdem) : agora;
  const horasAntes = (saida.getTime() - agora.getTime()) / 3600_000;
  const faturado = pedido.pagamentos[0]?.metodo === "FATURADO";
  const valorPago = pedido.status === "PAGO" && !faturado ? round2(pas.reduce((s, x) => s + x.valor + x.taxaEmbarque, 0)) : 0;
  const { multaCancelamentoPct, horasCancelamentoSemMulta } = config().valores;
  const multa = horasAntes >= horasCancelamentoSemMulta ? 0 : round2((valorPago * multaCancelamentoPct) / 100);
  return { passagens: pas, horasAntes, valorPago, multa, reembolso: round2(valorPago - multa) };
}

/** Cancela passagens de um pedido (todas, se `passagemIds` vier vazio) */
export function cancelarPassagens(codigo: string, passagemIds: string[], motivo: string, usuarioId?: string): Resultado<{ reembolso: number; multa: number }> {
  const p = pedidoPorCodigo(codigo);
  if (!p) return falha("Pedido não encontrado.");
  if (p.status !== "PAGO" && p.status !== "AGUARDANDO_PAGAMENTO") return falha(`Pedido ${p.status === "EXPIRADO" ? "expirado" : "já cancelado"}.`);
  if (motivo.trim().length < 3) return falha("Informe o motivo do cancelamento.");
  const todas = passagensDoPedido(p.id).filter((x) => x.status !== "CANCELADA");
  const ids = passagemIds.length ? passagemIds : todas.map((x) => x.id);
  const alvo = todas.filter((x) => ids.includes(x.id));
  if (!alvo.length) return falha("Nenhuma passagem válida selecionada.");
  if (alvo.some((x) => x.status === "EMBARCADA" || x.status === "NAO_COMPARECEU")) return falha("Passageiro já embarcou ou a viagem já aconteceu.");
  const v = viagem(alvo[0].viagemId)!;
  if (horarioParada(v, alvo[0].origemOrdem) <= new Date()) return falha("A embarcação já saiu; não é possível cancelar.");

  const calc = calcularCancelamento(p, alvo.map((x) => x.id));
  for (const x of alvo) x.status = "CANCELADA";
  const restantes = todas.length - alvo.length;
  if (restantes === 0) {
    p.status = p.status === "PAGO" ? "REEMBOLSADO" : "CANCELADO";
    p.expiraEm = undefined;
    for (const pg of p.pagamentos) pg.status = pg.status === "APROVADO" ? "ESTORNADO" : "RECUSADO";
  } else {
    // Parcial: o pedido segue pago com as passagens restantes; a multa fica retida no total
    const valor = alvo.reduce((s, x) => s + x.valor, 0);
    const taxa = alvo.reduce((s, x) => s + x.taxaEmbarque, 0);
    const ag = db().agencias.find((a) => a.id === p.agenciaId);
    p.subtotal = round2(p.subtotal - valor);
    p.taxas = round2(p.taxas - taxa);
    p.total = round2(p.total - (p.status === "PAGO" ? calc.reembolso : valor + taxa));
    p.comissaoAgencia = ag ? round2((p.subtotal * ag.comissaoPercentual) / 100) : 0;
  }
  // Reembolso em dinheiro sai do caixa aberto de quem cancelou
  if (calc.reembolso > 0 && p.pagamentos[0].metodo === "DINHEIRO" && usuarioId) {
    caixaAberto(usuarioId)?.movimentos.push({ tipo: "SANGRIA", valor: calc.reembolso, observacao: `Reembolso do pedido ${p.codigo}`, createdAt: new Date().toISOString() });
  }
  db().cancelamentos.push({
    id: uid("can"),
    pedidoId: p.id,
    passagemIds: alvo.map((x) => x.id),
    motivo: motivo.trim(),
    valorPago: calc.valorPago,
    multa: calc.multa,
    reembolso: calc.reembolso,
    usuarioId,
    createdAt: new Date().toISOString(),
  });
  return { ok: true, reembolso: calc.reembolso, multa: calc.multa };
}

// ─── Caixa do balcão ───────────────────────────────────────────

export const caixaAberto = (usuarioId: string) => db().caixas.find((c) => c.usuarioId === usuarioId && !c.fechadoEm);

export function resumoCaixa(c: CaixaSessao) {
  const pagamentos = db().pedidos.flatMap((p) => p.pagamentos.filter((pg) => pg.caixaId === c.id).map((pg) => ({ pedido: p, pg })));
  const porMetodo = new Map<MetodoPagamento, { qtd: number; valor: number }>();
  for (const { pg } of pagamentos) {
    const m = porMetodo.get(pg.metodo) ?? { qtd: 0, valor: 0 };
    porMetodo.set(pg.metodo, { qtd: m.qtd + 1, valor: round2(m.valor + pg.valor) });
  }
  const dinheiro = porMetodo.get("DINHEIRO")?.valor ?? 0;
  const suprimentos = c.movimentos.filter((m) => m.tipo === "SUPRIMENTO").reduce((s, m) => s + m.valor, 0);
  const sangrias = c.movimentos.filter((m) => m.tipo === "SANGRIA").reduce((s, m) => s + m.valor, 0);
  const esperado = round2(c.valorAbertura + dinheiro + suprimentos - sangrias);
  const vendido = round2(pagamentos.reduce((s, x) => s + x.pg.valor, 0));
  return {
    pagamentos,
    porMetodo: [...porMetodo.entries()].map(([metodo, v]) => ({ metodo, ...v })),
    dinheiro,
    suprimentos,
    sangrias,
    esperado,
    vendido,
    diferenca: c.valorContado === undefined ? undefined : round2(c.valorContado - esperado),
  };
}

export function abrirCaixa(usuarioId: string, valorAbertura: number): Resultado<{ caixa: CaixaSessao }> {
  if (!usuario(usuarioId)) return falha("Operador não identificado.");
  if (caixaAberto(usuarioId)) return falha("Você já tem um caixa aberto.");
  if (!(valorAbertura >= 0)) return falha("Valor de abertura inválido.");
  const caixa: CaixaSessao = { id: uid("cx"), usuarioId, abertoEm: new Date().toISOString(), valorAbertura: round2(valorAbertura), movimentos: [] };
  db().caixas.push(caixa);
  return { ok: true, caixa };
}

export function movimentarCaixa(usuarioId: string, tipo: "SANGRIA" | "SUPRIMENTO", valor: number, observacao: string): Resultado {
  const c = caixaAberto(usuarioId);
  if (!c) return falha("Nenhum caixa aberto.");
  if (!(valor > 0)) return falha("Informe um valor maior que zero.");
  if (tipo === "SANGRIA" && valor > resumoCaixa(c).esperado) return falha("A sangria é maior que o dinheiro em caixa.");
  c.movimentos.push({ tipo, valor: round2(valor), observacao: observacao.trim() || (tipo === "SANGRIA" ? "Sangria" : "Suprimento"), createdAt: new Date().toISOString() });
  return { ok: true };
}

export function fecharCaixa(usuarioId: string, valorContado: number, observacao: string): Resultado<{ caixa: CaixaSessao }> {
  const c = caixaAberto(usuarioId);
  if (!c) return falha("Nenhum caixa aberto.");
  if (!(valorContado >= 0)) return falha("Informe o dinheiro contado na gaveta.");
  c.valorContado = round2(valorContado);
  c.fechadoEm = new Date().toISOString();
  c.observacao = observacao.trim() || undefined;
  return { ok: true, caixa: c };
}

// ─── Embarque ──────────────────────────────────────────────────

export function validarEmbarque(token: string, usuarioId?: string) {
  const t = token.trim().toUpperCase();
  const p = db().passagens.find((x) => x.qrToken === t);
  if (!p) return { ok: false as const, erro: "Bilhete não encontrado." };
  const v = viagem(p.viagemId)!;
  if (p.status === "EMBARCADA") return { ok: false as const, erro: "Este bilhete já foi utilizado.", passagem: p, viagem: v };
  if (p.status !== "EMITIDA") return { ok: false as const, erro: "Bilhete sem pagamento confirmado ou cancelado.", passagem: p, viagem: v };
  if (v.status === "CANCELADA" || v.status === "CONCLUIDA") return { ok: false as const, erro: `Viagem ${v.status === "CANCELADA" ? "cancelada" : "já concluída"}.`, passagem: p, viagem: v };
  p.status = "EMBARCADA";
  p.embarcadoEm = new Date().toISOString();
  p.validadoPorId = usuarioId;
  return { ok: true as const, passagem: p, viagem: v };
}

// ─── Controle da viagem ────────────────────────────────────────

const TRANSICOES: Record<StatusViagem, StatusViagem[]> = {
  PROGRAMADA: ["EMBARQUE", "CANCELADA"],
  EMBARQUE: ["EM_CURSO", "PROGRAMADA", "CANCELADA"],
  EM_CURSO: ["CONCLUIDA"],
  CONCLUIDA: [],
  CANCELADA: [],
};
export const proximosStatus = (s: StatusViagem) => TRANSICOES[s];

export function alterarStatusViagem(id: string, novo: StatusViagem, motivo?: string): Resultado {
  const v = viagem(id);
  if (!v) return falha("Viagem não encontrada.");
  if (!TRANSICOES[v.status].includes(novo)) return falha("Mudança de status não permitida.");
  if (novo === "CANCELADA" && (motivo?.trim().length ?? 0) < 3) return falha("Informe o motivo do cancelamento da viagem.");
  v.status = novo;
  const agora = new Date().toISOString();
  const encs = db().encomendas.filter((e) => e.viagemId === id);
  const evento = (e: Encomenda, s: StatusEncomenda, d: string) => {
    e.status = s;
    e.eventos.push({ status: s, descricao: d, createdAt: agora });
  };
  if (novo === "EM_CURSO") {
    for (const e of encs.filter((e) => e.status === "EMBARCADA")) evento(e, "EM_TRANSITO", "Em viagem");
  }
  if (novo === "CONCLUIDA") {
    for (const p of passagensDaViagem(id).filter((p) => p.status === "EMITIDA")) p.status = "NAO_COMPARECEU";
    for (const e of encs.filter((e) => e.status === "EMBARCADA" || e.status === "EM_TRANSITO"))
      evento(e, "DISPONIVEL_RETIRADA", `Disponível para retirada em ${cidade(e.destinoCidadeId).nome}`);
    v.vendasAbertas = false;
  }
  if (novo === "CANCELADA") {
    v.motivoCancelamento = motivo!.trim();
    v.vendasAbertas = false;
    for (const e of encs.filter((e) => e.status === "EMBARCADA")) {
      e.viagemId = undefined;
      evento(e, "RECEBIDA", "Viagem cancelada: aguardando nova viagem no porto de origem");
    }
  }
  return { ok: true };
}

export function alternarVendas(id: string): Resultado {
  const v = viagem(id);
  if (!v) return falha("Viagem não encontrada.");
  if (v.status === "CANCELADA" || v.status === "CONCLUIDA") return falha("Viagem encerrada.");
  v.vendasAbertas = !v.vendasAbertas;
  return { ok: true };
}

export function definirTripulacao(id: string, ids: string[], observacao?: string): Resultado {
  const v = viagem(id);
  if (!v) return falha("Viagem não encontrada.");
  const membros = ids.map(tripulante).filter((t) => t?.ativo);
  const cmte = membros.find((t) => t!.funcao === "COMANDANTE");
  if (!cmte) return falha("A tripulação precisa de um comandante.");
  v.tripulacao = membros.map((t) => t!.id);
  v.comandante = `Cmte. ${cmte.nome}`;
  v.observacao = observacao?.trim() || undefined;
  return { ok: true };
}

/** Troca a embarcação mantendo cada passageiro na poltrona de mesmo código */
export function trocarEmbarcacao(id: string, embarcacaoId: string): Resultado<{ conflitos: string[] }> {
  const v = viagem(id);
  const nova = db().embarcacoes.find((e) => e.id === embarcacaoId);
  if (!v || !nova) return falha("Viagem ou embarcação não encontrada.");
  if (nova.status !== "ATIVA") return falha("A embarcação escolhida não está ativa.");
  if (v.status !== "PROGRAMADA" && v.status !== "EMBARQUE") return falha("Só é possível trocar antes da saída.");
  const antiga = embarcacao(v.embarcacaoId);
  const ativos = db().passagens.filter((p) => p.viagemId === id && passagemAtiva(p));
  if (nova.assentoLivre) {
    const pico = Math.max(0, ...passageirosPorSegmento(v));
    if (pico > nova.capacidadePassageiros) return falha(`A ${nova.nome} leva ${nova.capacidadePassageiros} passageiros; esta viagem tem ${pico} no trecho mais cheio.`);
    for (const p of ativos) p.assentoId = undefined;
    v.embarcacaoId = nova.id;
    return { ok: true, conflitos: [] };
  }
  if (antiga.assentoLivre) {
    // De assento livre para numerado: cada passageiro recebe uma poltrona livre no seu trecho
    const uso = new Map<string, boolean[]>();
    const nSeg = linha(v.linhaId).paradas.length - 1;
    const plano: [Passagem, string][] = [];
    for (const p of [...ativos].sort((a, b) => a.origemOrdem - b.origemOrdem)) {
      const a = nova.assentos.find((x) => !(uso.get(x.id) ?? []).slice(p.origemOrdem, p.destinoOrdem).some(Boolean));
      if (!a) return falha(`A ${nova.nome} não tem poltronas suficientes para todos os passageiros.`);
      const occ = uso.get(a.id) ?? new Array(nSeg).fill(false);
      for (let s = p.origemOrdem; s < p.destinoOrdem; s++) occ[s] = true;
      uso.set(a.id, occ);
      plano.push([p, a.id]);
    }
    for (const [p, a] of plano) p.assentoId = a;
    v.embarcacaoId = nova.id;
    return { ok: true, conflitos: [] };
  }
  const porCodigo = new Map(nova.assentos.map((a) => [a.codigo, a.id]));
  const conflitos = ativos
    .map((p) => antiga.assentos.find((a) => a.id === p.assentoId)?.codigo ?? "?")
    .filter((c) => !porCodigo.has(c));
  if (conflitos.length) return falha(`Poltronas vendidas que não existem na ${nova.nome}: ${[...new Set(conflitos)].join(", ")}`);
  for (const p of ativos) if (p.assentoId) p.assentoId = porCodigo.get(antiga.assentos.find((a) => a.id === p.assentoId)!.codigo)!;
  v.embarcacaoId = nova.id;
  return { ok: true, conflitos: [] };
}

function novaViagem(l: Linha, embarcacaoId: string, partida: Date, avulsa: boolean): Viagem {
  const cmte = db().tripulantes.find((t) => t.ativo && t.funcao === "COMANDANTE" && t.embarcacaoId === embarcacaoId)
    ?? db().tripulantes.find((t) => t.ativo && t.funcao === "COMANDANTE");
  const k = localDayKey(partida).replaceAll("-", "");
  return {
    id: `${l.id.split("-").map((x) => x[0].toUpperCase()).join("")}-${k}${avulsa ? "-" + randomBytes(2).toString("hex").toUpperCase() : ""}`,
    linhaId: l.id,
    embarcacaoId,
    partida: partida.toISOString(),
    status: "PROGRAMADA",
    comandante: cmte ? `Cmte. ${cmte.nome}` : "A definir",
    vendasAbertas: true,
    tripulacao: db().tripulantes.filter((t) => t.ativo && t.embarcacaoId === embarcacaoId).map((t) => t.id),
    avulsa,
  };
}

export function criarViagemAvulsa(linhaId: string, embarcacaoId: string, dia: string, hora: string): Resultado<{ viagem: Viagem }> {
  const l = db().linhas.find((x) => x.id === linhaId);
  const e = db().embarcacoes.find((x) => x.id === embarcacaoId);
  if (!l || !e) return falha("Escolha linha e embarcação.");
  if (e.status !== "ATIVA") return falha("A embarcação não está ativa.");
  const [y, m, d] = dia.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return falha("Data ou hora inválida.");
  const partida = manausDate(y, m - 1, d, hh, mm);
  if (partida <= new Date()) return falha("A partida precisa ser no futuro.");
  if (db().viagens.some((v) => v.linhaId === l.id && v.partida === partida.toISOString())) return falha("Já existe viagem desta linha nesse horário.");
  const v = novaViagem(l, e.id, partida, true);
  db().viagens.push(v);
  db().viagens.sort((a, b) => a.partida.localeCompare(b.partida));
  return { ok: true, viagem: v };
}

/** Cria as viagens da programação semanal para os próximos `dias` (idempotente) */
export function gerarViagens(dias = 60, agora = new Date()) {
  const [ty, tm, td] = localDayKey(agora).split("-").map(Number);
  let criadas = 0;
  for (let i = 0; i <= dias; i++) {
    const dow = new Date(Date.UTC(ty, tm - 1, td + i)).getUTCDay();
    for (const l of db().linhas.filter((x) => x.ativa)) {
      for (const h of l.horarios.filter((x) => x.diaSemana === dow)) {
        const [hh, mm] = h.horaSaida.split(":").map(Number);
        const partida = manausDate(ty, tm - 1, td + i, hh, mm);
        if (partida <= agora || db().viagens.some((v) => v.linhaId === l.id && v.partida === partida.toISOString())) continue;
        if (embarcacao(h.embarcacaoId)?.status !== "ATIVA") continue;
        db().viagens.push(novaViagem(l, h.embarcacaoId, partida, false));
        criadas++;
      }
    }
  }
  db().viagens.sort((a, b) => a.partida.localeCompare(b.partida));
  return criadas;
}

// ─── Posição da frota (mapa) ───────────────────────────────────

export type PosicaoEmbarcacao = {
  embarcacaoId: string;
  situacao: "NAVEGANDO" | "EMBARQUE" | "ATRACADA" | "MANUTENCAO" | "INATIVA";
  viagem?: Viagem;
  cidadeId?: string; // onde está atracada
  deCidadeId?: string; // navegando: entre esta…
  paraCidadeId?: string; // …e esta
  progresso?: number; // 0..1 entre as duas paradas
  proximaSaida?: Viagem;
};

/** Posição estimada pelo horário previsto de cada parada (sem GPS) */
export function posicaoFrota(agora = new Date()): PosicaoEmbarcacao[] {
  return db().embarcacoes.map((e) => {
    if (e.status !== "ATIVA") return { embarcacaoId: e.id, situacao: e.status };
    const vs = db().viagens.filter((v) => v.embarcacaoId === e.id && v.status !== "CANCELADA");
    const proximaSaida = vs.find((v) => new Date(v.partida) > agora);
    const atual = vs.find((v) => new Date(v.partida) <= agora && chegadaFinal(v) > agora);
    if (atual) {
      const l = linha(atual.linhaId);
      let i = 0;
      while (i < l.paradas.length - 1 && horarioParada(atual, i + 1) <= agora) i++;
      const a = horarioParada(atual, i).getTime();
      const b = horarioParada(atual, i + 1).getTime();
      return {
        embarcacaoId: e.id,
        situacao: "NAVEGANDO",
        viagem: atual,
        deCidadeId: paradaInfo(l.id, i).cidade.id,
        paraCidadeId: paradaInfo(l.id, i + 1).cidade.id,
        progresso: Math.min(1, Math.max(0, (agora.getTime() - a) / (b - a))),
        proximaSaida,
      };
    }
    if (proximaSaida && new Date(proximaSaida.partida).getTime() - agora.getTime() < 3 * 3600_000) {
      return { embarcacaoId: e.id, situacao: "EMBARQUE", viagem: proximaSaida, cidadeId: paradaInfo(proximaSaida.linhaId, 0).cidade.id, proximaSaida };
    }
    const ultima = [...vs].reverse().find((v) => chegadaFinal(v) <= agora);
    const l = ultima ? linha(ultima.linhaId) : undefined;
    const cidadeId = ultima && l ? paradaInfo(l.id, l.paradas.length - 1).cidade.id : proximaSaida ? paradaInfo(proximaSaida.linhaId, 0).cidade.id : undefined;
    return { embarcacaoId: e.id, situacao: "ATRACADA", cidadeId, proximaSaida };
  });
}

// ─── Encomendas ────────────────────────────────────────────────

export const FLUXO_ENCOMENDA: StatusEncomenda[] = ["RECEBIDA", "EMBARCADA", "EM_TRANSITO", "DISPONIVEL_RETIRADA", "ENTREGUE"];

export function criarEncomenda(e: Omit<Encomenda, "id" | "codigo" | "status" | "createdAt" | "eventos">) {
  const agora = new Date().toISOString();
  const enc: Encomenda = {
    ...e,
    id: uid("enc"),
    codigo: `EN-${String(50000 + db().encomendas.length * 7 + Math.floor(Math.random() * 7))}`,
    status: "RECEBIDA",
    createdAt: agora,
    eventos: [{ status: "RECEBIDA", descricao: `Recebida no porto de ${cidade(e.origemCidadeId).nome}`, createdAt: agora }],
  };
  db().encomendas.unshift(enc);
  return enc;
}

export function avancarEncomenda(codigo: string, descricao?: string) {
  const e = encomendaPorCodigo(codigo);
  if (!e) return false;
  const i = FLUXO_ENCOMENDA.indexOf(e.status);
  if (i < 0 || i === FLUXO_ENCOMENDA.length - 1) return false;
  e.status = FLUXO_ENCOMENDA[i + 1];
  if (e.status === "ENTREGUE") e.fretePago = true;
  e.eventos.push({ status: e.status, descricao: descricao || "", createdAt: new Date().toISOString() });
  return true;
}

// ─── Cadastros ─────────────────────────────────────────────────

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function idUnico(base: string, existe: (id: string) => boolean) {
  let id = base || uid("x");
  for (let n = 2; existe(id); n++) id = `${base}-${n}`;
  return id;
}

export function salvarCidade(d: { nome: string; uf: string; sigla: string }): Resultado<{ id: string }> {
  const nome = d.nome.trim();
  const uf = d.uf.trim().toUpperCase();
  const sigla = d.sigla.trim().toUpperCase();
  if (nome.length < 2 || !/^[A-Z]{2}$/.test(uf) || !/^[A-Z]{3}$/.test(sigla)) return falha("Informe nome, UF (2 letras) e sigla (3 letras).");
  if (db().cidades.some((c) => c.nome.toLowerCase() === nome.toLowerCase() && c.uf === uf)) return falha("Cidade já cadastrada.");
  if (db().cidades.some((c) => c.sigla === sigla)) return falha("Sigla já usada por outra cidade.");
  const id = idUnico(slug(nome), (x) => db().cidades.some((c) => c.id === x));
  db().cidades.push({ id, nome, uf, sigla });
  return { ok: true, id };
}

export function salvarPorto(d: { id?: string; cidadeId: string; nome: string; endereco: string; taxaEmbarque: number; ativo: boolean }): Resultado<{ id: string }> {
  if (!db().cidades.some((c) => c.id === d.cidadeId)) return falha("Escolha a cidade.");
  if (d.nome.trim().length < 2) return falha("Informe o nome do porto.");
  if (!(d.taxaEmbarque >= 0)) return falha("Taxa de embarque inválida.");
  if (d.id) {
    const p = db().portos.find((x) => x.id === d.id);
    if (!p) return falha("Porto não encontrado.");
    if (!d.ativo && db().linhas.some((l) => l.ativa && l.paradas.some((x) => x.portoId === p.id))) return falha("Porto usado por linha ativa; desative a linha antes.");
    Object.assign(p, { cidadeId: d.cidadeId, nome: d.nome.trim(), endereco: d.endereco.trim(), taxaEmbarque: round2(d.taxaEmbarque), ativo: d.ativo });
    return { ok: true, id: p.id };
  }
  const id = idUnico(`p-${slug(d.nome)}`, (x) => db().portos.some((p) => p.id === x));
  db().portos.push({ id, cidadeId: d.cidadeId, nome: d.nome.trim(), endereco: d.endereco.trim(), taxaEmbarque: round2(d.taxaEmbarque), ativo: d.ativo });
  return { ok: true, id };
}

export function salvarEmbarcacao(d: {
  id?: string;
  nome: string;
  tipo: string;
  inscricaoCapitania: string;
  capacidadeCargaKg: number;
  status: "ATIVA" | "MANUTENCAO" | "INATIVA";
  ano?: number;
  comprimentoM?: number;
  observacao?: string;
  assentoLivre?: boolean;
  capacidadePassageiros?: number;
}): Resultado<{ id: string }> {
  if (d.nome.trim().length < 3) return falha("Informe o nome da embarcação.");
  if (d.assentoLivre && !((d.capacidadePassageiros ?? 0) > 0)) return falha("No assento livre, informe a lotação (quantos passageiros a embarcação leva).");
  if (d.inscricaoCapitania.trim().length < 5) return falha("Informe a inscrição na Capitania dos Portos.");
  const campos = {
    nome: d.nome.trim(),
    tipo: d.tipo || "LANCHA",
    inscricaoCapitania: d.inscricaoCapitania.trim(),
    capacidadeCargaKg: Math.max(0, Math.round(d.capacidadeCargaKg || 0)),
    status: d.status,
    ano: d.ano || undefined,
    comprimentoM: d.comprimentoM || undefined,
    observacao: d.observacao?.trim() || undefined,
  };
  if (d.id) {
    const e = db().embarcacoes.find((x) => x.id === d.id);
    if (!e) return falha("Embarcação não encontrada.");
    if (d.status !== "ATIVA" && db().viagens.some((v) => v.embarcacaoId === e.id && new Date(v.partida) > new Date() && v.status === "PROGRAMADA" && passagensDaViagem(v.id).length))
      return falha("Há viagens futuras com passagens vendidas nesta embarcação. Troque a embarcação dessas viagens antes.");
    const agora = new Date();
    const futuras = db().viagens.filter((v) => v.embarcacaoId === e.id && chegadaFinal(v) > agora);
    if (d.assentoLivre) {
      const pico = Math.max(0, ...futuras.map((v) => Math.max(0, ...passageirosPorSegmento(v))));
      if (pico > d.capacidadePassageiros!) return falha(`Há viagem futura com ${pico} passageiros; a lotação não pode ser menor que isso.`);
    } else if (e.assentoLivre && futuras.some((v) => passagensDaViagem(v.id).some((p) => !p.assentoId && p.status !== "CANCELADA"))) {
      return falha("Há passagens de assento livre vendidas para viagens futuras. Para numerar, troque a embarcação dessas viagens ou espere elas acontecerem.");
    }
    Object.assign(e, campos, {
      assentoLivre: !!d.assentoLivre,
      capacidadePassageiros: d.assentoLivre ? Math.round(d.capacidadePassageiros!) : e.assentos.length,
    });
    return { ok: true, id: e.id };
  }
  const id = idUnico(slug(d.nome), (x) => db().embarcacoes.some((e) => e.id === x));
  db().embarcacoes.push({ id, ...campos, assentoLivre: !!d.assentoLivre, capacidadePassageiros: d.assentoLivre ? Math.round(d.capacidadePassageiros!) : 0, colunasMapa: 5, assentos: [] });
  db().comodos.push({ id: `cm-${id}-convencional`, embarcacaoId: id, nome: "Convencional", descricao: "Poltrona", acrescimo: 0, cor: "slate", ativo: true });
  return { ok: true, id };
}

/** Salva o mapa de poltronas. Mantém o id das poltronas cujo código não mudou (passagens continuam ligadas). */
export function salvarMapaAssentos(embarcacaoId: string, colunas: number, novos: Omit<Assento, "id">[]): Resultado {
  const e = db().embarcacoes.find((x) => x.id === embarcacaoId);
  if (!e) return falha("Embarcação não encontrada.");
  if (colunas < 2 || colunas > 9) return falha("O mapa deve ter de 2 a 9 posições por fileira.");
  const codigos = novos.map((a) => a.codigo.trim().toUpperCase());
  if (codigos.some((c) => !c)) return falha("Toda poltrona precisa de um código.");
  const dup = codigos.find((c, i) => codigos.indexOf(c) !== i);
  if (dup) return falha(`Código repetido: ${dup}`);
  const cms = new Set(comodosDaEmbarcacao(e.id).map((c) => c.id));
  if (novos.some((a) => a.comodoId && !cms.has(a.comodoId))) return falha("Cômodo inválido.");

  // Poltronas removidas não podem ter passagem ativa em viagem futura
  const antigos = new Map(e.assentos.map((a) => [a.codigo, a]));
  const removidos = e.assentos.filter((a) => !codigos.includes(a.codigo)).map((a) => a.id);
  const agora = new Date();
  const emUso = db().passagens.filter(
    (p) => !!p.assentoId && removidos.includes(p.assentoId) && passagemAtiva(p) && chegadaFinal(viagem(p.viagemId)!) > agora,
  );
  if (emUso.length) {
    const cods = [...new Set(emUso.map((p) => e.assentos.find((a) => a.id === p.assentoId)!.codigo))];
    return falha(`Não dá para remover poltronas com passagem vendida: ${cods.join(", ")}`);
  }
  e.assentos = novos.map((a, i) => ({
    ...a,
    codigo: codigos[i],
    id: antigos.get(codigos[i])?.id ?? `${e.id}-${codigos[i]}-${randomBytes(2).toString("hex")}`,
  }));
  e.colunasMapa = colunas;
  if (!e.assentoLivre) e.capacidadePassageiros = e.assentos.length;
  return { ok: true };
}

export function salvarComodo(d: { id?: string; embarcacaoId: string; nome: string; descricao: string; acrescimo: number; cor: string; ativo: boolean }): Resultado<{ id: string }> {
  if (!db().embarcacoes.some((e) => e.id === d.embarcacaoId)) return falha("Escolha a embarcação.");
  if (d.nome.trim().length < 2) return falha("Informe o nome do cômodo.");
  if (!(d.acrescimo >= 0)) return falha("O acréscimo não pode ser negativo.");
  const cor = (["rio", "sol", "rubro", "emerald", "slate"].includes(d.cor) ? d.cor : "slate") as "rio";
  const campos = { embarcacaoId: d.embarcacaoId, nome: d.nome.trim(), descricao: d.descricao.trim(), acrescimo: round2(d.acrescimo), cor, ativo: d.ativo };
  if (d.id) {
    const c = db().comodos.find((x) => x.id === d.id);
    if (!c) return falha("Cômodo não encontrado.");
    if (c.embarcacaoId !== d.embarcacaoId && embarcacao(c.embarcacaoId).assentos.some((a) => a.comodoId === c.id))
      return falha("Cômodo em uso no mapa; não pode mudar de embarcação.");
    Object.assign(c, campos);
    return { ok: true, id: c.id };
  }
  const id = idUnico(`cm-${d.embarcacaoId}-${slug(d.nome)}`, (x) => db().comodos.some((c) => c.id === x));
  db().comodos.push({ id, ...campos });
  return { ok: true, id };
}

export function salvarTripulante(d: {
  id?: string;
  nome: string;
  funcao: string;
  documento: string;
  habilitacao: string;
  validadeHabilitacao?: string;
  telefone: string;
  embarcacaoId?: string;
  ativo: boolean;
}): Resultado<{ id: string }> {
  const funcoes = ["COMANDANTE", "IMEDIATO", "MAQUINISTA", "MARINHEIRO", "TAIFEIRO", "COMISSARIO"];
  if (d.nome.trim().length < 3) return falha("Informe o nome.");
  if (!funcoes.includes(d.funcao)) return falha("Escolha a função.");
  if (d.documento.replace(/\D/g, "").length < 5) return falha("Informe o documento.");
  if (d.validadeHabilitacao && !/^\d{4}-\d{2}-\d{2}$/.test(d.validadeHabilitacao)) return falha("Validade inválida.");
  const campos = {
    nome: d.nome.trim(),
    funcao: d.funcao as "COMANDANTE",
    documento: d.documento.trim(),
    habilitacao: d.habilitacao.trim() || "—",
    validadeHabilitacao: d.validadeHabilitacao || undefined,
    telefone: d.telefone.trim(),
    embarcacaoId: d.embarcacaoId || undefined,
    ativo: d.ativo,
  };
  if (d.id) {
    const t = tripulante(d.id);
    if (!t) return falha("Tripulante não encontrado.");
    Object.assign(t, campos);
    return { ok: true, id: t.id };
  }
  const id = idUnico(`tr-${slug(d.nome.split(" ")[0])}`, (x) => db().tripulantes.some((t) => t.id === x));
  db().tripulantes.push({ id, ...campos });
  return { ok: true, id };
}

/** Viagens futuras desta linha que já têm passagens: impedem mudar a sequência de paradas */
function linhaTemVendasFuturas(linhaId: string) {
  const agora = new Date();
  return db().viagens.some((v) => v.linhaId === linhaId && chegadaFinal(v) > agora && passagensDaViagem(v.id).length > 0);
}

export function salvarLinha(d: { id?: string; nome: string; ativa: boolean; paradas: { portoId: string; minutosDesdeOrigem: number }[] }): Resultado<{ id: string }> {
  if (d.nome.trim().length < 3) return falha("Informe o nome da linha.");
  if (d.paradas.length < 2) return falha("A linha precisa de pelo menos 2 paradas.");
  if (d.paradas.some((p) => !db().portos.some((x) => x.id === p.portoId))) return falha("Porto inválido.");
  if (new Set(d.paradas.map((p) => p.portoId)).size !== d.paradas.length) return falha("O mesmo porto aparece duas vezes.");
  if (d.paradas[0].minutosDesdeOrigem !== 0) return falha("A primeira parada é a saída (0 minutos).");
  if (d.paradas.some((p, i) => i > 0 && !(p.minutosDesdeOrigem > d.paradas[i - 1].minutosDesdeOrigem)))
    return falha("Os tempos das paradas precisam aumentar a cada parada.");
  const paradas = d.paradas.map((p, i) => ({ ordem: i, portoId: p.portoId, minutosDesdeOrigem: Math.round(p.minutosDesdeOrigem) }));

  if (d.id) {
    const l = db().linhas.find((x) => x.id === d.id);
    if (!l) return falha("Linha não encontrada.");
    const mesmaSequencia = l.paradas.length === paradas.length && l.paradas.every((p, i) => p.portoId === paradas[i].portoId);
    if (!mesmaSequencia && linhaTemVendasFuturas(l.id))
      return falha("Há passagens vendidas para viagens futuras desta linha; só é possível ajustar os horários, não a sequência de portos.");
    // Preserva o preço de cada par de portos que continua existindo
    const antigo = new Map<string, number>();
    l.paradas.forEach((o) => l.paradas.forEach((x) => l.tarifas[o.ordem]?.[x.ordem] !== undefined && antigo.set(`${o.portoId}>${x.portoId}`, l.tarifas[o.ordem][x.ordem])));
    const tarifas: Linha["tarifas"] = {};
    for (let i = 0; i < paradas.length; i++) {
      tarifas[i] = {};
      for (let j = i + 1; j < paradas.length; j++) tarifas[i][j] = antigo.get(`${paradas[i].portoId}>${paradas[j].portoId}`) ?? 0;
    }
    Object.assign(l, { nome: d.nome.trim(), ativa: d.ativa, paradas, tarifas });
    return { ok: true, id: l.id };
  }
  const id = idUnico(slug(d.nome), (x) => db().linhas.some((l) => l.id === x));
  const tarifas: Linha["tarifas"] = {};
  for (let i = 0; i < paradas.length; i++) {
    tarifas[i] = {};
    for (let j = i + 1; j < paradas.length; j++) tarifas[i][j] = 0;
  }
  db().linhas.push({ id, nome: d.nome.trim(), ativa: d.ativa, paradas, tarifas, horarios: [] });
  return { ok: true, id };
}

export function salvarTarifas(linhaId: string, valores: Record<string, number>): Resultado {
  const l = db().linhas.find((x) => x.id === linhaId);
  if (!l) return falha("Linha não encontrada.");
  const novas: Linha["tarifas"] = {};
  for (let i = 0; i < l.paradas.length; i++) {
    novas[i] = {};
    for (let j = i + 1; j < l.paradas.length; j++) {
      const v = valores[`${i}-${j}`];
      if (!(v >= 0)) return falha(`Preço inválido em ${paradaInfo(l.id, i).cidade.nome} → ${paradaInfo(l.id, j).cidade.nome}.`);
      novas[i][j] = round2(v);
    }
  }
  l.tarifas = novas;
  return { ok: true };
}

export function salvarHorarios(linhaId: string, horarios: Linha["horarios"]): Resultado {
  const l = db().linhas.find((x) => x.id === linhaId);
  if (!l) return falha("Linha não encontrada.");
  for (const h of horarios) {
    if (!(h.diaSemana >= 0 && h.diaSemana <= 6) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.horaSaida)) return falha("Dia ou hora inválida.");
    if (!db().embarcacoes.some((e) => e.id === h.embarcacaoId)) return falha("Embarcação inválida.");
  }
  const chaves = horarios.map((h) => `${h.diaSemana}-${h.horaSaida}`);
  if (new Set(chaves).size !== chaves.length) return falha("Horário repetido no mesmo dia.");
  l.horarios = [...horarios].sort((a, b) => a.diaSemana - b.diaSemana || a.horaSaida.localeCompare(b.horaSaida));
  return { ok: true };
}

export function salvarConvenio(d: { id?: string; nome: string; cnpj?: string; descontoPercentual: number; faturado: boolean; contato?: string; ativo: boolean }): Resultado<{ id: string }> {
  if (d.nome.trim().length < 3) return falha("Informe o nome do convênio.");
  if (!(d.descontoPercentual >= 0 && d.descontoPercentual <= 100)) return falha("O desconto deve ficar entre 0% e 100%.");
  const campos = { nome: d.nome.trim(), cnpj: d.cnpj?.trim() || undefined, descontoPercentual: round2(d.descontoPercentual), faturado: d.faturado, contato: d.contato?.trim() || undefined, ativo: d.ativo };
  if (d.id) {
    const c = convenio(d.id);
    if (!c) return falha("Convênio não encontrado.");
    Object.assign(c, campos);
    return { ok: true, id: c.id };
  }
  const id = idUnico(`cv-${slug(d.nome).slice(0, 24)}`, (x) => db().convenios.some((c) => c.id === x));
  db().convenios.push({ id, ...campos });
  return { ok: true, id };
}

export function salvarAgencia(d: { id?: string; nome: string; cidadeId: string; comissaoPercentual: number; ativa: boolean }): Resultado<{ id: string }> {
  if (d.nome.trim().length < 3) return falha("Informe o nome da agência.");
  if (!db().cidades.some((c) => c.id === d.cidadeId)) return falha("Escolha a cidade.");
  if (!(d.comissaoPercentual >= 0 && d.comissaoPercentual <= 50)) return falha("Comissão deve ficar entre 0% e 50%.");
  const campos = { nome: d.nome.trim(), cidadeId: d.cidadeId, comissaoPercentual: round2(d.comissaoPercentual), ativa: d.ativa };
  if (d.id) {
    const a = db().agencias.find((x) => x.id === d.id);
    if (!a) return falha("Agência não encontrada.");
    Object.assign(a, campos);
    return { ok: true, id: a.id };
  }
  const id = idUnico(`ag-${slug(d.nome)}`, (x) => db().agencias.some((a) => a.id === x));
  db().agencias.push({ id, ...campos });
  return { ok: true, id };
}

export function salvarUsuario(d: { id?: string; nome: string; email: string; papel: string; agenciaId?: string; linhasPermitidas: string[]; ativo: boolean }): Resultado<{ id: string }> {
  const papeis = ["ADMIN", "GERENTE", "VENDEDOR", "CONFERENTE"];
  if (d.nome.trim().length < 3) return falha("Informe o nome.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) return falha("E-mail inválido.");
  if (!papeis.includes(d.papel)) return falha("Escolha o perfil.");
  if (d.agenciaId && !db().agencias.some((a) => a.id === d.agenciaId)) return falha("Agência inválida.");
  const email = d.email.trim().toLowerCase();
  if (db().usuarios.some((u) => u.email === email && u.id !== d.id)) return falha("E-mail já usado por outro usuário.");
  const campos = {
    nome: d.nome.trim(),
    email,
    papel: d.papel as "ADMIN",
    agenciaId: d.agenciaId || undefined,
    linhasPermitidas: d.linhasPermitidas.filter((l) => db().linhas.some((x) => x.id === l)),
    ativo: d.ativo,
  };
  if (d.id) {
    const u = usuario(d.id);
    if (!u) return falha("Usuário não encontrado.");
    if (u.papel === "ADMIN" && (campos.papel !== "ADMIN" || !campos.ativo) && db().usuarios.filter((x) => x.papel === "ADMIN" && x.ativo).length === 1)
      return falha("Precisa existir ao menos um administrador ativo.");
    Object.assign(u, campos);
    return { ok: true, id: u.id };
  }
  const id = idUnico(`u-${slug(d.nome.split(" ")[0])}`, (x) => db().usuarios.some((u) => u.id === x));
  db().usuarios.push({ id, ...campos });
  return { ok: true, id };
}

export function salvarConfig<K extends keyof Configuracao>(secao: K, valores: Configuracao[K]): Resultado {
  db().config[secao] = structuredClone(valores);
  return { ok: true };
}

// ─── Indicadores ───────────────────────────────────────────────

export function pedidosPagos(desde?: Date, ate?: Date) {
  return db().pedidos.filter((p) => {
    if (p.status !== "PAGO") return false;
    const c = new Date(p.createdAt);
    return (!desde || c >= desde) && (!ate || c < ate);
  });
}
