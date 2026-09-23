import "server-only";
import { randomBytes } from "node:crypto";
import { addMinutes, localDayKey } from "./format";
import { seed, type Db } from "./seed";
import type { CanalVenda, Encomenda, MetodoPagamento, Passagem, Pedido, StatusEncomenda, TipoPassageiro, Viagem } from "./types";

// Banco em memória do protótipo. Na próxima fase é trocado por Prisma/PostgreSQL
// mantendo as mesmas funções (a interface das telas não muda).
const g = globalThis as unknown as { __navstarDb?: Db };
export function db(): Db {
  g.__navstarDb ??= seed();
  return g.__navstarDb;
}

export const EMPRESA = {
  nome: "São Tomé Expresso",
  razaoSocial: "Brigido Locação e Transportes de Navegação LTDA",
  cnpj: "06.326.986/0001-70",
  whatsapps: [
    { cidade: "Manaus", numero: "(92) 99127-4661", link: "5592991274661" },
    { cidade: "Santarém", numero: "(93) 99197-5141", link: "5593991975141" },
  ],
  whatsapp: "5592991274661", // principal (botões do site)
  email: "contato@saotomeexpresso.com.br", // provisório
  tipoServico: "Expresso",
  beneficios: ["café", "almoço", "Wi-Fi grátis", "ambiente climatizado", "poltronas reclináveis"],
  minutosReservaSite: 30,
};

const code = (prefix: string, len = 6) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(len);
  return `${prefix}-${Array.from(bytes, (b) => chars[b % chars.length]).join("")}`;
};

// ─── Leituras básicas ──────────────────────────────────────────

export const cidade = (id: string) => db().cidades.find((c) => c.id === id)!;
export const porto = (id: string) => db().portos.find((p) => p.id === id)!;
export const linha = (id: string) => db().linhas.find((l) => l.id === id)!;
export const embarcacao = (id: string) => db().embarcacoes.find((e) => e.id === id)!;
export const viagem = (id: string) => db().viagens.find((v) => v.id === id);
export const pedidoPorCodigo = (c: string) => db().pedidos.find((p) => p.codigo === c.toUpperCase());
export const passagensDoPedido = (pedidoId: string) => db().passagens.filter((p) => p.pedidoId === pedidoId);
export const encomendaPorCodigo = (c: string) => db().encomendas.find((e) => e.codigo === c.toUpperCase().trim());

export function paradaInfo(linhaId: string, ordem: number) {
  const l = linha(linhaId);
  const parada = l.paradas[ordem];
  const p = porto(parada.portoId);
  return { ...parada, porto: p, cidade: cidade(p.cidadeId) };
}

export function horarioParada(v: Viagem, ordem: number) {
  return addMinutes(v.partida, linha(v.linhaId).paradas[ordem].minutosDesdeOrigem);
}

/** Cidades atendidas, na ordem do rio */
export function cidadesAtendidas() {
  const ids = new Set(db().linhas.flatMap((l) => l.paradas.map((p) => porto(p.portoId).cidadeId)));
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
    if (p.viagemId !== viagemId || !passagemAtiva(p)) continue;
    if (p.origemOrdem < destino && origem < p.destinoOrdem) set.add(p.assentoId);
  }
  return set;
}

export function lugaresLivres(v: Viagem, origem: number, destino: number) {
  return embarcacao(v.embarcacaoId).assentos.length - assentosOcupados(v.id, origem, destino).size;
}

