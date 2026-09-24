// Espelho simplificado de prisma/schema.prisma para a fase de protótipo.
// Valores monetários em number (reais); datas em ISO string (UTC).

export type Cidade = { id: string; nome: string; uf: string; sigla: string };

export type Porto = {
  id: string;
  cidadeId: string;
  nome: string;
  endereco: string;
  taxaEmbarque: number;
  ativo: boolean;
};

export type StatusEmbarcacao = "ATIVA" | "MANUTENCAO" | "INATIVA";
export type TipoAssento = "POLTRONA" | "POLTRONA_JANELA" | "ESPECIAL";

export type Assento = {
  id: string;
  codigo: string;
  fileira: number;
  coluna: number;
  tipo: TipoAssento;
  comodoId?: string; // acomodação (define o acréscimo sobre a tarifa)
};

/** Categoria de acomodação da embarcação: poltrona comum, executiva, camarote… */
export type Comodo = {
  id: string;
  embarcacaoId: string;
  nome: string;
  descricao: string;
  acrescimo: number; // R$ somados à tarifa do trecho
  cor: "rio" | "sol" | "rubro" | "emerald" | "slate";
  ativo: boolean;
};

export type Embarcacao = {
  id: string;
  nome: string;
  tipo: string;
  inscricaoCapitania: string;
  capacidadePassageiros: number;
  capacidadeCargaKg: number;
  status: StatusEmbarcacao;
  colunasMapa: number; // largura do mapa, incluindo corredor
  assentos: Assento[];
  // Assento livre: sem poltrona numerada; a venda é limitada só pela lotação (capacidadePassageiros)
  assentoLivre?: boolean;
  ano?: number;
  comprimentoM?: number;
  observacao?: string;
};

export type FuncaoTripulante = "COMANDANTE" | "IMEDIATO" | "MAQUINISTA" | "MARINHEIRO" | "TAIFEIRO" | "COMISSARIO";

export type Tripulante = {
  id: string;
  nome: string;
  funcao: FuncaoTripulante;
  documento: string;
  habilitacao: string; // nº da CIR / carteira de habilitação aquaviária
  validadeHabilitacao?: string; // AAAA-MM-DD
  telefone: string;
  embarcacaoId?: string; // lotação fixa (opcional)
  ativo: boolean;
};

export type ParadaLinha = { ordem: number; portoId: string; minutosDesdeOrigem: number };

export type Linha = {
  id: string;
  nome: string;
  ativa: boolean;
  paradas: ParadaLinha[];
  // tarifas[origem][destino] = valor (apenas origem < destino)
  tarifas: Record<number, Record<number, number>>;
  horarios: { diaSemana: number; horaSaida: string; embarcacaoId: string }[];
};

export type StatusViagem = "PROGRAMADA" | "EMBARQUE" | "EM_CURSO" | "CONCLUIDA" | "CANCELADA";

export type Viagem = {
  id: string;
  linhaId: string;
  embarcacaoId: string;
  partida: string;
  status: StatusViagem;
  comandante: string;
  vendasAbertas: boolean;
  tripulacao: string[]; // ids de Tripulante
  observacao?: string;
  motivoCancelamento?: string;
  avulsa?: boolean; // criada fora da programação semanal
};

export type CanalVenda = "SITE" | "BALCAO" | "AGENCIA" | "WHATSAPP";
export type StatusPedido = "AGUARDANDO_PAGAMENTO" | "PAGO" | "CANCELADO" | "EXPIRADO" | "REEMBOLSADO";
export type MetodoPagamento = "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "DINHEIRO" | "FATURADO"; // FATURADO = convênio, cobrado depois
export type TipoPassageiro = "INTEIRA" | "CRIANCA" | "COLO" | "IDOSO" | "ESTUDANTE" | "PCD";
export type StatusPassagem = "RESERVADA" | "EMITIDA" | "EMBARCADA" | "CANCELADA" | "NAO_COMPARECEU";

export type Passagem = {
  id: string;
  pedidoId: string;
  viagemId: string;
  assentoId?: string; // vazio em embarcação de assento livre
  origemOrdem: number;
  destinoOrdem: number;
  nome: string;
  documento: string;
  telefone?: string;
  tipo: TipoPassageiro;
  valor: number;
  taxaEmbarque: number;
  status: StatusPassagem;
  qrToken: string;
  embarcadoEm?: string;
  validadoPorId?: string;
  convenioId?: string;
  acrescimo: number; // cômodo (já incluído em `valor`)
  impressoes: number; // 0 = nunca impresso; >1 = segunda via em diante
};

export type Pagamento = {
  id: string;
  metodo: MetodoPagamento;
  status: "PENDENTE" | "APROVADO" | "RECUSADO" | "ESTORNADO";
  valor: number;
  pixCopiaCola?: string;
  pagoEm?: string;
  caixaId?: string;
};

