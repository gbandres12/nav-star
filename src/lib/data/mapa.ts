import "server-only";
import { cache } from "react";
import { buscarBaseDeDadosParaRelatorios } from "./relatorios";
import type { Db, Viagem } from "../types";
import type { Filtros } from "../relatorios";

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

export const carregarDadosMapa = cache(async (): Promise<Db> => {
  const f: Filtros = {
    de: "",
    ate: "",
    linhaId: "",
    embarcacaoId: "",
    usuarioId: "",
    q: "",
    inicio: new Date(0),
    fim: new Date("2100-01-01"),
  };
  return buscarBaseDeDadosParaRelatorios(f);
});

export const cidade = (db: Db, id: string) => db.cidades.find((c) => c.id === id)!;
export const embarcacao = (db: Db, id: string) => db.embarcacoes.find((e) => e.id === id)!;
export const linha = (db: Db, id: string) => db.linhas.find((l) => l.id === id)!;
export const porto = (db: Db, id: string) => db.portos.find((p) => p.id === id)!;

export function paradaInfo(db: Db, linhaId: string, ordem: number) {
  const l = linha(db, linhaId);
  const p = porto(db, l.paradas[ordem].portoId);
  return { ...l.paradas[ordem], porto: p, cidade: cidade(db, p.cidadeId) };
}

export function horarioParada(db: Db, v: Viagem, ordem: number) {
  return new Date(new Date(v.partida).getTime() + linha(db, v.linhaId).paradas[ordem].minutosDesdeOrigem * 60_000);
}

export function chegadaFinal(db: Db, v: Viagem) {
  const l = linha(db, v.linhaId);
  return horarioParada(db, v, l.paradas.length - 1);
}

export function passageirosPorSegmento(db: Db, v: Viagem) {
  const l = linha(db, v.linhaId);
  const cont = new Array(l.paradas.length - 1).fill(0);
  const ativos = db.passagens.filter((p) => p.viagemId === v.id && p.status !== "CANCELADA");
  for (const p of ativos) {
    for (let s = p.origemOrdem; s < p.destinoOrdem; s++) cont[s]++;
  }
  return cont;
}

export function ocupacaoViagem(db: Db, v: Viagem) {
  const total = embarcacao(db, v.embarcacaoId).capacidadePassageiros;
  const max = Math.max(0, ...passageirosPorSegmento(db, v));
  return { ocupados: max, total, pct: total ? Math.round((max / total) * 100) : 0 };
}

export function posicaoFrota(db: Db, agora = new Date()): PosicaoEmbarcacao[] {
  return db.embarcacoes.map((e) => {
    if (e.status !== "ATIVA") return { embarcacaoId: e.id, situacao: e.status };
    const vs = db.viagens.filter((v) => v.embarcacaoId === e.id && v.status !== "CANCELADA");
    const proximaSaida = vs.find((v) => new Date(v.partida) > agora);
    const atual = vs.find((v) => new Date(v.partida) <= agora && chegadaFinal(db, v) > agora);
    if (atual) {
      const l = linha(db, atual.linhaId);
      let i = 0;
      while (i < l.paradas.length - 1 && horarioParada(db, atual, i + 1) <= agora) i++;
      const a = horarioParada(db, atual, i).getTime();
      const b = horarioParada(db, atual, i + 1).getTime();
      return {
        embarcacaoId: e.id,
        situacao: "NAVEGANDO",
        viagem: atual,
        deCidadeId: paradaInfo(db, l.id, i).cidade.id,
        paraCidadeId: paradaInfo(db, l.id, i + 1).cidade.id,
        progresso: Math.min(1, Math.max(0, (agora.getTime() - a) / (b - a))),
        proximaSaida,
      };
    }
    if (proximaSaida && new Date(proximaSaida.partida).getTime() - agora.getTime() < 3 * 3600_000) {
      return { embarcacaoId: e.id, situacao: "EMBARQUE", viagem: proximaSaida, cidadeId: paradaInfo(db, proximaSaida.linhaId, 0).cidade.id, proximaSaida };
    }
    const ultima = [...vs].reverse().find((v) => chegadaFinal(db, v) <= agora);
    const l = ultima ? linha(db, ultima.linhaId) : undefined;
    const cidadeId = ultima && l ? paradaInfo(db, l.id, l.paradas.length - 1).cidade.id : proximaSaida ? paradaInfo(db, proximaSaida.linhaId, 0).cidade.id : undefined;
    return { embarcacaoId: e.id, situacao: "ATRACADA", cidadeId, proximaSaida };
  });
}
