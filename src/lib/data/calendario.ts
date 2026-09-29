import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "../supabase/publico";
import { TZ } from "../format";

export type CalendarioViagem = {
  dia: string;
  viagemId: string;
  saida: string;
  chegada: string;
  valor: number;
  taxa: number;
  livres: number;
  festival?: string | null;
  origemOrdem: number;
  destinoOrdem: number;
};

type CalendarioRow = {
  dia: string;
  viagem_id: string;
  saida: string;
  chegada: string;
  valor: number | string;
  taxa: number | string;
  livres: number | string;
  festival?: string | null;
  origem_ordem: number;
  destino_ordem: number;
};

type DynamicRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export function mesValido(mes: string | undefined): mes is `${number}-${number}` {
  return !!mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

export function mesAtual(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function deslocarMes(mes: string, deslocamento: number) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const data = new Date(Date.UTC(ano, numeroMes - 1 + deslocamento, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function mesDaData(dia: string) {
  return dia.slice(0, 7);
}

/**
 * A RPC é pública (anônima), então o resultado é igual para todo mundo e pode ser reaproveitado entre requisições.
 * 30 s: o número de lugares livres pode atrasar meio minuto; a venda confere de novo no banco.
 */
const rpcCalendario = unstable_cache(
  async (origemSlug: string, destinoSlug: string, mes: string) => {
    const dynamicClient = createPublicClient() as unknown as DynamicRpcClient;
    const { data, error } = await dynamicClient.rpc("calendario_viagens", {
      origem_slug: origemSlug,
      destino_slug: destinoSlug,
      mes: `${mes}-01`,
    });
    if (error || !Array.isArray(data)) throw new Error(`[calendario] ${error?.message}`);
    return data as CalendarioRow[];
  },
  ["calendario-viagens"],
  { revalidate: 30 }
);

export async function calendarioViagens(
  origemSlug: string,
  destinoSlug: string,
  mes: string
): Promise<CalendarioViagem[]> {
  if (!mesValido(mes)) return [];

  const data = await rpcCalendario(origemSlug, destinoSlug, mes).catch((e) => {
    console.error(e);
    return [] as CalendarioRow[];
  });
  return data.map((row) => ({
    dia: row.dia,
    viagemId: row.viagem_id,
    saida: row.saida,
    chegada: row.chegada,
    valor: Number(row.valor),
    taxa: Number(row.taxa),
    livres: Number(row.livres),
    festival: row.festival,
    origemOrdem: Number(row.origem_ordem),
    destinoOrdem: Number(row.destino_ordem),
  }));
}

export async function proximasDatasCalendario(
  origemSlug: string,
  destinoSlug: string,
  limite = 4
) {
  const atual = mesAtual();
  const meses = [atual, deslocarMes(atual, 1)];
  const resultados = await Promise.all(
    meses.map((mes) => calendarioViagens(origemSlug, destinoSlug, mes))
  );

  return resultados
    .flat()
    .sort((a, b) => new Date(a.saida).getTime() - new Date(b.saida).getTime())
    .slice(0, limite);
}
