import { addDays, addMinutes, localDayKey, manausDate } from "./format";
import type {
  Agencia,
  Assento,
  CaixaSessao,
  Cancelamento,
  CanalVenda,
  Cidade,
  Comodo,
  Configuracao,
  Convenio,
  Embarcacao,
  Encomenda,
  Festival,
  Linha,
  MetodoPagamento,
  Passagem,
  Pedido,
  Porto,
  StatusEncomenda,
  StatusViagem,
  TipoPassageiro,
  Tripulante,
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
  comodos: Comodo[];
  tripulantes: Tripulante[];
  convenios: Convenio[];
  caixas: CaixaSessao[];
  cancelamentos: Cancelamento[];
  festivais: Festival[];
  config: Configuracao;
};

export const CONFIG_PADRAO: Configuracao = {
  empresa: {
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
  },
  valores: {
    descontos: { INTEIRA: 0, CRIANCA: 0.5, COLO: 1, IDOSO: 0.5, ESTUDANTE: 0.5, PCD: 1 },
    multaCancelamentoPct: 10,
    horasCancelamentoSemMulta: 24,
    taxaSistemaPct: 3,
  },
  bilhete: {
    larguraMm: 80,
    titulo: "CARTÃO DE EMBARQUE",
    mostrarLogo: true,
    mostrarValores: true,
    mostrarQr: true,
    mostrarBeneficios: true,
    localEmbarque: "HIDROVIÁRIO",
    antecedenciaEmbarqueMin: 60,
    mensagens: [
      "Para o embarque, apresente este bilhete impresso ou digital.",
      "Chegue com pelo menos 1 hora de antecedência ao local de embarque.",
    ],
  },
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
    { id: "maues", nome: "Maués", uf: "AM", sigla: "MBZ" },
  ];

  const portos: Porto[] = [
    { id: "p-manaus", cidadeId: "manaus", nome: "Balsa Amarela", endereco: "Av. Lourenço da Silva Braga, Centro", taxaEmbarque: 5, ativo: true },
    { id: "p-itacoatiara", cidadeId: "itacoatiara", nome: "Porto Velho", endereco: "Orla de Itacoatiara", taxaEmbarque: 0, ativo: true },
    { id: "p-parintins", cidadeId: "parintins", nome: "Porto Municipal", endereco: "Av. Amazonas, Centro", taxaEmbarque: 3, ativo: true },
    { id: "p-juruti", cidadeId: "juruti", nome: "Porto de Juruti", endereco: "Orla de Juruti", taxaEmbarque: 0, ativo: true },
    { id: "p-obidos", cidadeId: "obidos", nome: "Cais de Óbidos", endereco: "Orla de Óbidos", taxaEmbarque: 0, ativo: true },
    { id: "p-maues", cidadeId: "maues", nome: "Porto de Maués", endereco: "Orla de Maués", taxaEmbarque: 2, ativo: true },
    { id: "p-santarem", cidadeId: "santarem", nome: "Hidroviário Tapajós", endereco: "Av. Tapajós, Centro", taxaEmbarque: 5, ativo: true },
  ];

  // Cômodos (acomodações) de cada embarcação — o acréscimo soma na tarifa do trecho
  const comodos: Comodo[] = [
    { id: "cm-st1-preferencial", embarcacaoId: "sao-tome-expresso", nome: "Preferencial", descricao: "1ª fileira, reservada a idosos, gestantes e PCD", acrescimo: 0, cor: "rio", ativo: true },
    { id: "cm-st1-executiva", embarcacaoId: "sao-tome-expresso", nome: "Executiva", descricao: "Fileiras 2 a 5: mais espaço entre poltronas e tomada USB", acrescimo: 40, cor: "sol", ativo: true },
    { id: "cm-st1-convencional", embarcacaoId: "sao-tome-expresso", nome: "Convencional", descricao: "Poltrona reclinável, ambiente climatizado", acrescimo: 0, cor: "slate", ativo: true },
    { id: "cm-st2-convencional", embarcacaoId: "sao-tome-ii", nome: "Convencional", descricao: "Poltrona reclinável", acrescimo: 0, cor: "slate", ativo: true },
    { id: "cm-st2-camarote", embarcacaoId: "sao-tome-ii", nome: "Camarote", descricao: "Cabine com 2 leitos e ar-condicionado", acrescimo: 180, cor: "rubro", ativo: true },
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
        comodoId: f === 1 ? "cm-st1-preferencial" : f <= 5 ? "cm-st1-executiva" : "cm-st1-convencional",
      });
    });
  }
  // Segunda lancha (em manutenção): 20 fileiras de poltronas + 4 camarotes na proa
  const assentos2: Assento[] = [];
  for (let f = 1; f <= 22; f++) {
    const cols: [string, number][] = f > 20 ? [["A", 0], ["D", 4]] : [["A", 0], ["B", 1], ["C", 3], ["D", 4]];
    for (const [l, col] of cols) {
      const camarote = f > 20;
      assentos2.push({
        id: `st2-${f}${l}`,
        codigo: camarote ? `CAM${(f - 21) * 2 + (col === 0 ? 1 : 2)}` : `${f}${l}`,
        fileira: f,
        coluna: col,
        tipo: col === 0 || col === 4 ? "POLTRONA_JANELA" : "POLTRONA",
        comodoId: camarote ? "cm-st2-camarote" : "cm-st2-convencional",
      });
    }
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
      ano: 2019,
      comprimentoM: 32,
    },
    {
      id: "sao-tome-ii",
      nome: "São Tomé II",
      tipo: "LANCHA",
      inscricaoCapitania: "021-051230-4",
      capacidadePassageiros: assentos2.length,
      capacidadeCargaKg: 2000,
      status: "MANUTENCAO",
      colunasMapa: 5,
      assentos: assentos2,
      ano: 2015,
      comprimentoM: 26,
      observacao: "Revisão dos motores prevista para o fim do mês",
    },
    {
      id: "expresso-maues",
      nome: "Expresso Maués",
      tipo: "LANCHA",
      inscricaoCapitania: "021-060412-7",
      capacidadePassageiros: 60,
      capacidadeCargaKg: 800,
      status: "ATIVA",
      colunasMapa: 5,
      assentos: [],
      assentoLivre: true,
      ano: 2021,
      comprimentoM: 18,
      observacao: "Assento livre: embarque por ordem de chegada",
    },
  ];

  const tripulantes: Tripulante[] = [
    { id: "tr-raimundo", nome: "Raimundo Brito", funcao: "COMANDANTE", documento: "512.334.872-10", habilitacao: "CIR 021M2009001234", validadeHabilitacao: "2027-08-15", telefone: "(92) 99111-2233", embarcacaoId: "sao-tome-expresso", ativo: true },
    { id: "tr-jose", nome: "José Tavares", funcao: "COMANDANTE", documento: "421.998.332-04", habilitacao: "CIR 021M2012004411", validadeHabilitacao: "2026-10-30", telefone: "(92) 99222-4455", ativo: true },
    { id: "tr-marcos", nome: "Marcos Andrade", funcao: "IMEDIATO", documento: "733.120.552-91", habilitacao: "CIR 021M2014007788", validadeHabilitacao: "2028-02-01", telefone: "(92) 99333-1010", embarcacaoId: "sao-tome-expresso", ativo: true },
    { id: "tr-edivaldo", nome: "Edivaldo Pinto", funcao: "MAQUINISTA", documento: "812.456.991-20", habilitacao: "CIR 021M2011003321", validadeHabilitacao: "2027-01-20", telefone: "(92) 99444-7788", embarcacaoId: "sao-tome-expresso", ativo: true },
    { id: "tr-luan", nome: "Luan Castro", funcao: "MARINHEIRO", documento: "021.556.782-33", habilitacao: "CIR 021M2019009876", validadeHabilitacao: "2029-05-12", telefone: "(92) 99555-3344", embarcacaoId: "sao-tome-expresso", ativo: true },
    { id: "tr-diego", nome: "Diego Moraes", funcao: "MARINHEIRO", documento: "334.887.120-55", habilitacao: "CIR 021M2020001122", validadeHabilitacao: "2026-09-30", telefone: "(92) 99666-9900", embarcacaoId: "sao-tome-expresso", ativo: true },
    { id: "tr-socorro", nome: "Socorro Farias", funcao: "TAIFEIRO", documento: "445.221.009-81", habilitacao: "CIR 021M2016005566", validadeHabilitacao: "2027-11-02", telefone: "(92) 99777-1212", embarcacaoId: "sao-tome-expresso", ativo: true },
    { id: "tr-leticia", nome: "Letícia Barbosa", funcao: "COMISSARIO", documento: "556.009.334-12", habilitacao: "—", telefone: "(92) 99888-3434", ativo: true },
  ];
  const TRIPULACAO_PADRAO = ["tr-raimundo", "tr-marcos", "tr-edivaldo", "tr-luan", "tr-diego", "tr-socorro"];

  const convenios: Convenio[] = [
    { id: "cv-pref-parintins", nome: "Prefeitura de Parintins (TFD)", cnpj: "04.329.736/0001-69", descontoPercentual: 100, faturado: true, contato: "Secretaria de Saúde · (92) 3533-2020", ativo: true },
    { id: "cv-seduc", nome: "SEDUC-AM · Professores da rede estadual", descontoPercentual: 20, faturado: false, contato: "seduc.am.gov.br", ativo: true },
    { id: "cv-mineradora", nome: "Mineração Juruti (colaboradores)", cnpj: "05.001.221/0001-40", descontoPercentual: 15, faturado: true, contato: "RH · (93) 3536-1000", ativo: true },
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
    // Linha curta com lancha de assento livre
    {
      id: "manaus-maues",
      nome: "Manaus → Maués",
      ativa: true,
      paradas: [{ ordem: 0, portoId: "p-manaus", minutosDesdeOrigem: 0 }, { ordem: 1, portoId: "p-maues", minutosDesdeOrigem: 480 }],
      tarifas: { 0: { 1: 150 }, 1: {} },
      horarios: [{ diaSemana: 2, horaSaida: "07:00", embarcacaoId: "expresso-maues" }, { diaSemana: 4, horaSaida: "07:00", embarcacaoId: "expresso-maues" }],
    },
    {
      id: "maues-manaus",
      nome: "Maués → Manaus",
      ativa: true,
      paradas: [{ ordem: 0, portoId: "p-maues", minutosDesdeOrigem: 0 }, { ordem: 1, portoId: "p-manaus", minutosDesdeOrigem: 480 }],
      tarifas: { 0: { 1: 150 }, 1: {} },
      horarios: [{ diaSemana: 3, horaSaida: "07:00", embarcacaoId: "expresso-maues" }, { diaSemana: 5, horaSaida: "07:00", embarcacaoId: "expresso-maues" }],
    },
  ];
  const PREFIXO: Record<string, string> = { "manaus-santarem": "MS", "santarem-manaus": "SM", "manaus-maues": "MM", "maues-manaus": "MA" };

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
          id: `${PREFIXO[l.id]}-${localDayKey(partida).replaceAll("-", "")}`,
          linhaId: l.id,
          embarcacaoId: h.embarcacaoId,
          partida: partida.toISOString(),
          status,
          comandante: "Cmte. Raimundo Brito",
          vendasAbertas: true,
          tripulacao: h.embarcacaoId === "sao-tome-expresso" ? [...TRIPULACAO_PADRAO] : ["tr-jose", "tr-leticia"],
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
    const barco = embarcacoes.find((e) => e.id === v.embarcacaoId)!;
    // Assento livre: "lugares" virtuais só para controlar a lotação; a passagem sai sem poltrona
    const lugares: Assento[] = barco.assentoLivre
      ? Array.from({ length: barco.capacidadePassageiros }, (_, i) => ({ id: `livre-${i}`, codigo: "", fileira: 0, coluna: 0, tipo: "POLTRONA" as const }))
      : barco.assentos;
    const ocupado = new Map<string, boolean[]>();
    const diasAte = (partida.getTime() - now.getTime()) / 86_400_000;
    const alvo = diasAte < 0 ? 0.45 + r() * 0.35 : Math.max(0.05, 0.6 - diasAte * 0.045) * (0.8 + r() * 0.3);
    let tentativas = Math.round(lugares.length * alvo * 0.75);

    while (tentativas-- > 0) {
      // Maioria embarca na origem da linha; alguns em paradas intermediárias
      const o = nSeg === 1 || r() < 0.65 ? 0 : Math.floor(r() * (nSeg - 1)) + 1;
      const dst = r() < 0.5 ? nSeg : o + 1 + Math.floor(r() * (nSeg - o));
      const qtd = r() < 0.6 ? 1 : r() < 0.7 ? 2 : 3;
      const livres = lugares.filter((a) => {
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
      const convenio = canal === "BALCAO" && r() < 0.06 ? pick(convenios) : undefined;
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
        const acrescimo = comodos.find((c) => c.id === a.comodoId)?.acrescimo ?? 0;
        const desc = Math.max(CONFIG_PADRAO.valores.descontos[tipo], (convenio?.descontoPercentual ?? 0) / 100);
        const valor = Math.round((linha.tarifas[o][dst] + acrescimo) * (1 - desc) * 100) / 100;
        subtotal += valor;
        taxas += origemPorto.taxaEmbarque;
        passagens.push({
          id: `pas-${passagens.length + 1}`,
          pedidoId,
          viagemId: v.id,
          assentoId: barco.assentoLivre ? undefined : a.id,
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
          validadoPorId: v.status === "CONCLUIDA" || v.status === "EM_CURSO" ? "u-conferente" : undefined,
          acrescimo,
          impressoes: pendente ? 0 : canal === "SITE" ? (r() < 0.5 ? 1 : 0) : 1,
        });
      });

      const agencia = canal === "AGENCIA" ? pick(agencias) : undefined;
      const total = subtotal + taxas;
      if (convenio) {
        for (const pas of passagens.filter((x) => x.pedidoId === pedidoId)) pas.convenioId = convenio.id;
      }
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
            metodo: convenio?.faturado ? "FATURADO" : metodo,
            status: pendente || convenio?.faturado ? "PENDENTE" : "APROVADO",
            valor: total,
            pagoEm: pendente || convenio?.faturado ? undefined : criado.toISOString(),
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
  const recentes = viagens.filter((v) => v.embarcacaoId === "sao-tome-expresso" && Math.abs(new Date(v.partida).getTime() - now.getTime()) < 20 * 86_400_000);
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

  // Festivais: viagens extras (avulsas) ligadas a cada evento, vendidas com tarifa especial
  const extra = (linhaId: string, prefixo: string, y: number, m: number, d: number, h: number): Viagem => ({
    id: `${prefixo}-${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}-FEST`,
    linhaId,
    embarcacaoId: "sao-tome-expresso",
    partida: manausDate(y, m - 1, d, h).toISOString(),
    status: "PROGRAMADA",
    comandante: "Cmte. Raimundo Brito",
    vendasAbertas: true,
    tripulacao: [...TRIPULACAO_PADRAO],
    avulsa: true,
  });
  const ano = Number(localDayKey(now).slice(0, 4)) + 1;
  const viagensParintins = [extra("manaus-santarem", "MS", ano, 6, 24, 3), extra("manaus-santarem", "MS", ano, 6, 25, 3), extra("santarem-manaus", "SM", ano, 6, 29, 6), extra("santarem-manaus", "SM", ano, 6, 30, 6)];
  const viagensJuruti = [extra("manaus-santarem", "MS", ano, 7, 22, 3), extra("santarem-manaus", "SM", ano, 7, 27, 6)];
  viagens.push(...viagensParintins, ...viagensJuruti);
  viagens.sort((a, b) => a.partida.localeCompare(b.partida));
  const festivais: Festival[] = [
    {
      id: "fest-parintins",
      slug: `festival-de-parintins-${ano}`,
      nome: `Festival de Parintins ${ano}`,
      chamada: "Garantido × Caprichoso no Bumbódromo",
      descricao: "O maior festival folclórico da Amazônia. Saídas extras de Manaus e de Santarém para as três noites de apresentação dos bois, com volta logo após o festival.",
      cidadeId: "parintins",
      inicio: `${ano}-06-26`,
      fim: `${ano}-06-28`,
      acrescimoPercentual: 20,
      viagemIds: viagensParintins.map((v) => v.id),
      cor: "rubro",
      publicado: true,
    },
    {
      id: "fest-juruti",
      slug: `festribal-juruti-${ano}`,
      nome: `Festribal de Juruti ${ano}`,
      chamada: "Muirapinima × Munduruku",
      descricao: "Festival das tribos de Juruti, no oeste do Pará. Viagem extra saindo de Manaus e retorno depois da última noite.",
      cidadeId: "juruti",
      inicio: `${ano}-07-23`,
      fim: `${ano}-07-25`,
      acrescimoPercentual: 10,
      viagemIds: viagensJuruti.map((v) => v.id),
      cor: "emerald",
      publicado: true,
    },
  ];

  // Cancelamentos: ~2,5% dos pedidos pagos foram cancelados (reembolso com ou sem multa)
  const cancelamentos: Cancelamento[] = [];
  for (const p of pedidos) {
    if (p.status !== "PAGO" || p.canal === "AGENCIA" || p.pagamentos[0].metodo === "FATURADO" || r() > 0.025) continue;
    const pas = passagens.filter((x) => x.pedidoId === p.id);
    const v = viagens.find((x) => x.id === pas[0].viagemId)!;
    const quando = new Date(Math.min(now.getTime() - 3600_000, new Date(p.createdAt).getTime() + r() * (new Date(v.partida).getTime() - new Date(p.createdAt).getTime())));
    if (quando <= new Date(p.createdAt)) continue;
    const horasAntes = (new Date(v.partida).getTime() - quando.getTime()) / 3600_000;
    const multa = horasAntes >= CONFIG_PADRAO.valores.horasCancelamentoSemMulta ? 0 : Math.round(p.total * CONFIG_PADRAO.valores.multaCancelamentoPct) / 100;
    for (const x of pas) x.status = "CANCELADA";
    p.status = "REEMBOLSADO";
    p.pagamentos[0].status = "ESTORNADO";
    cancelamentos.push({
      id: `can-${cancelamentos.length + 1}`,
      pedidoId: p.id,
      passagemIds: pas.map((x) => x.id),
      motivo: pick(["Desistência da viagem", "Mudança de data", "Problema de saúde", "Comprou em duplicidade"]),
      valorPago: p.total,
      multa,
      reembolso: Math.round((p.total - multa) * 100) / 100,
      usuarioId: p.vendedorId ?? "u-gerente",
      createdAt: quando.toISOString(),
    });
  }

  // Caixas do balcão: uma sessão por vendedor e dia com vendas; a de hoje fica aberta
  const caixas: CaixaSessao[] = [];
  const hoje = localDayKey(now);
  const grupos = new Map<string, Pedido[]>();
  for (const p of pedidos) {
    if (p.canal !== "BALCAO" || !p.vendedorId) continue;
    const k = `${p.vendedorId}|${localDayKey(p.createdAt)}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  for (const [k, ps] of [...grupos.entries()].sort((a, b) => a[0].split("|")[1].localeCompare(b[0].split("|")[1]))) {
    const [usuarioId, dia] = k.split("|");
    const [y, m, d] = dia.split("-").map(Number);
    const id = `cx-${caixas.length + 1}`;
    const dinheiro = ps.filter((p) => p.pagamentos[0].metodo === "DINHEIRO" && p.pagamentos[0].status !== "PENDENTE").reduce((s, p) => s + p.total, 0);
    const sangria = dinheiro > 1500 ? Math.floor(dinheiro / 1000) * 500 : 0;
    const abertoEm = manausDate(y, m - 1, d, 5, 30);
    const aberto = dia === hoje;
    const diferenca = aberto ? 0 : [0, 0, 0, 0, -5, 2, -10][Math.floor(r() * 7)];
    for (const p of ps) p.pagamentos[0].caixaId = id;
    caixas.push({
      id,
      usuarioId,
      abertoEm: abertoEm.toISOString(),
      fechadoEm: aberto ? undefined : manausDate(y, m - 1, d, 18, Math.floor(r() * 50)).toISOString(),
      valorAbertura: 100,
      valorContado: aberto ? undefined : Math.round((100 + dinheiro - sangria + diferenca) * 100) / 100,
      movimentos: sangria ? [{ tipo: "SANGRIA", valor: sangria, observacao: "Depósito no banco", createdAt: manausDate(y, m - 1, d, 12).toISOString() }] : [],
      observacao: diferenca < 0 ? "Diferença de troco" : undefined,
    });
  }

  return {
    cidades,
    portos,
    embarcacoes,
    linhas,
    viagens,
    pedidos,
    passagens,
    encomendas,
    usuarios,
    agencias,
    comodos,
    tripulantes,
    convenios,
    caixas,
    cancelamentos,
    festivais,
    config: structuredClone(CONFIG_PADRAO),
  };
}
