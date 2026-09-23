import "server-only";
import { date, dateShort, label, localDayKey, manausDate, money, time } from "./format";
import { RELATORIOS, type SlugRelatorio } from "./relatorios-lista";
import {
  cidade,
  config,
  convenio,
  db,
  embarcacao,
  linha,
  ocupacaoViagem,
  paradaInfo,
  passagensDaViagem,
  porto,
  resumoCaixa,
  rotuloAssento,
  tarifaViagem,
  usuario,
  viagem,
} from "./store";
import type { Passagem, Pedido } from "./types";

// ─── Filtros ───────────────────────────────────────────────────

export type Filtros = { de: string; ate: string; linhaId: string; embarcacaoId: string; usuarioId: string; q: string; inicio: Date; fim: Date };

/** Lê os filtros da URL. Período padrão: mês atual (datas em Manaus, `ate` inclusivo). */
export function lerFiltros(sp: Record<string, string | string[] | undefined>): Filtros {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const hoje = localDayKey(new Date());
  const valida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  let de = valida(s("de")) ? s("de") : `${hoje.slice(0, 7)}-01`;
  let ate = valida(s("ate")) ? s("ate") : hoje;
  if (de > ate) [de, ate] = [ate, de];
  const [y1, m1, d1] = de.split("-").map(Number);
  const [y2, m2, d2] = ate.split("-").map(Number);
  return { de, ate, linhaId: s("linha"), embarcacaoId: s("embarcacao"), usuarioId: s("usuario"), q: s("q"), inicio: manausDate(y1, m1 - 1, d1), fim: manausDate(y2, m2 - 1, d2 + 1) };
}

export const qsFiltros = (f: Filtros) =>
  new URLSearchParams(Object.entries({ de: f.de, ate: f.ate, linha: f.linhaId, embarcacao: f.embarcacaoId, usuario: f.usuarioId, q: f.q }).filter(([, v]) => v)).toString();

// ─── Estrutura de saída ────────────────────────────────────────

export type TipoColuna = "texto" | "int" | "money" | "pct" | "kg";
export type Coluna = { k: string; l: string; t?: TipoColuna };
export type Linha = Record<string, string | number | undefined> & { _href?: string };
export type Relatorio = {
  titulo: string;
  descricao: string;
  destaques: { l: string; v: string; hint?: string }[];
  colunas: Coluna[];
  linhas: Linha[];
  total?: Linha;
  grafico?: { titulo: string; dados: { label: string; value: number }[] };
  nota?: string;
  filtros: ("linha" | "embarcacao" | "usuario" | "q")[];
};

export function formatar(v: string | number | undefined, t: TipoColuna = "texto") {
  if (v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  if (t === "money") return money(v);
  if (t === "pct") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (t === "kg") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
  return v.toLocaleString("pt-BR");
}

// ─── Bases de dados do período ─────────────────────────────────

const soma = <T,>(xs: T[], f: (x: T) => number) => Math.round(xs.reduce((s, x) => s + f(x), 0) * 100) / 100;
const noPeriodo = (iso: string, f: Filtros) => {
  const d = new Date(iso);
  return d >= f.inicio && d < f.fim;
};
function agrupar<T>(xs: T[], chave: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = chave(x);
    const g = m.get(k);
    if (g) g.push(x);
    else m.set(k, [x]);
  }
  return m;
}

function viagemDoPedido(p: Pedido) {
  const pas = db().passagens.find((x) => x.pedidoId === p.id);
  return pas ? viagem(pas.viagemId) : undefined;
}

/** Pedidos pagos criados no período, com os filtros de linha, embarcação e vendedor */
function vendas(f: Filtros) {
  return db().pedidos.filter((p) => {
    if (p.status !== "PAGO" || !noPeriodo(p.createdAt, f)) return false;
    if (f.usuarioId && p.vendedorId !== f.usuarioId) return false;
    if (f.linhaId || f.embarcacaoId) {
      const v = viagemDoPedido(p);
      if (!v || (f.linhaId && v.linhaId !== f.linhaId) || (f.embarcacaoId && v.embarcacaoId !== f.embarcacaoId)) return false;
    }
    return true;
  });
}

function passagensVendidas(f: Filtros) {
  const ids = new Set(vendas(f).map((p) => p.id));
  return db().passagens.filter((x) => ids.has(x.pedidoId) && x.status !== "CANCELADA");
}

function viagensDoPeriodo(f: Filtros) {
  return db().viagens.filter(
    (v) => noPeriodo(v.partida, f) && (!f.linhaId || v.linhaId === f.linhaId) && (!f.embarcacaoId || v.embarcacaoId === f.embarcacaoId),
  );
}

