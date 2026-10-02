import "server-only";
import { bancoAgencia, UUID } from "./banco";

export type ParadaPortal = { ordem: number; nome: string; saida: string };
export type Trecho = { ordemOrigem: number; ordemDestino: number; capacidade: number; ocupados: number; livres: number };
export type ViagemPortal = {
  id: string;
  partida: string;
  linha: string;
  embarcacao: string;
  capacidade: number;
  paradas: ParadaPortal[];
  embarques: number[]; // ordens das paradas em que ainda dá para embarcar
};

type LinhaViagem = {
  id: string;
  partida: string;
  linha: { nome: string; paradas: { ordem: number; minutos_desde_origem: number; porto: { nome: string; cidade: { nome: string } } }[] };
  embarcacao: { nome: string; capacidade_passageiros: number };
};

const SELECT_VIAGEM =
  "id, partida, linha:linhas(nome, paradas:paradas_linha(ordem, minutos_desde_origem, porto:portos(nome, cidade:cidades(nome)))), embarcacao:embarcacoes(nome, capacidade_passageiros)";

const somarMin = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60_000).toISOString();

function mapViagem(r: LinhaViagem): ViagemPortal {
  const paradas = [...r.linha.paradas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => ({ ordem: p.ordem, nome: p.porto.cidade.nome, saida: somarMin(r.partida, p.minutos_desde_origem) }));
  const ultima = paradas[paradas.length - 1]?.ordem;
  const embarques = paradas.filter((p) => p.ordem !== ultima && new Date(p.saida).getTime() > Date.now()).map((p) => p.ordem);
  return { id: r.id, partida: r.partida, linha: r.linha.nome, embarcacao: r.embarcacao.nome, capacidade: r.embarcacao.capacidade_passageiros, paradas, embarques };
}

/** Ainda dá para embarcar em alguma parada (menos a última) */
const temEmbarqueFuturo = (v: ViagemPortal) => v.embarques.length > 0;

/** Viagens abertas para venda (próximos 30 dias), da empresa da agência */
export async function viagensDoPortal(empresaId: string): Promise<ViagemPortal[]> {
  const { data, error } = await bancoAgencia()
    .from("viagens")
    .select(SELECT_VIAGEM)
    .eq("empresa_id", empresaId)
    .in("status", ["PROGRAMADA", "EMBARQUE"])
    .eq("vendas_abertas", true)
    .gte("partida", new Date(Date.now() - 24 * 3600_000).toISOString())
    .lte("partida", new Date(Date.now() + 30 * 24 * 3600_000).toISOString())
    .order("partida")
    .limit(60);
  if (error) throw new Error(`[portal viagens] ${error.message}`);
  return ((data ?? []) as unknown as LinhaViagem[]).map(mapViagem).filter(temEmbarqueFuturo);
}

export async function viagemDoPortal(empresaId: string, viagemId: string): Promise<ViagemPortal | null> {
  if (!UUID.test(viagemId)) return null;
  const { data } = await bancoAgencia()
    .from("viagens")
    .select(`${SELECT_VIAGEM}, status, vendas_abertas`)
    .eq("id", viagemId)
    .eq("empresa_id", empresaId)
    .in("status", ["PROGRAMADA", "EMBARQUE"])
    .eq("vendas_abertas", true)
    .maybeSingle();
  if (!data) return null;
  const v = mapViagem(data as unknown as LinhaViagem);
  return temEmbarqueFuturo(v) ? v : null;
}

/** Lotação por trecho de várias viagens (só das que pertencem à empresa) */
export async function lotacoes(empresaId: string, ids: string[]): Promise<Record<string, Trecho[]>> {
  const banco = bancoAgencia();
  const validos = ids.filter((i) => UUID.test(i)).slice(0, 60);
  if (!validos.length) return {};
  const { data: minhas } = await banco.from("viagens").select("id").eq("empresa_id", empresaId).in("id", validos);
  const lista = (minhas ?? []).map((v) => v.id as string);
  const linhas = await Promise.all(
    lista.map(async (id) => {
      const { data, error } = await banco.rpc("lotacao_por_trecho", { p_viagem_id: id });
      if (error) throw new Error(`[lotacao_por_trecho] ${error.message}`);
      return [
        id,
        (data as { ordem_origem: number; ordem_destino: number; capacidade: number; ocupados: number; livres: number }[]).map((t) => ({
          ordemOrigem: t.ordem_origem,
          ordemDestino: t.ordem_destino,
          capacidade: t.capacidade,
          ocupados: t.ocupados,
          livres: t.livres,
        })),
      ] as const;
    }),
  );
  return Object.fromEntries(linhas);
}

