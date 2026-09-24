import "server-only";
import { buscarBaseDeDadosParaRelatorios } from "./relatorios";
import type { Viagem } from "../types";
import type { Db } from "../seed";

export type PosicaoEmbarcacao = {
  embarcacaoId: string;
  situacao: "PROGRAMADA" | "EMBARQUE" | "ATRACADA" | "NAVEGANDO" | "MANUTENCAO" | "INATIVA" | "CANCELADA";
  viagem?: Viagem;
  cidadeId?: string;
  deCidadeId?: string;
  paraCidadeId?: string;
  progresso?: number;
  proximaSaida?: Viagem;
};

let _db: Db;

export async function carregarDadosMapa() {
  const f = { inicio: new Date(0), fim: new Date("2100-01-01") } as any;
  _db = await buscarBaseDeDadosParaRelatorios(f);
  return _db;
}

export const mapaDb = () => _db;
export const cidade = (id: string) => _db.cidades.find(c => c.id === id)!;
export const embarcacao = (id: string) => _db.embarcacoes.find(e => e.id === id)!;
export const linha = (id: string) => _db.linhas.find(l => l.id === id)!;
export const porto = (id: string) => _db.portos.find(p => p.id === id)!;

export function paradaInfo(linhaId: string, ordem: number) {
  const l = linha(linhaId);
  const p = porto(l.paradas[ordem].portoId);
  return { ...l.paradas[ordem], porto: p, cidade: cidade(p.cidadeId) };
}

export function horarioParada(v: Viagem, ordem: number) {
  return new Date(new Date(v.partida).getTime() + linha(v.linhaId).paradas[ordem].minutosDesdeOrigem * 60_000);
}

export function chegadaFinal(v: Viagem) {
  const l = linha(v.linhaId);
  return horarioParada(v, l.paradas.length - 1);
}

export function passageirosPorSegmento(v: Viagem) {
  const l = linha(v.linhaId);
  const cont = new Array(l.paradas.length - 1).fill(0);
  const ativos = _db.passagens.filter((p) => p.viagemId === v.id && p.status !== "CANCELADA");
  for (const p of ativos) {
    for (let s = p.origemOrdem; s < p.destinoOrdem; s++) cont[s]++;
  }
  return cont;
}

export function ocupacaoViagem(v: Viagem) {
  const total = embarcacao(v.embarcacaoId).capacidadePassageiros;
  const max = Math.max(0, ...passageirosPorSegmento(v));
  return { ocupados: max, total, pct: total ? Math.round((max / total) * 100) : 0 };
}

export function posicaoFrota(agora = new Date()): PosicaoEmbarcacao[] {
  return _db.embarcacoes.map((e) => {
    if (e.status !== "ATIVA") return { embarcacaoId: e.id, situacao: e.status };
    const vs = _db.viagens.filter((v) => v.embarcacaoId === e.id && v.status !== "CANCELADA");
    const proximaSaida = vs.find((v) => new Date(v.partida) > agora);
    const atual = vs.find((v) => new Date(v.partida) <= agora && chegadaFinal(v) > agora);
    if (atual) {
      const l = linha(atual.linhaId);
      let i = 0;
      while (i < l.paradas.length - 1 && horarioParada(atual, i + 1) <= agora) i++;
      const a = horarioParada(atual, i).getTime();
      const b = horarioParada(atual, i + 1).getTime();
      return {
        embarcacaoId: e.id,
        situacao: "NAVEGANDO",
        viagem: atual,
        deCidadeId: paradaInfo(l.id, i).cidade.id,
        paraCidadeId: paradaInfo(l.id, i + 1).cidade.id,
        progresso: Math.min(1, Math.max(0, (agora.getTime() - a) / (b - a))),
        proximaSaida,
      };
    }
    if (proximaSaida && new Date(proximaSaida.partida).getTime() - agora.getTime() < 3 * 3600_000) {
      return { embarcacaoId: e.id, situacao: "EMBARQUE", viagem: proximaSaida, cidadeId: paradaInfo(proximaSaida.linhaId, 0).cidade.id, proximaSaida };
    }
    const ultima = [...vs].reverse().find((v) => chegadaFinal(v) <= agora);
    const l = ultima ? linha(ultima.linhaId) : undefined;
    const cidadeId = ultima && l ? paradaInfo(l.id, l.paradas.length - 1).cidade.id : proximaSaida ? paradaInfo(proximaSaida.linhaId, 0).cidade.id : undefined;
    return { embarcacaoId: e.id, situacao: "ATRACADA", cidadeId, proximaSaida };
  });
}
