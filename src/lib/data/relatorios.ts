import "server-only";
import { createClient } from "../supabase/server";
import { mapLinha, mapViagem, mapPedido, mapPassagem, mapEncomenda, mapCidade, mapPorto, mapEmbarcacao, mapUsuario, mapAgencia } from "./map";
import type { Cancelamento, CaixaSessao, Convenio, Configuracao } from "../types";
import type { Db } from "../types";
import { Filtros } from "../relatorios";

type DbCaixaComMovimentos = {
  id: string;
  usuario_id: string;
  aberto_em: string;
  fechado_em: string | null;
  valor_abertura: number | string;
  valor_fechamento: number | string | null;
  observacao: string | null;
  caixa_movimentos: {
    tipo: "SANGRIA" | "SUPRIMENTO";
    valor: number | string;
    observacao: string | null;
    created_at: string;
  }[];
};

type DbCancelamentoRow = {
  id: string;
  pedido_id: string;
  passagem_ids: string[] | null;
  motivo: string;
  valor_pago: number | string;
  multa: number | string;
  reembolso: number | string;
  usuario_id: string | null;
  created_at: string;
};

type DbConvenioRow = {
  id: string;
  nome: string;
  desconto_percentual: number | string;
  faturado: boolean;
};

export async function buscarBaseDeDadosParaRelatorios(f: Filtros): Promise<Db> {
  const supabase = await createClient();
  
  const inicio = f.inicio.toISOString();
  const fim = f.fim.toISOString();
  
  const [
    { data: viagensData },
    { data: pedidosData },
    { data: passagensData },
    { data: encomendasData },
    { data: cancelamentosData },
    { data: caixasData },
    { data: linhasData },
    { data: paradasData },
    { data: tarifasData },
    { data: horariosData },
    { data: cidadesData },
    { data: portosData },
    { data: embarcacoesData },
    { data: assentosData },
    { data: usuariosData },
    { data: agenciasData },
    { data: conveniosData },
    { data: configData }
  ] = await Promise.all([
    supabase.from("viagens").select("*").gte("partida", inicio).lte("partida", fim),
    supabase.from("pedidos").select("*, pagamentos(*)").gte("created_at", inicio).lte("created_at", fim),
    supabase.from("passagens").select("*").gte("created_at", inicio).lte("created_at", fim),
    supabase.from("encomendas").select("*, encomenda_eventos(*)").gte("created_at", inicio).lte("created_at", fim),
    supabase.from("cancelamentos").select("*").gte("created_at", inicio).lte("created_at", fim),
    supabase.from("caixa_sessoes").select("*, caixa_movimentos(*)").gte("aberto_em", inicio).lte("aberto_em", fim),
    supabase.from("linhas").select("*"),
    supabase.from("paradas_linha").select("*"),
    supabase.from("tarifas_trecho").select("*"),
    supabase.from("horarios_linha").select("*"),
    supabase.from("cidades").select("*"),
    supabase.from("portos").select("*"),
    supabase.from("embarcacoes").select("*"),
    supabase.from("assentos").select("*"),
    supabase.from("perfis").select("*"),
    supabase.from("agencias").select("*"),
    supabase.from("convenios").select("*"),
    supabase.from("configuracoes_bilhete").select("*").maybeSingle()
  ]);

  const viagens = (viagensData || []).map(mapViagem);
  const pedidos = (pedidosData || []).map((p) => mapPedido(p, p.pagamentos || []));
  const passagens = (passagensData || []).map(mapPassagem);
  const encomendasBrutas = (encomendasData || []).map((e) => mapEncomenda(e, e.encomenda_eventos || []));
  const cidades = (cidadesData || []).map(mapCidade);
  // No app a cidade é o slug; aqui as linhas vêm sem join, então converte uuid → slug
  const slugPorUuid = new Map((cidadesData || []).map((c: { id: string; slug?: string | null }) => [c.id, c.slug ?? c.id]));
  const slug = (id: string) => slugPorUuid.get(id) ?? id;
  const encomendas = encomendasBrutas.map((e) => ({ ...e, origemCidadeId: slug(e.origemCidadeId), destinoCidadeId: slug(e.destinoCidadeId) }));
  const portos = (portosData || []).map(mapPorto).map((p) => ({ ...p, cidadeId: slug(p.cidadeId) }));
  
  const assentos = (assentosData || []);
  const embarcacoes = (embarcacoesData || []).map((e) => 
    mapEmbarcacao(e, assentos.filter((a) => a.embarcacao_id === e.id))
  );

  const usuarios = (usuariosData || []).map((u) => mapUsuario(u, []));
  const agencias = (agenciasData || []).map(mapAgencia).map((a) => ({ ...a, cidadeId: slug(a.cidadeId) }));

  const paradas = (paradasData || []);
  const tarifas = (tarifasData || []);
  const horarios = (horariosData || []);
  const linhas = (linhasData || []).map((l) => 
    mapLinha(
      l, 
      paradas.filter((p) => p.linha_id === l.id),
      tarifas.filter((t) => t.linha_id === l.id),
      horarios.filter((h) => h.linha_id === l.id)
    )
  );

  const cancelamentos = ((cancelamentosData || []) as unknown as DbCancelamentoRow[]).map((c): Cancelamento => ({
    id: c.id,
    pedidoId: c.pedido_id,
    passagemIds: c.passagem_ids || [],
    motivo: c.motivo,
    valorPago: Number(c.valor_pago),
    multa: Number(c.multa),
    reembolso: Number(c.reembolso),
    usuarioId: c.usuario_id || undefined,
    createdAt: c.created_at
  }));

  const caixas = ((caixasData || []) as unknown as DbCaixaComMovimentos[]).map((c): CaixaSessao => ({
    id: c.id,
    usuarioId: c.usuario_id,
    abertoEm: c.aberto_em,
    fechadoEm: c.fechado_em || undefined,
    valorAbertura: Number(c.valor_abertura),
    valorContado: c.valor_fechamento ? Number(c.valor_fechamento) : undefined,
    observacao: c.observacao || undefined,
    movimentos: (c.caixa_movimentos || []).map((m) => ({
      tipo: m.tipo,
      valor: Number(m.valor),
      observacao: m.observacao || "",
      createdAt: m.created_at
    }))
  }));

  const convenios = ((conveniosData || []) as unknown as DbConvenioRow[]).map((c): Convenio => ({
    id: c.id,
    nome: c.nome,
    descontoPercentual: Number(c.desconto_percentual),
    faturado: c.faturado,
    ativo: true
  }));

  const conf: Configuracao = configData ? {
    empresa: {
      nome: configData.titulo || "Empresa",
      razaoSocial: "Razão Social",
      cnpj: "00.000.000/0001-00",
      whatsapps: [],
      whatsapp: "5592999999999",
      email: "contato@empresa.com",
      tipoServico: "TRANSPORTE AQUAVIÁRIO",
      beneficios: [],
      minutosReservaSite: 15
    },
    valores: {
      descontos: { INTEIRA: 0, CRIANCA: 0.5, COLO: 1, IDOSO: 0.5, ESTUDANTE: 0.5, PCD: 1 },
      isentosTaxa: { INTEIRA: false, CRIANCA: true, COLO: true, IDOSO: true, ESTUDANTE: false, PCD: true },
      multaCancelamentoPct: 0.2,
      horasCancelamentoSemMulta: 24,
      taxaSistemaPct: 0.05
    },
    bilhete: {
      larguraMm: (configData.largura_mm === 58 ? 58 : 80) as 80 | 58,
      titulo: configData.titulo || "BILHETE DE PASSAGEM",
      mostrarLogo: configData.mostrar_logo,
      mostrarValores: configData.mostrar_valores,
      mostrarQr: configData.mostrar_qr,
      mostrarBeneficios: configData.mostrar_beneficios,
      localEmbarque: configData.local_embarque || "",
      antecedenciaEmbarqueMin: configData.antecedencia_embarque_min || 30,
      mensagens: []
    }
  } : {
    empresa: {
      nome: "NavStar",
      razaoSocial: "NavStar Navegação",
      cnpj: "00.000.000/0001-00",
      whatsapps: [],
      whatsapp: "5592999999999",
      email: "contato@navstar.com",
      tipoServico: "TRANSPORTE AQUAVIÁRIO",
      beneficios: [],
      minutosReservaSite: 15
    },
    valores: {
      descontos: { INTEIRA: 0, CRIANCA: 0.5, COLO: 1, IDOSO: 0.5, ESTUDANTE: 0.5, PCD: 1 },
      isentosTaxa: { INTEIRA: false, CRIANCA: true, COLO: true, IDOSO: true, ESTUDANTE: false, PCD: true },
      multaCancelamentoPct: 0.2,
      horasCancelamentoSemMulta: 24,
      taxaSistemaPct: 0.05
    },
    bilhete: {
      larguraMm: 80,
      titulo: "BILHETE DE PASSAGEM",
      mostrarLogo: true,
      mostrarValores: true,
      mostrarQr: true,
      mostrarBeneficios: true,
      localEmbarque: "Porto de Manaus",
      antecedenciaEmbarqueMin: 30,
      mensagens: []
    }
  };

  return {
    cidades,
    portos,
    embarcacoes,
    linhas,
    agencias,
    usuarios,
    convenios,
    viagens,
    pedidos,
    passagens,
    encomendas,
    cancelamentos,
    caixas,
    config: conf,
    comodos: [],
    tripulantes: [],
    festivais: []
  };
}
