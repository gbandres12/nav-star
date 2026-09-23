// Espelho simplificado de prisma/schema.prisma para a fase de protótipo.
// Valores monetários em number (reais); datas em ISO string (UTC).

export type Cidade = { id: string; nome: string; uf: string; sigla: string };

export type Porto = {
  id: string;
  cidadeId: string;
  nome: string;
  endereco: string;
  taxaEmbarque: number;
};

export type StatusEmbarcacao = "ATIVA" | "MANUTENCAO" | "INATIVA";
export type TipoAssento = "POLTRONA" | "POLTRONA_JANELA" | "ESPECIAL";

export type Assento = {
  id: string;
  codigo: string;
  fileira: number;
  coluna: number;
  tipo: TipoAssento;
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
};

export type CanalVenda = "SITE" | "BALCAO" | "AGENCIA" | "WHATSAPP";
export type StatusPedido = "AGUARDANDO_PAGAMENTO" | "PAGO" | "CANCELADO" | "EXPIRADO" | "REEMBOLSADO";
export type MetodoPagamento = "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "DINHEIRO";
export type TipoPassageiro = "INTEIRA" | "CRIANCA" | "IDOSO" | "ESTUDANTE" | "PCD";
export type StatusPassagem = "RESERVADA" | "EMITIDA" | "EMBARCADA" | "CANCELADA" | "NAO_COMPARECEU";

export type Passagem = {
  id: string;
  pedidoId: string;
  viagemId: string;
  assentoId: string;
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
};

export type Pagamento = {
  id: string;
  metodo: MetodoPagamento;
  status: "PENDENTE" | "APROVADO" | "RECUSADO" | "ESTORNADO";
  valor: number;
  pixCopiaCola?: string;
  pagoEm?: string;
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
};

export type Agencia = {
  id: string;
  nome: string;
  cidadeId: string;
  comissaoPercentual: number;
  ativa: boolean;
};