const tarifaCheia = (x: Passagem) => tarifaViagem(viagem(x.viagemId)!, x.origemOrdem, x.destinoOrdem) + x.acrescimo;

function diasDoPeriodo(f: Filtros) {
  const out: string[] = [];
  for (let d = new Date(f.inicio); d < f.fim; d = new Date(d.getTime() + 86_400_000)) out.push(localDayKey(d));
  return out;
}

// ─── Relatórios ────────────────────────────────────────────────

type Gerador = (f: Filtros) => Omit<Relatorio, "titulo" | "descricao">;

const GERADORES: Record<SlugRelatorio, Gerador> = {
  geral(f) {
    const ps = vendas(f);
    const pas = passagensVendidas(f);
    const canc = db().cancelamentos.filter((c) => noPeriodo(c.createdAt, f));
    const porDia = agrupar(ps, (p) => localDayKey(p.createdAt));
    const linhas = diasDoPeriodo(f).map((d) => {
      const x = porDia.get(d) ?? [];
      const bruto = soma(x, (p) => p.total);
      const taxas = soma(x, (p) => p.taxas);
      const com = soma(x, (p) => p.comissaoAgencia);
      return { data: date(d + "T12:00:00Z"), pedidos: x.length, passagens: pas.filter((p) => x.some((y) => y.id === p.pedidoId)).length, bruto, taxas, comissoes: com, liquido: bruto - taxas - com };
    });
    const bruto = soma(ps, (p) => p.total);
    const taxas = soma(ps, (p) => p.taxas);
    const com = soma(ps, (p) => p.comissaoAgencia);
    return {
      filtros: ["linha", "embarcacao", "usuario"],
      destaques: [
        { l: "Vendido (bruto)", v: money(bruto), hint: `${ps.length} pedidos · ${pas.length} passagens` },
        { l: "Líquido da empresa", v: money(bruto - taxas - com), hint: "Bruto − taxas de embarque − comissões" },
        { l: "Taxas de embarque", v: money(taxas), hint: `Comissões de agências ${money(com)}` },
        { l: "Reembolsos", v: money(soma(canc, (c) => c.reembolso)), hint: `${canc.length} cancelamentos · multas ${money(soma(canc, (c) => c.multa))}` },
      ],
      colunas: [
        { k: "data", l: "Data" },
        { k: "pedidos", l: "Pedidos", t: "int" },
        { k: "passagens", l: "Passagens", t: "int" },
        { k: "bruto", l: "Bruto", t: "money" },
        { k: "taxas", l: "Taxas", t: "money" },
        { k: "comissoes", l: "Comissões", t: "money" },
        { k: "liquido", l: "Líquido", t: "money" },
      ],
      linhas,
      total: { data: "Total", pedidos: ps.length, passagens: pas.length, bruto, taxas, comissoes: com, liquido: bruto - taxas - com },
      grafico: { titulo: "Vendido por dia", dados: linhas.map((l) => ({ label: String(l.data).slice(0, 5), value: l.bruto })) },
    };
  },

  fiscal(f) {
    const pas = passagensVendidas(f);
    const pedidos = new Map(db().pedidos.map((p) => [p.id, p]));
    const encs = db().encomendas.filter((e) => noPeriodo(e.createdAt, f));
    const porDia = agrupar(pas, (x) => localDayKey(pedidos.get(x.pedidoId)!.createdAt));
    const encDia = agrupar(encs, (e) => localDayKey(e.createdAt));
    const linhas = diasDoPeriodo(f).map((d) => {
      const x = porDia.get(d) ?? [];
      const receita = soma(x, (p) => p.valor);
      const fretes = soma(encDia.get(d) ?? [], (e) => e.frete);
      return {
        data: date(d + "T12:00:00Z"),
        bilhetes: x.length,
        receita,
        gratuidades: x.filter((p) => p.valor === 0).length,
        renuncia: soma(x, (p) => tarifaCheia(p) - p.valor),
        taxas: soma(x, (p) => p.taxaEmbarque),
        fretes,
        tributavel: receita + fretes,
      };
    });
    const t = (k: keyof (typeof linhas)[number]) => soma(linhas, (l) => Number(l[k]));
    return {
      filtros: ["linha", "embarcacao"],
      destaques: [
        { l: "Receita de passagens", v: money(t("receita")), hint: `${pas.length} bilhetes emitidos` },
        { l: "Receita de fretes", v: money(t("fretes")), hint: `${encs.length} encomendas` },
        { l: "Descontos e gratuidades", v: money(t("renuncia")), hint: `${t("gratuidades")} gratuidades (PCD/convênio 100%)` },
        { l: "Taxas de embarque (terceiros)", v: money(t("taxas")), hint: "Repasse aos portos — não é receita" },
      ],
      colunas: [
        { k: "data", l: "Data" },
        { k: "bilhetes", l: "Bilhetes", t: "int" },
        { k: "receita", l: "Passagens", t: "money" },
        { k: "gratuidades", l: "Gratuidades", t: "int" },
        { k: "renuncia", l: "Descontos", t: "money" },
        { k: "taxas", l: "Taxas embarque", t: "money" },
        { k: "fretes", l: "Fretes", t: "money" },
        { k: "tributavel", l: "Base (passagens + fretes)", t: "money" },
      ],
      linhas,
      total: { data: "Total", bilhetes: pas.length, receita: t("receita"), gratuidades: t("gratuidades"), renuncia: t("renuncia"), taxas: t("taxas"), fretes: t("fretes"), tributavel: t("tributavel") },
      nota: "Base para conferência do contador. O BP-e (bilhete eletrônico na SEFAZ) ainda não é emitido pelo sistema; a apuração de ICMS depende do regime da empresa.",
    };
  },

  "por-viagem"(f) {
    const vs = viagensDoPeriodo(f);
    const linhas = vs.map((v) => {
      const pas = passagensDaViagem(v.id).filter((p) => p.status !== "RESERVADA");
      const encs = db().encomendas.filter((e) => e.viagemId === v.id);
      return {
        _href: `/admin/viagens/${v.id}`,
        codigo: v.id,
        saida: `${dateShort(v.partida)} ${time(v.partida)}`,
        linha: linha(v.linhaId).nome,
        embarcacao: embarcacao(v.embarcacaoId).nome,
        status: label(v.status),
        passageiros: pas.length,
        embarcados: pas.filter((p) => p.status === "EMBARCADA").length,
        noshow: pas.filter((p) => p.status === "NAO_COMPARECEU").length,
        lotacao: ocupacaoViagem(v).pct,
        receita: soma(pas, (p) => p.valor),
        encomendas: encs.length,
        frete: soma(encs, (e) => e.frete),
      };
    });
    const pax = soma(linhas, (l) => l.passageiros);
    return {
      filtros: ["linha", "embarcacao"],
      destaques: [
        { l: "Viagens", v: String(vs.length), hint: `${vs.filter((v) => v.status === "CANCELADA").length} canceladas` },
        { l: "Passageiros", v: pax.toLocaleString("pt-BR"), hint: `${vs.length ? Math.round(pax / vs.length) : 0} por viagem` },
        { l: "Lotação média", v: `${linhas.length ? Math.round(soma(linhas, (l) => l.lotacao) / linhas.length) : 0}%`, hint: "Trecho mais cheio de cada viagem" },
        { l: "Receita de passagens", v: money(soma(linhas, (l) => l.receita)), hint: `Fretes ${money(soma(linhas, (l) => l.frete))}` },
      ],
      colunas: [
        { k: "codigo", l: "Viagem" },
        { k: "saida", l: "Saída" },
        { k: "linha", l: "Linha" },
        { k: "embarcacao", l: "Embarcação" },
        { k: "status", l: "Status" },
        { k: "passageiros", l: "Passageiros", t: "int" },
        { k: "embarcados", l: "Embarcados", t: "int" },
        { k: "noshow", l: "Não compareceram", t: "int" },
        { k: "lotacao", l: "Lotação", t: "pct" },
        { k: "receita", l: "Receita", t: "money" },
        { k: "encomendas", l: "Encomendas", t: "int" },
        { k: "frete", l: "Frete", t: "money" },
      ],
      linhas,
      total: { codigo: "Total", passageiros: pax, embarcados: soma(linhas, (l) => l.embarcados), noshow: soma(linhas, (l) => l.noshow), receita: soma(linhas, (l) => l.receita), encomendas: soma(linhas, (l) => l.encomendas), frete: soma(linhas, (l) => l.frete) },
      nota: "Considera as viagens com saída no período (não a data da venda).",
    };
  },

  "por-porto"(f) {
    const pas = passagensVendidas(f);
    const embarque = agrupar(pas, (x) => linha(viagem(x.viagemId)!.linhaId).paradas[x.origemOrdem].portoId);
    const desembarque = agrupar(pas, (x) => linha(viagem(x.viagemId)!.linhaId).paradas[x.destinoOrdem].portoId);
    const linhas = db().portos
      .map((p) => {
        const e = embarque.get(p.id) ?? [];
        return { porto: p.nome, cidade: cidade(p.cidadeId).nome, embarques: e.length, desembarques: (desembarque.get(p.id) ?? []).length, receita: soma(e, (x) => x.valor), taxa: soma(e, (x) => x.taxaEmbarque) };
      })
      .filter((l) => l.embarques || l.desembarques)
      .sort((a, b) => b.receita - a.receita);
    return {
      filtros: ["linha", "embarcacao", "usuario"],
      destaques: linhas.slice(0, 4).map((l) => ({ l: l.cidade, v: money(l.receita), hint: `${l.embarques} embarques · ${l.desembarques} desembarques` })),
      colunas: [
        { k: "porto", l: "Porto" },
        { k: "cidade", l: "Cidade" },
        { k: "embarques", l: "Embarques", t: "int" },
        { k: "desembarques", l: "Desembarques", t: "int" },
        { k: "receita", l: "Receita (embarque)", t: "money" },
        { k: "taxa", l: "Taxa arrecadada", t: "money" },
      ],
      linhas,
      total: { porto: "Total", embarques: pas.length, desembarques: pas.length, receita: soma(linhas, (l) => l.receita), taxa: soma(linhas, (l) => l.taxa) },
      grafico: { titulo: "Receita por porto de embarque", dados: linhas.map((l) => ({ label: l.cidade, value: l.receita })) },
    };
  },

  "por-usuario"(f) {
    const ps = vendas(f);
    const g = agrupar(ps, (p) => p.vendedorId ?? "site");
    const met = (x: Pedido[], m: string[]) => soma(x.filter((p) => m.includes(p.pagamentos[0].metodo)), (p) => p.total);
    const linhas = [...g.entries()]
      .map(([id, x]) => {
        const u = usuario(id);
        return {
          usuario: u?.nome ?? "Sem vendedor (site e WhatsApp)",
          perfil: u ? label(u.papel) : "—",
          agencia: db().agencias.find((a) => a.id === u?.agenciaId)?.nome ?? "—",
          pedidos: x.length,
          passagens: db().passagens.filter((p) => x.some((y) => y.id === p.pedidoId) && p.status !== "CANCELADA").length,
          dinheiro: met(x, ["DINHEIRO"]),
          pix: met(x, ["PIX"]),
          cartao: met(x, ["CARTAO_CREDITO", "CARTAO_DEBITO"]),
          faturado: met(x, ["FATURADO"]),
          total: soma(x, (p) => p.total),
          comissao: soma(x, (p) => p.comissaoAgencia),
        };
      })
      .sort((a, b) => b.total - a.total);
    return {
      filtros: ["linha", "embarcacao", "usuario"],
      destaques: linhas.slice(0, 4).map((l) => ({ l: l.usuario, v: money(l.total), hint: `${l.pedidos} pedidos · ${l.perfil}` })),
      colunas: [
        { k: "usuario", l: "Usuário" },
        { k: "perfil", l: "Perfil" },
        { k: "agencia", l: "Agência" },
        { k: "pedidos", l: "Pedidos", t: "int" },
        { k: "passagens", l: "Passagens", t: "int" },
        { k: "dinheiro", l: "Dinheiro", t: "money" },
        { k: "pix", l: "PIX", t: "money" },
        { k: "cartao", l: "Cartão", t: "money" },
        { k: "faturado", l: "Faturado", t: "money" },
        { k: "total", l: "Total", t: "money" },
        { k: "comissao", l: "Comissão", t: "money" },
      ],
      linhas,
      total: { usuario: "Total", pedidos: ps.length, passagens: soma(linhas, (l) => l.passagens), dinheiro: soma(linhas, (l) => l.dinheiro), pix: soma(linhas, (l) => l.pix), cartao: soma(linhas, (l) => l.cartao), faturado: soma(linhas, (l) => l.faturado), total: soma(linhas, (l) => l.total), comissao: soma(linhas, (l) => l.comissao) },
    };
  },

  "por-convenio"(f) {
    const pas = passagensVendidas(f).filter((x) => x.convenioId);
    const linhas = [...agrupar(pas, (x) => x.convenioId!).entries()]
      .map(([id, x]) => {
        const c = convenio(id)!;
        const cheio = soma(x, tarifaCheia);
        const cobrado = soma(x, (p) => p.valor);
        return { convenio: c.nome, tipo: c.faturado ? "Faturado" : "Desconto no ato", desconto: c.descontoPercentual, passagens: x.length, cheio, concedido: cheio - cobrado, cobrado, faturar: c.faturado ? soma(x, (p) => p.valor + p.taxaEmbarque) : 0 };
      })
      .sort((a, b) => b.passagens - a.passagens);
    return {
      filtros: ["linha", "embarcacao"],
      destaques: [
        { l: "Passagens de convênio", v: String(pas.length) },
        { l: "Desconto concedido", v: money(soma(linhas, (l) => l.concedido)) },
        { l: "A faturar", v: money(soma(linhas, (l) => l.faturar)), hint: "Convênios faturados (inclui taxa de embarque)" },
      ],
      colunas: [
        { k: "convenio", l: "Convênio" },
        { k: "tipo", l: "Tipo" },
        { k: "desconto", l: "Desconto", t: "pct" },
        { k: "passagens", l: "Passagens", t: "int" },
        { k: "cheio", l: "Valor cheio", t: "money" },
        { k: "concedido", l: "Desconto concedido", t: "money" },
        { k: "cobrado", l: "Valor da passagem", t: "money" },
        { k: "faturar", l: "A faturar", t: "money" },
      ],
      linhas,
      total: { convenio: "Total", passagens: pas.length, cheio: soma(linhas, (l) => l.cheio), concedido: soma(linhas, (l) => l.concedido), cobrado: soma(linhas, (l) => l.cobrado), faturar: soma(linhas, (l) => l.faturar) },
    };
  },

  individual(f) {
    const q = f.q.toLowerCase();
    const dig = f.q.replace(/\D/g, "");
    const pedidos = new Map(db().pedidos.map((p) => [p.id, p]));
    const pas =
      q.length < 3
        ? []
        : db()
            .passagens.filter((x) => x.nome.toLowerCase().includes(q) || (dig.length >= 4 && x.documento.replace(/\D/g, "").includes(dig)))
            .sort((a, b) => viagem(b.viagemId)!.partida.localeCompare(viagem(a.viagemId)!.partida));
    const linhas = pas.slice(0, 200).map((x) => {
      const v = viagem(x.viagemId)!;
      const p = pedidos.get(x.pedidoId)!;
      return {
        _href: `/admin/pedidos/${p.codigo}`,
        passageiro: x.nome,
        documento: x.documento,
        viagem: `${dateShort(v.partida)} ${time(v.partida)}`,
        trecho: `${paradaInfo(v.linhaId, x.origemOrdem).cidade.nome} → ${paradaInfo(v.linhaId, x.destinoOrdem).cidade.nome}`,
        poltrona: rotuloAssento(x),
        pedido: p.codigo,
        tipo: label(x.tipo),
        status: label(x.status),
        valor: x.valor + x.taxaEmbarque,
      };
    });
    const pessoas = new Set(pas.map((x) => x.documento));
    return {
      filtros: ["q"],
      destaques: q.length < 3 ? [] : [
        { l: "Passagens encontradas", v: String(pas.length), hint: `${pessoas.size} documento(s) diferente(s)` },
        { l: "Viagens realizadas", v: String(pas.filter((x) => x.status === "EMBARCADA").length), hint: `${pas.filter((x) => x.status === "NAO_COMPARECEU").length} não compareceu` },
        { l: "Total pago", v: money(soma(pas.filter((x) => x.status !== "CANCELADA"), (x) => x.valor + x.taxaEmbarque)) },
      ],
      colunas: [
        { k: "passageiro", l: "Passageiro" },
        { k: "documento", l: "Documento" },
        { k: "viagem", l: "Viagem" },
        { k: "trecho", l: "Trecho" },
        { k: "poltrona", l: "Poltrona" },
        { k: "pedido", l: "Pedido" },
        { k: "tipo", l: "Tipo" },
        { k: "status", l: "Status" },
        { k: "valor", l: "Valor", t: "money" },
      ],
      linhas,
      nota: q.length < 3 ? "Digite pelo menos 3 letras do nome ou 4 dígitos do documento. A busca considera todo o histórico, sem o filtro de período." : "Busca em todo o histórico (sem filtro de período).",
    };
  },

  caixas(f) {
    const cxs = db()
      .caixas.filter((c) => c.fechadoEm && noPeriodo(c.fechadoEm, f) && (!f.usuarioId || c.usuarioId === f.usuarioId))
      .sort((a, b) => b.fechadoEm!.localeCompare(a.fechadoEm!));
    const linhas = cxs.map((c) => {
      const r = resumoCaixa(c);
      return {
        _href: `/admin/caixa/${c.id}`,
        operador: usuario(c.usuarioId)?.nome ?? "—",
        abertura: `${dateShort(c.abertoEm)} ${time(c.abertoEm)}`,
        fechamento: `${dateShort(c.fechadoEm!)} ${time(c.fechadoEm!)}`,
        vendido: r.vendido,
        dinheiro: r.dinheiro,
        sangrias: r.sangrias,
        esperado: r.esperado,
        contado: c.valorContado ?? 0,
        diferenca: r.diferenca ?? 0,
      };
    });
    const dif = soma(linhas, (l) => l.diferenca);
    return {
      filtros: ["usuario"],
      destaques: [
        { l: "Caixas fechados", v: String(cxs.length) },
        { l: "Vendido nos caixas", v: money(soma(linhas, (l) => l.vendido)), hint: `Dinheiro ${money(soma(linhas, (l) => l.dinheiro))}` },
        { l: "Diferença acumulada", v: money(dif), hint: `${linhas.filter((l) => l.diferenca !== 0).length} caixa(s) com diferença` },
      ],
      colunas: [
        { k: "operador", l: "Operador" },
        { k: "abertura", l: "Abertura" },
        { k: "fechamento", l: "Fechamento" },
        { k: "vendido", l: "Vendido", t: "money" },
        { k: "dinheiro", l: "Dinheiro", t: "money" },
        { k: "sangrias", l: "Sangrias", t: "money" },
        { k: "esperado", l: "Esperado", t: "money" },
        { k: "contado", l: "Contado", t: "money" },
        { k: "diferenca", l: "Diferença", t: "money" },
      ],
      linhas,
      total: { operador: "Total", vendido: soma(linhas, (l) => l.vendido), dinheiro: soma(linhas, (l) => l.dinheiro), sangrias: soma(linhas, (l) => l.sangrias), esperado: soma(linhas, (l) => l.esperado), contado: soma(linhas, (l) => l.contado), diferenca: dif },
    };
  },

  "taxa-embarque"(f) {
    const pas = passagensVendidas(f).filter((x) => x.taxaEmbarque > 0);
    const linhas = [...agrupar(pas, (x) => linha(viagem(x.viagemId)!.linhaId).paradas[x.origemOrdem].portoId).entries()]
      .map(([id, x]) => {
        const p = porto(id);
        return { porto: p.nome, cidade: `${cidade(p.cidadeId).nome}/${cidade(p.cidadeId).uf}`, passageiros: x.length, taxa: p.taxaEmbarque, total: soma(x, (y) => y.taxaEmbarque) };
      })
      .sort((a, b) => b.total - a.total);
    return {
      filtros: ["linha", "embarcacao"],
      destaques: [
        { l: "Total a repassar", v: money(soma(linhas, (l) => l.total)), hint: `${pas.length} embarques com taxa` },
        ...linhas.slice(0, 3).map((l) => ({ l: l.porto, v: money(l.total), hint: `${l.passageiros} × ${money(l.taxa)}` })),
      ],
      colunas: [
        { k: "porto", l: "Porto" },
        { k: "cidade", l: "Cidade" },
        { k: "passageiros", l: "Embarques", t: "int" },
        { k: "taxa", l: "Taxa atual", t: "money" },
        { k: "total", l: "Arrecadado", t: "money" },
      ],
      linhas,
      total: { porto: "Total", passageiros: pas.length, total: soma(linhas, (l) => l.total) },
      nota: "O arrecadado usa a taxa cobrada em cada venda; a coluna “Taxa atual” mostra o valor vigente hoje.",
    };
  },

  "porcentagem-sistema"(f) {
    const pct = config().valores.taxaSistemaPct;
    const ps = vendas(f);
    const linhas = [...agrupar(ps, (p) => p.canal).entries()].map(([canal, x]) => {
      const passagens = soma(x, (p) => p.subtotal);
      return { canal: label(canal), pedidos: x.length, passagens, pct, devido: Math.round(passagens * pct) / 100 };
    });
    return {
      filtros: ["linha", "embarcacao"],
      destaques: [
        { l: "Porcentagem do sistema", v: `${pct}%`, hint: "Configurações → Valores" },
        { l: "Base (valor das passagens)", v: money(soma(linhas, (l) => l.passagens)), hint: "Sem taxas de embarque" },
        { l: "Valor do sistema", v: money(soma(linhas, (l) => l.devido)) },
      ],
      colunas: [
        { k: "canal", l: "Canal" },
        { k: "pedidos", l: "Pedidos", t: "int" },
        { k: "passagens", l: "Valor das passagens", t: "money" },
        { k: "pct", l: "Percentual", t: "pct" },
        { k: "devido", l: "Valor do sistema", t: "money" },
      ],
      linhas,
      total: { canal: "Total", pedidos: ps.length, passagens: soma(linhas, (l) => l.passagens), devido: soma(linhas, (l) => l.devido) },
    };
  },

  "por-cidade"(f) {
    const pas = passagensVendidas(f);
    const cid = (x: Passagem, ordem: number) => paradaInfo(viagem(x.viagemId)!.linhaId, ordem).cidade.id;
    const orig = agrupar(pas, (x) => cid(x, x.origemOrdem));
    const dest = agrupar(pas, (x) => cid(x, x.destinoOrdem));
    const linhas = db()
      .cidades.map((c) => {
        const o = orig.get(c.id) ?? [];
        const d = dest.get(c.id) ?? [];
        return { cidade: `${c.nome}/${c.uf}`, embarques: o.length, receitaOrigem: soma(o, (x) => x.valor), desembarques: d.length, receitaDestino: soma(d, (x) => x.valor) };
      })
      .filter((l) => l.embarques || l.desembarques)
      .sort((a, b) => b.embarques + b.desembarques - (a.embarques + a.desembarques));
    return {
      filtros: ["linha", "embarcacao", "usuario"],
      destaques: linhas.slice(0, 4).map((l) => ({ l: l.cidade, v: `${l.embarques + l.desembarques}`, hint: `${l.embarques} embarques · ${l.desembarques} desembarques` })),
      colunas: [
        { k: "cidade", l: "Cidade" },
        { k: "embarques", l: "Embarques", t: "int" },
        { k: "receitaOrigem", l: "Receita (embarque)", t: "money" },
        { k: "desembarques", l: "Desembarques", t: "int" },
        { k: "receitaDestino", l: "Receita (destino)", t: "money" },
      ],
      linhas,
      total: { cidade: "Total", embarques: pas.length, receitaOrigem: soma(pas, (x) => x.valor), desembarques: pas.length, receitaDestino: soma(pas, (x) => x.valor) },
    };
  },

  "por-horario"(f) {
    const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const vs = viagensDoPeriodo(f).filter((v) => v.status !== "CANCELADA");
    const g = agrupar(vs, (v) => `${new Date(new Date(v.partida).getTime() - 4 * 3600_000).getUTCDay()}|${time(v.partida)}`);
    const linhas = [...g.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => {
        const [dia, hora] = k.split("|");
        const pax = x.map((v) => passagensDaViagem(v.id).filter((p) => p.status !== "RESERVADA"));
        return {
          dia: DIAS[Number(dia)],
          hora,
          linhas: [...new Set(x.map((v) => linha(v.linhaId).nome))].join(", "),
          viagens: x.length,
          passageiros: Math.round(soma(pax, (p) => p.length) / x.length),
          lotacao: Math.round(soma(x, (v) => ocupacaoViagem(v).pct) / x.length),
          receita: Math.round(soma(pax, (p) => soma(p, (y) => y.valor)) / x.length),
        };
      });
    const vendasHora = agrupar(vendas(f), (p) => time(p.createdAt).slice(0, 2));
    return {
      filtros: ["linha", "embarcacao"],
      destaques: linhas
        .slice()
        .sort((a, b) => b.lotacao - a.lotacao)
        .slice(0, 3)
        .map((l) => ({ l: `${l.dia} ${l.hora}`, v: `${l.lotacao}%`, hint: `${l.passageiros} passageiros por viagem` })),
      colunas: [
        { k: "dia", l: "Dia" },
        { k: "hora", l: "Saída" },
        { k: "linhas", l: "Linha" },
        { k: "viagens", l: "Viagens", t: "int" },
        { k: "passageiros", l: "Passageiros/viagem", t: "int" },
        { k: "lotacao", l: "Lotação média", t: "pct" },
        { k: "receita", l: "Receita/viagem", t: "money" },
      ],
      linhas,
      grafico: {
        titulo: "Vendas por hora do dia (quando os clientes compram)",
        dados: Array.from({ length: 24 }, (_, h) => {
          const k = String(h).padStart(2, "0");
          return { label: `${k}h`, value: soma(vendasHora.get(k) ?? [], (p) => p.total) };
        }),
      },
    };
  },

  cancelamentos(f) {
    const pedidos = new Map(db().pedidos.map((p) => [p.id, p]));
    const cs = db()
      .cancelamentos.filter((c) => noPeriodo(c.createdAt, f) && (!f.usuarioId || c.usuarioId === f.usuarioId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const linhas = cs.map((c) => {
      const p = pedidos.get(c.pedidoId)!;
      return {
        _href: `/admin/pedidos/${p.codigo}`,
        data: `${dateShort(c.createdAt)} ${time(c.createdAt)}`,
        pedido: p.codigo,
        comprador: p.compradorNome,
        passagens: c.passagemIds.length,
        motivo: c.motivo,
        por: usuario(c.usuarioId)?.nome ?? "—",
        pago: c.valorPago,
        multa: c.multa,
        reembolso: c.reembolso,
      };
    });
    const motivos = [...agrupar(cs, (c) => c.motivo).entries()].sort((a, b) => b[1].length - a[1].length);
    return {
      filtros: ["usuario"],
      destaques: [
        { l: "Cancelamentos", v: String(cs.length), hint: `${soma(cs, (c) => c.passagemIds.length)} passagens` },
        { l: "Reembolsado", v: money(soma(cs, (c) => c.reembolso)) },
        { l: "Multas retidas", v: money(soma(cs, (c) => c.multa)) },
        { l: "Motivo mais comum", v: motivos[0]?.[0] ?? "—", hint: motivos[0] ? `${motivos[0][1].length} vez(es)` : undefined },
      ],
      colunas: [
        { k: "data", l: "Data" },
        { k: "pedido", l: "Pedido" },
        { k: "comprador", l: "Comprador" },
        { k: "passagens", l: "Passagens", t: "int" },
        { k: "motivo", l: "Motivo" },
        { k: "por", l: "Cancelado por" },
        { k: "pago", l: "Pago", t: "money" },
        { k: "multa", l: "Multa", t: "money" },
        { k: "reembolso", l: "Reembolso", t: "money" },
      ],
      linhas,
      total: { data: "Total", passagens: soma(cs, (c) => c.passagemIds.length), pago: soma(cs, (c) => c.valorPago), multa: soma(cs, (c) => c.multa), reembolso: soma(cs, (c) => c.reembolso) },
    };
  },

  encomendas(f) {
    const encs = db().encomendas.filter((e) => noPeriodo(e.createdAt, f) && (!f.linhaId || (e.viagemId && viagem(e.viagemId)?.linhaId === f.linhaId)));
    const linhas = [...agrupar(encs, (e) => e.destinoCidadeId).entries()]
      .map(([id, x]) => ({
        destino: cidade(id).nome,
        encomendas: x.length,
        volumes: soma(x, (e) => e.volumes),
        peso: soma(x, (e) => e.pesoKg),
        frete: soma(x, (e) => e.frete),
        pago: soma(x.filter((e) => e.fretePago), (e) => e.frete),
        receber: soma(x.filter((e) => !e.fretePago), (e) => e.frete),
        entregues: x.filter((e) => e.status === "ENTREGUE").length,
      }))
      .sort((a, b) => b.frete - a.frete);
    return {
      filtros: ["linha"],
      destaques: [
        { l: "Encomendas recebidas", v: String(encs.length), hint: `${soma(encs, (e) => e.volumes)} volumes` },
        { l: "Peso transportado", v: `${soma(encs, (e) => e.pesoKg).toLocaleString("pt-BR")} kg` },
        { l: "Frete total", v: money(soma(encs, (e) => e.frete)) },
        { l: "A receber na retirada", v: money(soma(encs.filter((e) => !e.fretePago), (e) => e.frete)) },
      ],
      colunas: [
        { k: "destino", l: "Destino" },
        { k: "encomendas", l: "Encomendas", t: "int" },
        { k: "volumes", l: "Volumes", t: "int" },
        { k: "peso", l: "Peso", t: "kg" },
        { k: "frete", l: "Frete", t: "money" },
        { k: "pago", l: "Pago", t: "money" },
        { k: "receber", l: "A receber", t: "money" },
        { k: "entregues", l: "Entregues", t: "int" },
      ],
      linhas,
      total: { destino: "Total", encomendas: encs.length, volumes: soma(linhas, (l) => l.volumes), peso: soma(linhas, (l) => l.peso), frete: soma(linhas, (l) => l.frete), pago: soma(linhas, (l) => l.pago), receber: soma(linhas, (l) => l.receber), entregues: soma(linhas, (l) => l.entregues) },
    };
  },
};

export function gerarRelatorio(slug: string, f: Filtros): Relatorio | undefined {
  const meta = RELATORIOS.find((r) => r.slug === slug);
  if (!meta) return undefined;
  return { titulo: meta.titulo, descricao: meta.descricao, ...GERADORES[meta.slug](f) };
}

/** CSV no padrão do Excel brasileiro: separador ";", decimal com vírgula e BOM UTF-8 */
export function paraCsv(r: Relatorio) {
  const cel = (v: string | number | undefined, t?: TipoColuna) => {
    if (v === undefined) return "";
    const s = typeof v === "number" ? (t === "money" ? v.toFixed(2) : String(v)).replace(".", ",") : v;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = [r.colunas.map((c) => cel(c.l)).join(";"), ...[...r.linhas, ...(r.total ? [r.total] : [])].map((l) => r.colunas.map((c) => cel(l[c.k], c.t)).join(";"))];
  return "﻿" + linhas.join("\r\n");
}

