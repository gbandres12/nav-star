import "server-only";
import { addMinutes, localDayKey } from "../format";
import { cidades, portos, linhas, embarcacoes } from "./catalogo";
import { assentosOcupados, viagensAdmin, viagem } from "./viagens";
import { festivaisNoSite } from "./festivais";
import type { Viagem, Festival, Passagem } from "../types";
import { createClient } from "../supabase/server";
import { mapPassagem } from "./map";

export async function paradaInfo(linhaId: string, ordem: number) {
  const allLinhas = await linhas();
  const l = allLinhas.find(x => x.id === linhaId)!;
  const parada = l.paradas[ordem];
  const allPortos = await portos();
  const p = allPortos.find(x => x.id === parada.portoId)!;
  const allCidades = await cidades();
  const c = allCidades.find(x => x.id === p.cidadeId)!;
  return { ...parada, porto: p, cidade: c };
}

export async function horarioParada(v: Viagem, ordem: number) {
  const allLinhas = await linhas();
  const l = allLinhas.find(x => x.id === v.linhaId)!;
  return addMinutes(v.partida, l.paradas[ordem].minutosDesdeOrigem);
}

export async function cidadesAtendidas() {
  const allLinhas = await linhas();
  const allPortos = await portos();
  const allCidades = await cidades();
  
  const ids = new Set(allLinhas.filter((l) => l.ativa).flatMap((l) => l.paradas.map((p) => allPortos.find(x => x.id === p.portoId)!.cidadeId)));
  return allCidades.filter((c) => ids.has(c.id));
}

export async function passageirosPorSegmento(v: Viagem) {
  const allLinhas = await linhas();
  const l = allLinhas.find(x => x.id === v.linhaId)!;
  const cont = new Array(l.paradas.length - 1).fill(0);
  
  const supabase = await createClient();
  const { data } = await supabase.from("passagens").select("*").eq("viagem_id", v.id).neq("status", "CANCELADA");
  if (!data) return cont;
  
  const ativos = data.map(mapPassagem).filter(p => true); // Assume active for now
  
  for (const p of ativos) {
    for (let s = p.origemOrdem; s < p.destinoOrdem; s++) cont[s]++;
  }
  return cont;
}

export async function lugaresLivres(v: Viagem, origem: number, destino: number) {
  const allEmbarcacoes = await embarcacoes();
  const e = allEmbarcacoes.find(x => x.id === v.embarcacaoId)!;
  if (!e.assentoLivre) {
    const ocupados = await assentosOcupados(v.id, origem, destino);
    return e.assentos.length - ocupados.size;
  }
  const seg = (await passageirosPorSegmento(v)).slice(origem, destino);
  return Math.max(0, e.capacidadePassageiros - Math.max(0, ...seg));
}

export async function tarifaViagem(v: Viagem, origem: number, destino: number) {
  const allLinhas = await linhas();
  const l = allLinhas.find(x => x.id === v.linhaId)!;
  const base = l.tarifas[origem]?.[destino] ?? 0;
  
  // get festival da viagem
  const { data } = await (await createClient()).from("festival_viagens").select("festival_id").eq("viagem_id", v.id).maybeSingle();
  if (data) {
    const allFestivais = await festivaisNoSite(new Date(0));
    const f = allFestivais.find(x => x.id === data.festival_id);
    if (f?.acrescimoPercentual) {
      return Math.round(base * (1 + f.acrescimoPercentual / 100) * 100) / 100;
    }
  }
  return base;
}

export async function proximasSaidas(limit = 6) {
  const viagens = await viagensAdmin({ aba: "proximas" });
  const agora = new Date();
  return viagens.filter(v => new Date(v.partida) > agora && v.status !== "CANCELADA").slice(0, limit);
}

export type OpcaoFestival = { viagem: Viagem; origem: number; destino: number; saida: Date; chegada: Date; valor: number; taxa: number; livres: number; de: string; para: string };

