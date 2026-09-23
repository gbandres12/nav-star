import type { Database } from "../supabase/database.types";
import type {
  Agencia,
  Assento,
  Cidade,
  Embarcacao,
  Encomenda,
  Linha,
  Pagamento,
  Passagem,
  Pedido,
  Porto,
  StatusEncomenda,
  TipoPassageiro,
  Usuario,
  Viagem,
} from "../types";

type DbCidade = Database["public"]["Tables"]["cidades"]["Row"];
type DbPorto = Database["public"]["Tables"]["portos"]["Row"];
type DbEmbarcacao = Database["public"]["Tables"]["embarcacoes"]["Row"];
type DbAssento = Database["public"]["Tables"]["assentos"]["Row"];
type DbLinha = Database["public"]["Tables"]["linhas"]["Row"];
type DbParada = Database["public"]["Tables"]["paradas_linha"]["Row"];
type DbTarifa = Database["public"]["Tables"]["tarifas_trecho"]["Row"];
type DbHorario = Database["public"]["Tables"]["horarios_linha"]["Row"];
type DbViagem = Database["public"]["Tables"]["viagens"]["Row"];
type DbPedido = Database["public"]["Tables"]["pedidos"]["Row"];
type DbPassagem = Database["public"]["Tables"]["passagens"]["Row"];
type DbPagamento = Database["public"]["Tables"]["pagamentos"]["Row"];
type DbEncomenda = Database["public"]["Tables"]["encomendas"]["Row"];
type DbEvento = Database["public"]["Tables"]["encomenda_eventos"]["Row"];
type DbPerfil = Database["public"]["Tables"]["perfis"]["Row"];
type DbAgencia = Database["public"]["Tables"]["agencias"]["Row"];

export function mapCidade(row: DbCidade): Cidade {
  return {
    id: row.slug || row.id,
    nome: row.nome,
    uf: row.uf,
    sigla: row.sigla,
  };
}

export function mapPorto(row: DbPorto): Porto {
  return {
    id: row.id,
    cidadeId: row.cidade_id,
    nome: row.nome,
    endereco: row.endereco || "",
    taxaEmbarque: Number(row.taxa_embarque),
    ativo: row.ativo,
  };
}

export function mapAssento(row: DbAssento): Assento {
  return {
    id: row.id,
    codigo: row.codigo,
    fileira: row.fileira,
    coluna: row.coluna,
    tipo: row.tipo,
  };
}

export function mapEmbarcacao(
  row: DbEmbarcacao,
  assentos: DbAssento[] = []
): Embarcacao {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    inscricaoCapitania: row.inscricao_capitania || "",
    capacidadePassageiros: row.capacidade_passageiros,
    capacidadeCargaKg: row.capacidade_carga_kg || 0,
    status: row.status,
    colunasMapa: row.colunas_mapa,
    assentos: assentos.map(mapAssento),
  };
}

export function mapLinha(
  row: DbLinha,
  paradas: DbParada[] = [],
  tarifas: DbTarifa[] = [],
  horarios: DbHorario[] = []
): Linha {
  const sortedParadas = [...paradas].sort((a, b) => a.ordem - b.ordem);
  const paradaIndexMap = new Map<string, number>();
  sortedParadas.forEach((p, idx) => paradaIndexMap.set(p.id, idx));

  const matrizTarifas: Record<number, Record<number, number>> = {};
  for (const t of tarifas) {
    const o = paradaIndexMap.get(t.origem_parada_id);
    const d = paradaIndexMap.get(t.destino_parada_id);
    if (o !== undefined && d !== undefined) {
      if (!matrizTarifas[o]) matrizTarifas[o] = {};
      matrizTarifas[o][d] = Number(t.valor);
    }
  }

  return {
    id: row.id,
    nome: row.nome,
    ativa: row.ativa,
    paradas: sortedParadas.map((p) => ({
      ordem: p.ordem,
      portoId: p.porto_id,
      minutosDesdeOrigem: p.minutos_desde_origem,
    })),
    tarifas: matrizTarifas,
    horarios: horarios.map((h) => ({
      diaSemana: h.dia_semana,
      horaSaida: h.hora_saida.slice(0, 5),
      embarcacaoId: h.embarcacao_id,
    })),
  };
}

export function mapViagem(row: DbViagem): Viagem {
  return {
    id: row.id,
    linhaId: row.linha_id,
    embarcacaoId: row.embarcacao_id,
    partida: row.partida,
    status: row.status,
    comandante: row.comandante || "",
    vendasAbertas: row.vendas_abertas,
    tripulacao: [],
    observacao: row.observacao || undefined,
  };
}

