import "server-only";
import { createClient } from "../supabase/server";

export async function resumoFinanceiro(inicio: string, fim: string) {
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

  return data;
}