/** Ocupação máxima entre os segmentos (para lotação da viagem inteira) */
export function ocupacaoViagem(v: Viagem) {
  const l = linha(v.linhaId);
  const total = embarcacao(v.embarcacaoId).assentos.length;
  let max = 0;
  for (let s = 0; s < l.paradas.length - 1; s++) max = Math.max(max, assentosOcupados(v.id, s, s + 1).size);
  return { ocupados: max, total, pct: Math.round((max / total) * 100) };
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
        valor: l.tarifas[o][d],
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

// ─── Criação de pedido ─────────────────────────────────────────

export const DESCONTO: Record<TipoPassageiro, number> = { INTEIRA: 0, CRIANCA: 0.5, IDOSO: 0.5, ESTUDANTE: 0.5, PCD: 1 };

export type NovoPedidoInput = {
  viagemId: string;
  origemOrdem: number;
  destinoOrdem: number;
  canal: CanalVenda;
  comprador: { nome: string; email?: string; telefone: string };
  passageiros: { assentoId: string; nome: string; documento: string; tipo: TipoPassageiro }[];
  metodo: MetodoPagamento;
  vendedorId?: string;
  pagoNoAto?: boolean; // balcão: dinheiro/cartão recebidos na hora
};

export function criarPedido(input: NovoPedidoInput): { ok: true; pedido: Pedido } | { ok: false; erro: string } {
  const v = viagem(input.viagemId);
  if (!v || !v.vendasAbertas || v.status === "CANCELADA" || v.status === "CONCLUIDA") return { ok: false, erro: "Viagem indisponível para venda." };
  const l = linha(v.linhaId);
  const { origemOrdem: o, destinoOrdem: d } = input;
  if (!(o >= 0 && d < l.paradas.length && o < d)) return { ok: false, erro: "Trecho inválido." };
  if (!input.passageiros.length) return { ok: false, erro: "Selecione ao menos um assento." };
  if (input.passageiros.some((p) => p.nome.trim().length < 3 || p.documento.replace(/\D/g, "").length < 5))
    return { ok: false, erro: "Preencha nome e documento de todos os passageiros." };

  const assentosValidos = new Set(embarcacao(v.embarcacaoId).assentos.map((a) => a.id));
  const ocupados = assentosOcupados(v.id, o, d);
  const escolhidos = input.passageiros.map((p) => p.assentoId);
  if (new Set(escolhidos).size !== escolhidos.length || escolhidos.some((a) => !assentosValidos.has(a)))
    return { ok: false, erro: "Seleção de assentos inválida." };
  const conflito = escolhidos.find((a) => ocupados.has(a));
  if (conflito) return { ok: false, erro: "Um dos assentos acabou de ser vendido. Escolha outro." };

  const agora = new Date();
  const pago = !!input.pagoNoAto;
  const taxa = porto(l.paradas[o].portoId).taxaEmbarque;
  const cheio = l.tarifas[o][d];
  const pedidoId = `ped-${randomBytes(6).toString("hex")}`;
  const ano = new Date().getFullYear();
  const seq = db().pedidos.filter((x) => x.numero.split("-")[1] === String(ano)).length + 1;
  let subtotal = 0;
  for (const p of input.passageiros) {
    const valor = Math.round(cheio * (1 - DESCONTO[p.tipo]) * 100) / 100;
    subtotal += valor;
    db().passagens.push({
      id: `pas-${randomBytes(6).toString("hex")}`,
      pedidoId,
      viagemId: v.id,
      assentoId: p.assentoId,
      origemOrdem: o,
      destinoOrdem: d,
      nome: p.nome.trim(),
      documento: p.documento.trim(),
      tipo: p.tipo,
      valor,
      taxaEmbarque: taxa,
      status: pago ? "EMITIDA" : "RESERVADA",
      qrToken: code("QR", 12),
    });
  }
  const taxas = taxa * input.passageiros.length;
  const total = subtotal + taxas;
  const pedido: Pedido = {
    id: pedidoId,
    codigo: code("ST"),
    numero: `${cidade(porto(l.paradas[o].portoId).cidadeId).sigla}-${ano}-${String(seq).padStart(4, "0")}`,
    canal: input.canal,
    status: pago ? "PAGO" : "AGUARDANDO_PAGAMENTO",
    compradorNome: input.comprador.nome.trim(),
    compradorEmail: input.comprador.email?.trim() || undefined,
    compradorTelefone: input.comprador.telefone.trim(),
    vendedorId: input.vendedorId,
    subtotal,
    taxas,
    desconto: 0,
    total,
    comissaoAgencia: 0,
    expiraEm: pago ? undefined : addMinutes(agora, EMPRESA.minutosReservaSite).toISOString(),
    createdAt: agora.toISOString(),
    pagamentos: [
      {
        id: `pg-${randomBytes(6).toString("hex")}`,
        metodo: input.metodo,
        status: pago ? "APROVADO" : "PENDENTE",
        valor: total,
        pagoEm: pago ? agora.toISOString() : undefined,
        // Placeholder: o gateway real devolve o "copia e cola" do PIX
        pixCopiaCola:
          input.metodo === "PIX" && !pago
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

// ─── Embarque ──────────────────────────────────────────────────

export function validarEmbarque(token: string) {
  const t = token.trim().toUpperCase();
  const p = db().passagens.find((x) => x.qrToken === t);
  if (!p) return { ok: false as const, erro: "Bilhete não encontrado." };
  const v = viagem(p.viagemId)!;
  if (p.status === "EMBARCADA") return { ok: false as const, erro: "Este bilhete já foi utilizado.", passagem: p, viagem: v };
  if (p.status !== "EMITIDA") return { ok: false as const, erro: "Bilhete sem pagamento confirmado ou cancelado.", passagem: p, viagem: v };
  p.status = "EMBARCADA";
  p.embarcadoEm = new Date().toISOString();
  return { ok: true as const, passagem: p, viagem: v };
}

// ─── Encomendas ────────────────────────────────────────────────

export const FLUXO_ENCOMENDA: StatusEncomenda[] = ["RECEBIDA", "EMBARCADA", "EM_TRANSITO", "DISPONIVEL_RETIRADA", "ENTREGUE"];

export function criarEncomenda(e: Omit<Encomenda, "id" | "codigo" | "status" | "createdAt" | "eventos">) {
  const agora = new Date().toISOString();
  const enc: Encomenda = {
    ...e,
    id: `enc-${randomBytes(6).toString("hex")}`,
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

// ─── Indicadores ───────────────────────────────────────────────

export function pedidosPagos(desde?: Date, ate?: Date) {
  return db().pedidos.filter((p) => {
    if (p.status !== "PAGO") return false;
    const c = new Date(p.createdAt);
    return (!desde || c >= desde) && (!ate || c < ate);
  });
}
