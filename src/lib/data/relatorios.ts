import "server-only";
import { createClient } from "../supabase/server";
import { mapLinha, mapViagem, mapPedido, mapPassagem, mapEncomenda, mapCidade, mapPorto, mapEmbarcacao, mapUsuario, mapAgencia } from "./map";
import type { Cancelamento, CaixaSessao, Convenio } from "../types";
import type { Db } from "../seed";
import { Filtros } from "../relatorios";

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
    supabase.from("viagens").select("*"),
    supabase.from("pedidos").select("*, pagamentos(*)"),
    supabase.from("passagens").select("*"),
    supabase.from("encomendas").select("*, encomenda_eventos(*)"),
    (supabase as any).from("cancelamentos").select("*"),
    supabase.from("caixa_sessoes").select("*, caixa_movimentos(*)"),
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
    (supabase as any).from("convenios").select("*"),
    (supabase as any).from("configuracoes_bilhete").select("*").maybeSingle()
  ]);

  const viagens = (viagensData || []).map(mapViagem);
  const pedidos = (pedidosData || []).map((p: any) => mapPedido(p, p.pagamentos || []));
  const passagens = (passagensData || []).map(mapPassagem);
  const encomendasBrutas = (encomendasData || []).map((e: any) => mapEncomenda(e, e.encomenda_eventos || []));
  const cidades = (cidadesData || []).map(mapCidade);
  // No app a cidade é o slug; aqui as linhas vêm sem join, então converte uuid → slug
  const slugPorUuid = new Map((cidadesData || []).map((c: { id: string; slug?: string | null }) => [c.id, c.slug ?? c.id]));
  const slug = (id: string) => slugPorUuid.get(id) ?? id;
  const encomendas = encomendasBrutas.map((e) => ({ ...e, origemCidadeId: slug(e.origemCidadeId), destinoCidadeId: slug(e.destinoCidadeId) }));
  const portos = (portosData || []).map(mapPorto).map((p) => ({ ...p, cidadeId: slug(p.cidadeId) }));
  
  const assentos = (assentosData || []);
  const embarcacoes = (embarcacoesData || []).map((e: any) => 
    mapEmbarcacao(e, assentos.filter((a: any) => a.embarcacao_id === e.id))
  );

  const usuarios = (usuariosData || []).map((u: any) => mapUsuario(u, []));
  const agencias = (agenciasData || []).map(mapAgencia).map((a) => ({ ...a, cidadeId: slug(a.cidadeId) }));

  const paradas = (paradasData || []);
  const tarifas = (tarifasData || []);
  const horarios = (horariosData || []);
  const linhas = (linhasData || []).map((l: any) => 
    mapLinha(
      l, 
      paradas.filter((p: any) => p.linha_id === l.id),
      tarifas.filter((t: any) => t.linha_id === l.id),
      horarios.filter((h: any) => h.linha_id === l.id)
    )
  );

  const cancelamentos = (cancelamentosData || []).map((c: any): Cancelamento => ({
    id: c.id,
    pedidoId: c.pedido_id,
    passagemIds: c.passagem_ids || [],
    motivo: c.motivo,
    valorPago: Number(c.valor_pago),
    multa: Number(c.multa),
    reembolso: Number(c.reembolso),
    usuarioId: c.usuario_id,
    createdAt: c.created_at
  }));

  const caixas = (caixasData || []).map((c: any): CaixaSessao => ({
    id: c.id,
    usuarioId: c.usuario_id,
    abertoEm: c.aberto_em,
    fechadoEm: c.fechado_em || undefined,
    valorAbertura: Number(c.valor_abertura),
    valorContado: c.valor_fechamento ? Number(c.valor_fechamento) : undefined,
    observacao: c.observacao || undefined,
    movimentos: (c.caixa_movimentos || []).map((m: any) => ({
      tipo: m.tipo,
      valor: Number(m.valor),
      observacao: m.observacao || "",
      createdAt: m.created_at
    }))
  }));

  const convenios = (conveniosData || []).map((c: any): Convenio => ({
    id: c.id,
    nome: c.nome,
    descontoPercentual: Number(c.desconto_percentual),
    faturado: c.faturado,
    ativo: true
  }));

  const conf = configData ? {
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
      multaCancelamentoPct: 0.2,
      horasCancelamentoSemMulta: 24,
      taxaSistemaPct: 0.05
    },
    bilhete: {
      larguraMm: configData.largura_mm || 80,
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
