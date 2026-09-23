import { addDays, addMinutes, localDayKey, manausDate } from "./format";
import type {
  Agencia,
  Assento,
  CanalVenda,
  Cidade,
  Embarcacao,
  Encomenda,
  Linha,
  MetodoPagamento,
  Passagem,
  Pedido,
  Porto,
  StatusEncomenda,
  StatusViagem,
  TipoPassageiro,
  Usuario,
  Viagem,
} from "./types";

export type Db = {
  cidades: Cidade[];
  portos: Porto[];
  embarcacoes: Embarcacao[];
  linhas: Linha[];
  viagens: Viagem[];
  pedidos: Pedido[];
  passagens: Passagem[];
  encomendas: Encomenda[];
  usuarios: Usuario[];
  agencias: Agencia[];
};

// PRNG determinístico: os dados de exemplo ficam iguais a cada reinício
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeCode(r: () => number, prefix: string, len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(r() * CODE_CHARS.length)];
  return `${prefix}-${s}`;
}

const NOMES = ["Maria", "José", "Ana", "Francisco", "Antônia", "João", "Raimunda", "Carlos", "Francisca", "Paulo", "Luana", "Pedro", "Juliana", "Marcos", "Adriana", "Lucas", "Rosângela", "Rafael", "Sandra", "Tiago", "Keila", "Wesley", "Jéssica", "Edson", "Camila", "Railson", "Beatriz", "Gabriel", "Neide", "Mateus"];
const SOBRENOMES = ["Silva", "Souza", "Oliveira", "Lima", "Pereira", "Costa", "Ferreira", "Rodrigues", "Almeida", "Nascimento", "Batista", "Cardoso", "Tavares", "Andrade", "Barbosa", "Pinto", "Moraes", "Brito", "Castro", "Farias"];
const ITENS = ["Caixa de açaí congelado", "Peças de motor de popa", "Medicamentos", "Caixa de roupas", "Eletrônicos (TV 43\")", "Documentos", "Farinha de mandioca (2 sacas)", "Material escolar", "Peixe congelado (isopor)", "Ventilador", "Bicicleta", "Botijão vazio"];