export async function opcoesFestival(f: Festival, agora = new Date()) {
  const ida: OpcaoFestival[] = [];
  const volta: OpcaoFestival[] = [];
  
  const allLinhas = await linhas();
  const allPortos = await portos();
  const allCidades = await cidades();
  
  for (const id of f.viagemIds) {
    const v = await viagem(id);
    if (!v || v.status === "CANCELADA" || !v.vendasAbertas) continue;
    const l = allLinhas.find(x => x.id === v.linhaId)!;
    const cIdx = l.paradas.findIndex((p) => allPortos.find(x => x.id === p.portoId)!.cidadeId === f.cidadeId);
    if (cIdx < 0) continue;
    
    const buildOpcao = async (o: number, d: number): Promise<OpcaoFestival> => {
      const pOrigem = allPortos.find(x => x.id === l.paradas[o].portoId)!;
      const de = allCidades.find(x => x.id === pOrigem.cidadeId)!.nome;
      const pDestino = allPortos.find(x => x.id === l.paradas[d].portoId)!;
      const para = allCidades.find(x => x.id === pDestino.cidadeId)!.nome;
      
      return {
        viagem: v,
        origem: o,
        destino: d,
        saida: await horarioParada(v, o),
        chegada: await horarioParada(v, d),
        valor: await tarifaViagem(v, o, d),
        taxa: pOrigem.taxaEmbarque,
        livres: await lugaresLivres(v, o, d),
        de,
        para,
      };
    };
    
    for (let o = 0; o < cIdx; o++) {
      const saida = await horarioParada(v, o);
      if (saida > agora && (await tarifaViagem(v, o, cIdx)) > 0) ida.push(await buildOpcao(o, cIdx));
    }
    for (let d = cIdx + 1; d < l.paradas.length; d++) {
      const saida = await horarioParada(v, cIdx);
      if (saida > agora && (await tarifaViagem(v, cIdx, d)) > 0) volta.push(await buildOpcao(cIdx, d));
    }
  }
  const ord = (a: OpcaoFestival, b: OpcaoFestival) => a.saida.getTime() - b.saida.getTime() || a.de.localeCompare(b.de);
  return { ida: ida.sort(ord), volta: volta.sort(ord) };
}

export async function comodosDaEmbarcacao(id: string) {
  const supabase = await createClient();
  const { data: cData } = await supabase.from("comodos" as any).select("*").eq("embarcacao_id", id);
  const data = cData as any[] | null;
  return data || [];
}

export async function acrescimosEmbarcacao(embarcacaoId: string): Promise<Record<string, number>> {
  const comodos = await comodosDaEmbarcacao(embarcacaoId);
  const cm = new Map(comodos.map((c) => [c.id, c.acrescimo]));
  const allEmbarcacoes = await embarcacoes();
  const e = allEmbarcacoes.find((x) => x.id === embarcacaoId)!;
  return Object.fromEntries(e.assentos.map((a) => [a.id, a.comodoId ? Number(cm.get(a.comodoId) ?? 0) : 0]));
}

export async function mapaComodos(embarcacaoId: string): Promise<Record<string, { nome: string; cor: string }>> {
  const comodos = await comodosDaEmbarcacao(embarcacaoId);
  const cm = new Map(comodos.map((c) => [c.id, c]));
  const allEmbarcacoes = await embarcacoes();
  const e = allEmbarcacoes.find((x) => x.id === embarcacaoId)!;
  return Object.fromEntries(
    e.assentos
      .filter((a) => a.comodoId && cm.has(a.comodoId))
      .map((a) => {
        const comodo = cm.get(a.comodoId!)!;
        return [
          a.id,
          {
            nome: `${comodo.nome}${comodo.acrescimo ? ` (+R$ ${comodo.acrescimo})` : ""}`,
            cor: comodo.cor,
          },
        ];
      })
  );
}

export async function livresSemAcrescimo(viagemId: string, origem: number, destino: number) {
  const v = await viagem(viagemId);
  if (!v) return 0;
  const allEmbarcacoes = await embarcacoes();
  const e = allEmbarcacoes.find((x) => x.id === v.embarcacaoId)!;
  if (e.assentoLivre) return lugaresLivres(v, origem, destino);
  const acr = await acrescimosEmbarcacao(v.embarcacaoId);
  const ocup = await assentosOcupados(viagemId, origem, destino);
  return e.assentos.filter((a) => !ocup.has(a.id) && !(acr[a.id] > 0)).length;
}

export async function getConfig() {
  return {
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
}
