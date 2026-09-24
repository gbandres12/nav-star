import "server-only";
import { cache } from "react";
import { CONFIG_PADRAO } from "../seed";
import { addMinutes, localDayKey } from "../format";
import { cidades, portos, linhas, embarcacoes } from "./catalogo";
import { assentosOcupados, viagensAdmin, viagem } from "./viagens";
import { festivaisNoSite } from "./festivais";
import type { Configuracao, TipoPassageiro, Viagem, Festival, Passagem } from "../types";
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
  const { data: pData } = await supabase.from("passagens" as any).select("*").eq("viagem_id", v.id).neq("status", "CANCELADA");
  const data = pData as any[] | null;
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
  const supabase = await createClient();
  const { data: fData } = await supabase.from("festival_viagens" as any).select("festival_id").eq("viagem_id", v.id).maybeSingle();
  const data = fData as any;
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

/**
 * Configuração da empresa lida do banco (empresa_publica, empresas, descontos_tipo_passageiro, configuracoes_bilhete).
 * O que ainda não estiver cadastrado cai no padrão real da São Tomé Expresso (CONFIG_PADRAO), nunca em dados inventados.
 */
export const getConfig = cache(async (): Promise<Configuracao> => {
  const supabase = await createClient();
  const [{ data: emp }, { data: descontos }, { data: interna }, { data: bilhete }] = await Promise.all([
    supabase.from("empresa_publica").select("*").limit(1).maybeSingle(),
    supabase.from("descontos_tipo_passageiro").select("tipo,percentual"),
    // Só o usuário logado da empresa lê estas duas; para o visitante, valem os padrões
    supabase.from("empresas").select("multa_cancelamento_pct,horas_cancelamento_sem_multa,taxa_sistema_pct").limit(1).maybeSingle(),
    supabase.from("configuracoes_bilhete" as never).select("*").limit(1).maybeSingle(),
  ]);
  const p = CONFIG_PADRAO;
  const e = (emp ?? {}) as Record<string, unknown>;
  const whatsapps = Array.isArray(e.whatsapps) && e.whatsapps.length
    ? (e.whatsapps as { cidade: string; numero: string }[]).map((w) => ({ ...w, link: `55${String(w.numero).replace(/\D/g, "")}` }))
    : p.empresa.whatsapps;
  const desc = { ...p.valores.descontos } as Record<TipoPassageiro, number>;
  for (const d of (descontos ?? []) as { tipo: string; percentual: number }[]) {
    if (d.tipo in desc) desc[d.tipo as TipoPassageiro] = Number(d.percentual) / 100;
  }
  const v = (interna ?? {}) as Record<string, unknown>;
  const b = (bilhete ?? null) as Record<string, unknown> | null;
  return {
    empresa: {
      nome: (e.nome_fantasia as string) || p.empresa.nome,
      razaoSocial: (e.razao_social as string) || p.empresa.razaoSocial,
      cnpj: (e.cnpj as string) || p.empresa.cnpj,
      whatsapps,
      whatsapp: (e.whatsapp as string) || whatsapps[0]?.link || p.empresa.whatsapp,
      email: (e.email as string) || p.empresa.email,
      tipoServico: (e.tipo_servico as string) || p.empresa.tipoServico,
      beneficios: Array.isArray(e.beneficios) && e.beneficios.length ? (e.beneficios as string[]) : p.empresa.beneficios,
      minutosReservaSite: Number(e.minutos_reserva_site) || p.empresa.minutosReservaSite,
    },
    valores: {
      descontos: desc,
      multaCancelamentoPct: v.multa_cancelamento_pct != null ? Number(v.multa_cancelamento_pct) : p.valores.multaCancelamentoPct,
      horasCancelamentoSemMulta: v.horas_cancelamento_sem_multa != null ? Number(v.horas_cancelamento_sem_multa) : p.valores.horasCancelamentoSemMulta,
      taxaSistemaPct: v.taxa_sistema_pct != null ? Number(v.taxa_sistema_pct) : p.valores.taxaSistemaPct,
    },
    bilhete: b
      ? {
          larguraMm: Number(b.largura_mm) === 58 ? 58 : 80,
          titulo: (b.titulo as string) || p.bilhete.titulo,
          mostrarLogo: b.mostrar_logo !== false,
          mostrarValores: b.mostrar_valores !== false,
          mostrarQr: b.mostrar_qr !== false,
          mostrarBeneficios: b.mostrar_beneficios !== false,
          localEmbarque: (b.local_embarque as string) || p.bilhete.localEmbarque,
          antecedenciaEmbarqueMin: Number(b.antecedencia_embarque_min ?? p.bilhete.antecedenciaEmbarqueMin),
          mensagens: Array.isArray(b.mensagens) && b.mensagens.length ? (b.mensagens as string[]) : p.bilhete.mensagens,
        }
      : p.bilhete,
  };
});
