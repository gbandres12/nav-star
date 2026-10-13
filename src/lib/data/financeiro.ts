import "server-only";
import { createClient } from "../supabase/server";

export interface ResumoFinanceiroDTO {
  bruto: number;
  liquido: number;
  taxas: number;
  reembolsos: number;
  comissoes: number;
  fretes_pagos: number;
  fretes_a_receber: number;
  por_canal: { canal: string; valor: number }[];
  por_metodo: { metodo: string; valor: number }[];
  por_linha: { linha_nome?: string; valor: number }[];
  por_agencia: { agencia_id: string; agencia_nome: string; qtd: number; valor: number; comissao: number }[];
  por_vendedor: { vendedor_nome?: string; valor: number }[];
}

export async function resumoFinanceiro(inicio: string, fim: string): Promise<ResumoFinanceiroDTO> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resumo_financeiro", {
    inicio,
    fim,
  });

  if (error || !data) {
    return {
      bruto: 0,
      liquido: 0,
      taxas: 0,
      reembolsos: 0,
      comissoes: 0,
      fretes_pagos: 0,
      fretes_a_receber: 0,
      por_canal: [],
      por_metodo: [],
      por_linha: [],
      por_agencia: [],
      por_vendedor: [],
    };
  }

  return data as unknown as ResumoFinanceiroDTO;
}