export function seed(now = new Date()): Db {
  const r = rng(20260923);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const nome = () => {
    const a = pick(SOBRENOMES);
    const b = pick(SOBRENOMES.filter((x) => x !== a));
    return `${pick(NOMES)} ${a}${r() > 0.5 ? " " + b : ""}`;
  };
  const cpf = () => Array.from({ length: 11 }, () => Math.floor(r() * 10)).join("");
  const tel = () => `92 9${Math.floor(1000 + r() * 8999)}-${Math.floor(1000 + r() * 8999)}`;

  const cidades: Cidade[] = [
    { id: "manaus", nome: "Manaus", uf: "AM", sigla: "MAO" },
    { id: "itacoatiara", nome: "Itacoatiara", uf: "AM", sigla: "ITA" },
    { id: "parintins", nome: "Parintins", uf: "AM", sigla: "PIN" },
    { id: "juruti", nome: "Juruti", uf: "PA", sigla: "JRT" },
    { id: "obidos", nome: "Óbidos", uf: "PA", sigla: "OBI" },
    { id: "santarem", nome: "Santarém", uf: "PA", sigla: "STM" },
  ];

  const portos: Porto[] = [
    { id: "p-manaus", cidadeId: "manaus", nome: "Balsa Amarela", endereco: "Av. Lourenço da Silva Braga, Centro", taxaEmbarque: 5 },
    { id: "p-itacoatiara", cidadeId: "itacoatiara", nome: "Porto Velho", endereco: "Orla de Itacoatiara", taxaEmbarque: 0 },
    { id: "p-parintins", cidadeId: "parintins", nome: "Porto Municipal", endereco: "Av. Amazonas, Centro", taxaEmbarque: 3 },
    { id: "p-juruti", cidadeId: "juruti", nome: "Porto de Juruti", endereco: "Orla de Juruti", taxaEmbarque: 0 },
    { id: "p-obidos", cidadeId: "obidos", nome: "Cais de Óbidos", endereco: "Orla de Óbidos", taxaEmbarque: 0 },
    { id: "p-santarem", cidadeId: "santarem", nome: "Hidroviário Tapajós", endereco: "Av. Tapajós, Centro", taxaEmbarque: 5 },
  ];

  // 32 fileiras × 4 poltronas (A B | corredor | C D) = 128 lugares
  const assentos: Assento[] = [];
  for (let f = 1; f <= 32; f++) {
    [["A", 0], ["B", 1], ["C", 3], ["D", 4]].forEach(([l, c]) => {
      const col = c as number;
      assentos.push({
        id: `st1-${f}${l}`,
        codigo: `${f}${l}`,
        fileira: f,
        coluna: col,
        tipo: f === 1 ? "ESPECIAL" : col === 0 || col === 4 ? "POLTRONA_JANELA" : "POLTRONA",
      });
    });
  }
  const embarcacoes: Embarcacao[] = [
    {
      id: "sao-tome-expresso",
      nome: "São Tomé Expresso",
      tipo: "LANCHA",
      inscricaoCapitania: "021-045871-9",
      capacidadePassageiros: 128,
      capacidadeCargaKg: 3000,
      status: "ATIVA",
      colunasMapa: 5,
      assentos,
    },
  ];

  // Preços a partir de Manaus (valores das telas atuais) — demais trechos pela diferença
  const ordemRio = ["manaus", "itacoatiara", "parintins", "juruti", "obidos", "santarem"];
  const acumulado = [0, 150, 372.6, 428.5, 480, 520];
  const preco = (a: string, b: string) =>
    Math.max(80, Math.round(Math.abs(acumulado[ordemRio.indexOf(b)] - acumulado[ordemRio.indexOf(a)]) * 100) / 100);

  function montaLinha(id: string, nomeLinha: string, cidadesOrdem: string[], minutos: number[], horarios: Linha["horarios"]): Linha {
    const paradas = cidadesOrdem.map((c, i) => ({ ordem: i, portoId: `p-${c}`, minutosDesdeOrigem: minutos[i] }));
    const tarifas: Linha["tarifas"] = {};
    for (let i = 0; i < paradas.length; i++) {
      tarifas[i] = {};
      for (let j = i + 1; j < paradas.length; j++) tarifas[i][j] = preco(cidadesOrdem[i], cidadesOrdem[j]);
    }
    return { id, nome: nomeLinha, ativa: true, paradas, tarifas, horarios };
  }

  const linhas: Linha[] = [
    montaLinha("manaus-santarem", "Manaus → Santarém", ordemRio, [0, 240, 520, 700, 880, 1020], [
      { diaSemana: 1, horaSaida: "03:00", embarcacaoId: "sao-tome-expresso" },
      { diaSemana: 5, horaSaida: "03:00", embarcacaoId: "sao-tome-expresso" },
    ]),
    montaLinha("santarem-manaus", "Santarém → Manaus", [...ordemRio].reverse(), [0, 210, 390, 600, 1020, 1320], [
      { diaSemana: 3, horaSaida: "06:00", embarcacaoId: "sao-tome-expresso" },
      { diaSemana: 6, horaSaida: "06:00", embarcacaoId: "sao-tome-expresso" },
    ]),
  ];

  // Viagens: -35 a +45 dias a partir da programação semanal
  const viagens: Viagem[] = [];
  const [ty, tm, td] = localDayKey(now).split("-").map(Number);
  for (let d = -35; d <= 45; d++) {
    const dia = manausDate(ty, tm - 1, td + d);
    const dow = new Date(dia.getTime() - 4 * 3600_000).getUTCDay();
    for (const l of linhas) {
      for (const h of l.horarios.filter((x) => x.diaSemana === dow)) {
        const [hh, mm] = h.horaSaida.split(":").map(Number);
        const partida = manausDate(ty, tm - 1, td + d, hh, mm);
        const chegada = addMinutes(partida, l.paradas.at(-1)!.minutosDesdeOrigem);
        let status: StatusViagem = "PROGRAMADA";
        if (chegada < now) status = "CONCLUIDA";
        else if (partida <= now) status = "EM_CURSO";
        else if (partida.getTime() - now.getTime() < 3 * 3600_000) status = "EMBARQUE";
        viagens.push({
          id: `${l.id === "manaus-santarem" ? "MS" : "SM"}-${localDayKey(partida).replaceAll("-", "")}`,
          linhaId: l.id,
          embarcacaoId: h.embarcacaoId,
          partida: partida.toISOString(),
          status,
          comandante: "Cmte. Raimundo Brito",
          vendasAbertas: true,
        });
      }
    }
  }
  viagens.sort((a, b) => a.partida.localeCompare(b.partida));

  const agencias: Agencia[] = [
    { id: "ag-parintins", nome: "Parintins Tur", cidadeId: "parintins", comissaoPercentual: 8, ativa: true },
    { id: "ag-juruti", nome: "Juruti Viagens", cidadeId: "juruti", comissaoPercentual: 10, ativa: true },
  ];

  const usuarios: Usuario[] = [
    { id: "u-admin", nome: "Administrador", email: "admin@saotome.com.br", papel: "ADMIN", ativo: true, linhasPermitidas: [], ultimoAcesso: now.toISOString() },
    { id: "u-gerente", nome: "Cláudia Tavares", email: "claudia@saotome.com.br", papel: "GERENTE", ativo: true, linhasPermitidas: [], ultimoAcesso: addDays(now, -1).toISOString() },
    { id: "u-balcao-mao", nome: "Edson Lima", email: "edson@saotome.com.br", papel: "VENDEDOR", ativo: true, linhasPermitidas: [], ultimoAcesso: addMinutes(now, -40).toISOString() },
    { id: "u-balcao-stm", nome: "Keila Farias", email: "keila@saotome.com.br", papel: "VENDEDOR", ativo: true, linhasPermitidas: ["santarem-manaus"], ultimoAcesso: addDays(now, -2).toISOString() },
    { id: "u-agencia-pin", nome: "Railson Batista", email: "railson@parintinstur.com", papel: "VENDEDOR", agenciaId: "ag-parintins", ativo: true, linhasPermitidas: [], ultimoAcesso: addDays(now, -1).toISOString() },
    { id: "u-conferente", nome: "Wesley Brito", email: "wesley@saotome.com.br", papel: "CONFERENTE", ativo: true, linhasPermitidas: [], ultimoAcesso: addDays(now, -3).toISOString() },
  ];

  // Vendas simuladas
  const pedidos: Pedido[] = [];
  const passagens: Passagem[] = [];
  const horizonte = addDays(now, 14);
  let pid = 0;

  for (const v of viagens) {
    const partida = new Date(v.partida);
    if (partida > horizonte) continue;
    const linha = linhas.find((l) => l.id === v.linhaId)!;
    const nSeg = linha.paradas.length - 1;
    const ocupado = new Map<string, boolean[]>();
    const diasAte = (partida.getTime() - now.getTime()) / 86_400_000;
    const alvo = diasAte < 0 ? 0.45 + r() * 0.35 : Math.max(0.05, 0.6 - diasAte * 0.045) * (0.8 + r() * 0.3);
    let tentativas = Math.round(assentos.length * alvo * 0.75);

    while (tentativas-- > 0) {
      // Maioria embarca na origem da linha; alguns em paradas intermediárias
      const o = r() < 0.65 ? 0 : Math.floor(r() * (nSeg - 1)) + 1;
      const dst = r() < 0.5 ? nSeg : o + 1 + Math.floor(r() * (nSeg - o));
      const qtd = r() < 0.6 ? 1 : r() < 0.7 ? 2 : 3;
      const livres = assentos.filter((a) => {
        const occ = ocupado.get(a.id);
        return !occ || occ.slice(o, dst).every((x) => !x);
      });
      if (livres.length < qtd) continue;
      const start = Math.floor(r() * (livres.length - qtd + 1));
      const escolhidos = livres.slice(start, start + qtd);

      // vendas espalhadas nos 10 dias antes da partida (ou antes de agora, se a viagem é futura)
      const criado = new Date(Math.min(now.getTime() - 60_000, partida.getTime() - 3600_000) - r() * 240 * 3600_000);
      const canalR = r();
      const canal: CanalVenda = canalR < 0.45 ? "SITE" : canalR < 0.85 ? "BALCAO" : canalR < 0.95 ? "AGENCIA" : "WHATSAPP";
      const metodo: MetodoPagamento =
        canal === "SITE" ? (r() < 0.7 ? "PIX" : "CARTAO_CREDITO") : pick(["PIX", "PIX", "DINHEIRO", "CARTAO_DEBITO", "CARTAO_CREDITO"]);
      const pendente = canal === "SITE" && diasAte > 0 && r() < 0.06;
      const comprador = nome();
      const pedidoId = `ped-${++pid}`;
      const origemPorto = portos.find((p) => p.id === linha.paradas[o].portoId)!;
      let subtotal = 0;
      let taxas = 0;

      escolhidos.forEach((a, i) => {
        const occ = ocupado.get(a.id) ?? Array(nSeg).fill(false);
        for (let s = o; s < dst; s++) occ[s] = true;
        ocupado.set(a.id, occ);
        const tipo: TipoPassageiro = i > 0 && r() < 0.25 ? "CRIANCA" : r() < 0.05 ? "IDOSO" : "INTEIRA";
        const cheio = linha.tarifas[o][dst];
        const valor = tipo === "CRIANCA" ? cheio / 2 : tipo === "IDOSO" ? cheio * 0.5 : cheio;
        subtotal += valor;
        taxas += origemPorto.taxaEmbarque;
        passagens.push({
          id: `pas-${passagens.length + 1}`,
          pedidoId,
          viagemId: v.id,
          assentoId: a.id,
          origemOrdem: o,
          destinoOrdem: dst,
          nome: i === 0 ? comprador : nome(),
          documento: cpf(),
          tipo,
          valor,
          taxaEmbarque: origemPorto.taxaEmbarque,
          status: pendente
            ? "RESERVADA"
            : v.status === "CONCLUIDA" || v.status === "EM_CURSO"
              ? r() < 0.96 ? "EMBARCADA" : "NAO_COMPARECEU"
              : "EMITIDA",
          qrToken: makeCode(r, "QR", 12),
          embarcadoEm: v.status === "CONCLUIDA" || v.status === "EM_CURSO" ? v.partida : undefined,
        });
      });

      const agencia = canal === "AGENCIA" ? pick(agencias) : undefined;
      const total = subtotal + taxas;
      pedidos.push({
        id: pedidoId,
        codigo: makeCode(r, "ST"),
        numero: "", // atribuído em ordem cronológica no fim do seed
        canal,
        status: pendente ? "AGUARDANDO_PAGAMENTO" : "PAGO",
        compradorNome: comprador,
        compradorEmail: canal === "SITE" ? `${comprador.split(" ")[0].toLowerCase()}@email.com` : undefined,
        compradorTelefone: tel(),
        vendedorId: canal === "BALCAO" ? (linha.id === "santarem-manaus" ? "u-balcao-stm" : "u-balcao-mao") : agencia ? "u-agencia-pin" : undefined,
        agenciaId: agencia?.id,
        subtotal,
        taxas,
        desconto: 0,
        total,
        comissaoAgencia: agencia ? Math.round(subtotal * agencia.comissaoPercentual) / 100 : 0,
        expiraEm: pendente ? addMinutes(now, 20).toISOString() : undefined,
        createdAt: criado.toISOString(),
        pagamentos: [
          {
            id: `pg-${pid}`,
            metodo,
            status: pendente ? "PENDENTE" : "APROVADO",
            valor: total,
            pagoEm: pendente ? undefined : criado.toISOString(),
          },
        ],
      });
    }
  }

  // Número sequencial por ano, como no bilhete impresso (MAO-2026-0001)
  const seqAno = new Map<string, number>();
  for (const p of [...pedidos].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const ano = p.createdAt.slice(0, 4);
    const n = (seqAno.get(ano) ?? 0) + 1;
    seqAno.set(ano, n);
    const pas = passagens.find((x) => x.pedidoId === p.id)!;
    const l = linhas.find((x) => x.id === viagens.find((v) => v.id === pas.viagemId)!.linhaId)!;
    const cid = portos.find((x) => x.id === l.paradas[pas.origemOrdem].portoId)!.cidadeId;
    p.numero = `${cidades.find((c) => c.id === cid)!.sigla}-${ano}-${String(n).padStart(4, "0")}`;
  }

  // Encomendas
  const encomendas: Encomenda[] = [];
  const recentes = viagens.filter((v) => Math.abs(new Date(v.partida).getTime() - now.getTime()) < 20 * 86_400_000);
  for (let i = 0; i < 46; i++) {
    const v = pick(recentes);
    const linha = linhas.find((l) => l.id === v.linhaId)!;
    const o = r() < 0.7 ? 0 : 1 + Math.floor(r() * 3);
    const dst = o + 1 + Math.floor(r() * (linha.paradas.length - 1 - o));
    const origemCid = portos.find((p) => p.id === linha.paradas[o].portoId)!.cidadeId;
    const destCid = portos.find((p) => p.id === linha.paradas[dst].portoId)!.cidadeId;
    const partida = new Date(v.partida);
    const chegada = addMinutes(partida, linha.paradas[dst].minutosDesdeOrigem);
    const recebida = addMinutes(partida, -(120 + r() * 2000));
    const peso = Math.round((0.5 + r() * 38) * 10) / 10;

    const eventos: Encomenda["eventos"] = [
      { status: "RECEBIDA", descricao: `Recebida no porto de ${cidades.find((c) => c.id === origemCid)!.nome}`, createdAt: recebida.toISOString() },
    ];
    let status: StatusEncomenda = "RECEBIDA";
    if (partida < now) {
      eventos.push({ status: "EMBARCADA", descricao: `Embarcada na ${embarcacoes[0].nome}`, createdAt: addMinutes(partida, -40).toISOString() });
      eventos.push({ status: "EM_TRANSITO", descricao: "Em viagem", createdAt: partida.toISOString() });
      status = "EM_TRANSITO";
    }
    if (chegada < now) {
      eventos.push({ status: "DISPONIVEL_RETIRADA", descricao: `Disponível para retirada em ${cidades.find((c) => c.id === destCid)!.nome}`, createdAt: addMinutes(chegada, 30).toISOString() });
      status = "DISPONIVEL_RETIRADA";
      if (r() < 0.75 && addDays(chegada, 1) < now) {
        eventos.push({ status: "ENTREGUE", descricao: "Retirada pelo destinatário", createdAt: addDays(chegada, 1).toISOString() });
        status = "ENTREGUE";
      }
    }
    const pagador = r() < 0.7 ? "REMETENTE" : "DESTINATARIO";
    encomendas.push({
      id: `enc-${i + 1}`,
      codigo: `EN-${String(48210 + i * 7)}`,
      viagemId: v.id,
      origemCidadeId: origemCid,
      destinoCidadeId: destCid,
      remetenteNome: nome(),
      remetenteDoc: cpf(),
      remetenteTel: tel(),
      destinatarioNome: nome(),
      destinatarioTel: tel(),
      descricao: pick(ITENS),
      volumes: 1 + Math.floor(r() * 3),
      pesoKg: peso,
      valorDeclarado: r() < 0.5 ? Math.round(100 + r() * 3000) : undefined,
      frete: Math.max(25, Math.round(peso * (2.5 + dst - o) * 100) / 100),
      pagador,
      fretePago: pagador === "REMETENTE" || status === "ENTREGUE",
      status,
      createdAt: recebida.toISOString(),
      eventos,
    });
  }
  encomendas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { cidades, portos, embarcacoes, linhas, viagens, pedidos, passagens, encomendas, usuarios, agencias };
}