export type Pedido = {
  id: string;
  codigo: string; // código público (URL / consulta)
  numero: string; // número impresso no bilhete: "MAO-2026-0001"
  canal: CanalVenda;
  status: StatusPedido;
  compradorNome: string;
  compradorEmail?: string;
  compradorTelefone: string;
  vendedorId?: string;
  agenciaId?: string;
  subtotal: number;
  taxas: number;
  desconto: number;
  total: number;
  comissaoAgencia: number;
  expiraEm?: string;
  pagamentoInformadoEm?: string; // cliente avisou que pagou o PIX (aguarda conferência)
  createdAt: string;
  pagamentos: Pagamento[];
};

export type StatusEncomenda =
  | "RECEBIDA"
  | "EMBARCADA"
  | "EM_TRANSITO"
  | "DISPONIVEL_RETIRADA"
  | "ENTREGUE"
  | "DEVOLVIDA";

export type Encomenda = {
  id: string;
  codigo: string;
  viagemId?: string;
  origemCidadeId: string;
  destinoCidadeId: string;
  remetenteNome: string;
  remetenteDoc: string;
  remetenteTel: string;
  destinatarioNome: string;
  destinatarioTel: string;
  descricao: string;
  volumes: number;
  pesoKg: number;
  valorDeclarado?: number;
  frete: number;
  pagador: "REMETENTE" | "DESTINATARIO";
  fretePago: boolean;
  status: StatusEncomenda;
  createdAt: string;
  eventos: { status: StatusEncomenda; descricao: string; createdAt: string }[];
};

export type PapelUsuario = "ADMIN" | "GERENTE" | "VENDEDOR" | "CONFERENTE";

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  agenciaId?: string;
  ativo: boolean;
  linhasPermitidas: string[]; // vazio = todas
  ultimoAcesso?: string;
  telefone?: string;
  onboardingConcluido?: boolean;
  onboardingPasso?: number;
  conviteEnviadoEm?: string;
};

export type Agencia = {
  id: string;
  empresaId?: string;
  nome: string;
  cidadeId: string;
  comissaoPercentual: number;
  ativa: boolean;
};

/** Acordo com prefeitura, secretaria ou empresa: desconto e, se faturado, cobrança posterior */
export type Convenio = {
  id: string;
  nome: string;
  cnpj?: string;
  descontoPercentual: number;
  faturado: boolean; // true = passageiro não paga no ato; a empresa conveniada recebe fatura
  contato?: string;
  ativo: boolean;
};

export type CaixaMovimento = { tipo: "SANGRIA" | "SUPRIMENTO"; valor: number; observacao: string; createdAt: string };

export type CaixaSessao = {
  id: string;
  usuarioId: string;
  abertoEm: string;
  fechadoEm?: string;
  valorAbertura: number;
  valorContado?: number; // dinheiro contado no fechamento
  movimentos: CaixaMovimento[];
  observacao?: string;
};

export type Cancelamento = {
  id: string;
  pedidoId: string;
  passagemIds: string[];
  motivo: string;
  valorPago: number; // o que o cliente tinha pago pelas passagens canceladas
  multa: number;
  reembolso: number; // valorPago − multa
  usuarioId?: string;
  createdAt: string;
};

export type Configuracao = {
  empresa: {
    nome: string;
    razaoSocial: string;
    cnpj: string;
    whatsapps: { cidade: string; numero: string; link: string }[];
    whatsapp: string;
    email: string;
    tipoServico: string;
    beneficios: string[];
    minutosReservaSite: number;
  };
  valores: {
    descontos: Record<TipoPassageiro, number>; // 0.5 = 50%
    multaCancelamentoPct: number; // % retido no cancelamento
    horasCancelamentoSemMulta: number; // até X horas antes da saída, sem multa
    taxaSistemaPct: number; // % da plataforma sobre as passagens vendidas
  };
  bilhete: {
    larguraMm: 58 | 80;
    titulo: string;
    mostrarLogo: boolean;
    mostrarValores: boolean;
    mostrarQr: boolean;
    mostrarBeneficios: boolean;
    localEmbarque: string;
    antecedenciaEmbarqueMin: number;
    mensagens: string[]; // linhas do rodapé
  };
};

/** Festival/evento com viagens especiais, divulgado no site (ex.: Festival de Parintins) */
export type Festival = {
  id: string;
  slug: string; // URL: /festivais/<slug>
  nome: string;
  chamada: string; // frase curta do card
  descricao: string;
  cidadeId: string; // cidade do evento
  inicio: string; // AAAA-MM-DD
  fim: string; // AAAA-MM-DD
  acrescimoPercentual: number; // reajuste sobre a tarifa normal nas viagens do festival (0 = preço normal)
  viagemIds: string[];
  cor: "rubro" | "rio" | "sol" | "emerald";
  publicado: boolean;
  fotos?: FotoFestival[]; // a primeira é a capa
};

export type FotoFestival = { id: string; url: string };