export function mapPagamento(row: DbPagamento): Pagamento {
  return {
    id: row.id,
    metodo: row.metodo as Pagamento["metodo"],
    status: row.status,
    valor: Number(row.valor),
    pixCopiaCola: row.pix_copia_cola || undefined,
    pagoEm: row.pago_em || undefined,
    caixaId: row.caixa_id || undefined,
  };
}

export function mapPedido(
  row: DbPedido,
  pagamentos: DbPagamento[] = []
): Pedido {
  return {
    id: row.id,
    codigo: row.codigo,
    numero: row.numero,
    canal: row.canal,
    status: row.status,
    compradorNome: row.comprador_nome,
    compradorEmail: row.comprador_email || undefined,
    compradorTelefone: row.comprador_telefone,
    vendedorId: row.vendedor_id || undefined,
    agenciaId: row.agencia_id || undefined,
    subtotal: Number(row.subtotal),
    taxas: Number(row.taxas),
    desconto: Number(row.desconto),
    total: Number(row.total),
    comissaoAgencia: Number(row.comissao_agencia),
    expiraEm: row.expira_em || undefined,
    createdAt: row.created_at,
    pagamentos: pagamentos.map(mapPagamento),
  };
}

export function mapPassagem(row: DbPassagem): Passagem {
  return {
    id: row.id,
    pedidoId: row.pedido_id,
    viagemId: row.viagem_id,
    assentoId: row.assento_id || undefined,
    origemOrdem: row.origem_ordem,
    destinoOrdem: row.destino_ordem,
    nome: row.nome,
    documento: row.documento,
    telefone: row.telefone || undefined,
    tipo: row.tipo as TipoPassageiro,
    valor: Number(row.valor),
    taxaEmbarque: Number(row.taxa_embarque),
    status: row.status,
    qrToken: row.qr_token,
    embarcadoEm: row.embarcado_em || undefined,
    validadoPorId: row.validado_por_id || undefined,
    acrescimo: 0,
    impressoes: 0,
  };
}

export function mapEncomenda(
  row: DbEncomenda,
  eventos: DbEvento[] = []
): Encomenda {
  return {
    id: row.id,
    codigo: row.codigo,
    viagemId: row.viagem_id || undefined,
    origemCidadeId: row.origem_cidade_id,
    destinoCidadeId: row.destino_cidade_id,
    remetenteNome: row.remetente_nome,
    remetenteDoc: row.remetente_doc,
    remetenteTel: row.remetente_tel,
    destinatarioNome: row.destinatario_nome,
    destinatarioTel: row.destinatario_tel,
    descricao: row.descricao,
    volumes: row.volumes,
    pesoKg: Number(row.peso_kg),
    valorDeclarado: row.valor_declarado ? Number(row.valor_declarado) : undefined,
    frete: Number(row.frete),
    pagador: row.pagador,
    fretePago: row.frete_pago,
    status: row.status as StatusEncomenda,
    createdAt: row.created_at,
    eventos: eventos.map((ev) => ({
      status: ev.status as StatusEncomenda,
      descricao: ev.descricao || "",
      createdAt: ev.created_at,
    })),
  };
}

export function mapUsuario(
  row: DbPerfil,
  linhasPermitidas: string[] = [],
  email = ""
): Usuario {
  return {
    id: row.id,
    nome: row.nome,
    email: email,
    papel: row.papel,
    agenciaId: row.agencia_id || undefined,
    ativo: row.ativo,
    linhasPermitidas,
    ultimoAcesso: row.ultimo_acesso || undefined,
    telefone: row.telefone || undefined,
    onboardingConcluido: row.onboarding_concluido,
    onboardingPasso: row.onboarding_passo,
    conviteEnviadoEm: row.convite_enviado_em || undefined,
  };
}

export function mapAgencia(row: DbAgencia): Agencia {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    nome: row.nome,
    cidadeId: row.cidade_id,
    comissaoPercentual: Number(row.comissao_percentual),
    ativa: row.ativa,
  };
}

export type {
  DbCidade,
  DbPorto,
  DbEmbarcacao,
  DbAssento,
  DbLinha,
  DbParada,
  DbTarifa,
  DbHorario,
  DbViagem,
  DbPedido,
  DbPassagem,
  DbPagamento,
  DbEncomenda,
  DbEvento,
  DbPerfil,
  DbAgencia,
};

