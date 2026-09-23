import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import { mapViagem } from "./map";
import type { Festival, Viagem } from "../types";
import { localDayKey } from "../format";
import { linha, viagensAdmin } from "./viagens"; // Wait, I need to check where to import things
import { cidades, portos, linhas } from "./catalogo";

export const festivais = cache(async (): Promise<Festival[]> => {
  const supabase = await createClient();
  const { data: fDataRes } = await supabase.from("festivais" as any).select("*").order("inicio");
  const fData = fDataRes as any[] | null;
  if (!fData) return [];
  
  const { data: vDataRes } = await supabase.from("festival_viagens" as any).select("*");
  const vData = vDataRes as any[] | null;
  const viagensPorFestival = new Map<string, string[]>();
  if (vData) {
    for (const row of vData) {
      if (!viagensPorFestival.has(row.festival_id)) viagensPorFestival.set(row.festival_id, []);
      viagensPorFestival.get(row.festival_id)!.push(row.viagem_id);
    }
  }

  return fData.map((row: any) => ({
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    chamada: row.chamada,
    descricao: row.descricao,
    cidadeId: row.cidade_id,
    inicio: row.inicio,
    fim: row.fim,
    acrescimoPercentual: Number(row.acrescimo_percentual),
    viagemIds: viagensPorFestival.get(row.id) || [],
    cor: row.cor,
    publicado: row.publicado,
  }));
});

export const festival = cache(async (slug: string): Promise<Festival | null> => {
  const todos = await festivais();
  return todos.find((f) => f.slug === slug) || null;
});

export async function festivaisNoSite(agora = new Date()) {
  const hoje = localDayKey(agora);
  const todos = await festivais();
  return todos.filter((f) => f.publicado && f.fim >= hoje).sort((a, b) => a.inicio.localeCompare(b.inicio));
}


export async function festivalDaViagem(viagemId: string) {
  const todos = await festivais();
  return todos.find((f) => f.viagemIds.includes(viagemId));
}