export type PrecoCategoria = { tipo: string; tabela: number; piso: number; taxa: number };

export async function precosDoTrecho(empresaId: string, viagemId: string, origem: number, destino: number): Promise<PrecoCategoria[]> {
  if (!UUID.test(viagemId) || !Number.isInteger(origem) || !Number.isInteger(destino)) return [];
  const banco = bancoAgencia();
  const { data: v } = await banco.from("viagens").select("id").eq("id", viagemId).eq("empresa_id", empresaId).maybeSingle();
  if (!v) return [];
  const { data, error } = await banco.rpc("precos_agencia_trecho", { p_viagem_id: viagemId, p_origem_ordem: origem, p_destino_ordem: destino });
  if (error) throw new Error(`[precos_agencia_trecho] ${error.message}`);
  return (data as { tipo: string; valor_tabela: number; valor_piso: number; taxa_embarque: number }[]).map((r) => ({
    tipo: r.tipo,
    tabela: Number(r.valor_tabela),
    piso: Number(r.valor_piso),
    taxa: Number(r.taxa_embarque),
  }));
}

// ─── Bilhetes ──────────────────────────────────────────────────────────────

export type BilhetePortal = {
  id: string;
  numero: string;
  codigo: string;
  status: "EMITIDO" | "CANCELADO" | "TRANSFERIDO";
  valorCobrado: number;
  taxa: number;
  criadoEm: string;
  passageiro: string;
  documento: string;
  tipo: string;
  linha: string;
  origem: string;
  destino: string;
  embarque: string;
  podeCancelar: boolean;
};

type LinhaBilhete = {
  id: string;
  numero: string;
  codigo_validacao: string;
  status: BilhetePortal["status"];
  valor_cobrado: number;
  taxa_embarque: number;
  repasse_pago: boolean;
  created_at: string;
  passageiro: { nome: string; documento_original: string };
  passagem: {
    status: string;
    tipo: string;
    origem_ordem: number;
    destino_ordem: number;
    viagem: { partida: string; linha: { nome: string; paradas: { ordem: number; minutos_desde_origem: number; porto: { cidade: { nome: string } } }[] } };
  };
};

const SELECT_BILHETE =
  "id, numero, codigo_validacao, status, valor_cobrado, taxa_embarque, repasse_pago, created_at, passageiro:passageiros(nome, documento_original), passagem:passagens(status, tipo, origem_ordem, destino_ordem, viagem:viagens(partida, linha:linhas(nome, paradas:paradas_linha(ordem, minutos_desde_origem, porto:portos(cidade:cidades(nome))))))";

function mapBilhete(r: LinhaBilhete): BilhetePortal {
  const par = (o: number) => r.passagem.viagem.linha.paradas.find((p) => p.ordem === o);
  const origem = par(r.passagem.origem_ordem);
  const embarque = somarMin(r.passagem.viagem.partida, origem?.minutos_desde_origem ?? 0);
  return {
    id: r.id,
    numero: r.numero,
    codigo: r.codigo_validacao,
    status: r.status,
    valorCobrado: Number(r.valor_cobrado),
    taxa: Number(r.taxa_embarque),
    criadoEm: r.created_at,
    passageiro: r.passageiro.nome,
    documento: r.passageiro.documento_original,
    tipo: r.passagem.tipo,
    linha: r.passagem.viagem.linha.nome,
    origem: origem?.porto.cidade.nome ?? "—",
    destino: par(r.passagem.destino_ordem)?.porto.cidade.nome ?? "—",
    embarque,
    // Mesma trava do banco: EMITIDO, repasse ainda não baixado e o barco ainda não saiu do embarque
    podeCancelar: r.status === "EMITIDO" && !r.repasse_pago && r.passagem.status === "EMITIDA" && new Date(embarque).getTime() > Date.now(),
  };
}

export async function bilhetesDaAgencia(agenciaId: string): Promise<BilhetePortal[]> {
  const { data, error } = await bancoAgencia()
    .from("bilhetes_agencia")
    .select(SELECT_BILHETE)
    .eq("agencia_id", agenciaId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`[portal bilhetes] ${error.message}`);
  return ((data ?? []) as unknown as LinhaBilhete[]).map(mapBilhete);
}

export async function bilheteDaAgencia(agenciaId: string, bilheteId: string): Promise<BilhetePortal | null> {
  if (!UUID.test(bilheteId)) return null;
  const { data } = await bancoAgencia().from("bilhetes_agencia").select(SELECT_BILHETE).eq("agencia_id", agenciaId).eq("id", bilheteId).maybeSingle();
  return data ? mapBilhete(data as unknown as LinhaBilhete) : null;
}
