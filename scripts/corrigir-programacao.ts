import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

/**
 * C0 do plano-melhorias.md — programação real da São Tomé Expresso (aprovada pelo usuário em 24/09/2026):
 *   Manaus → Santarém: segunda 03:00 · Santarém → Manaus: quarta 03:00.
 * Desativa os horários de sexta/sábado, cancela as viagens futuras desses dias SEM passagem vendida e
 * move as viagens futuras de quarta 06:00 para 03:00 (também só as sem passagem). Sem --confirmar, só mostra.
 * Uso: npx tsx --env-file=.env.local scripts/corrigir-programacao.ts [--confirmar]
 */
const confirmar = process.argv.includes("--confirmar");
const PROGRAMACAO: Record<string, { dia: number; hora: string }> = {
  "Manaus → Santarém": { dia: 1, hora: "03:00:00" },
  "Santarém → Manaus": { dia: 3, hora: "03:00:00" },
};
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const OFFSET_MANAUS_MS = 4 * 3600_000; // UTC−4
const local = (iso: string) => new Date(new Date(iso).getTime() - OFFSET_MANAUS_MS);

async function main() {
  const sb = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data: linhas, error } = await sb.from("linhas").select("id,nome");
  if (error) throw error;
  const acoes: string[] = [];
  const executar: (() => Promise<void>)[] = [];

  for (const l of linhas ?? []) {
    const alvo = PROGRAMACAO[l.nome];
    if (!alvo) continue;
    const { data: horarios } = await sb.from("horarios_linha").select("id,dia_semana,hora_saida,ativo").eq("linha_id", l.id);
    for (const h of horarios ?? []) {
      const certo = h.dia_semana === alvo.dia;
      if (certo && (h.hora_saida !== alvo.hora || !h.ativo)) {
        acoes.push(`${l.nome}: horário ${DIAS[h.dia_semana]} ${h.hora_saida} → ${alvo.hora} (ativo)`);
        executar.push(async () => {
          const r = await sb.from("horarios_linha").update({ hora_saida: alvo.hora, ativo: true }).eq("id", h.id);
          if (r.error) throw r.error;
        });
      }
      if (!certo && h.ativo) {
        acoes.push(`${l.nome}: desativar horário ${DIAS[h.dia_semana]} ${h.hora_saida}`);
        executar.push(async () => {
          const r = await sb.from("horarios_linha").update({ ativo: false }).eq("id", h.id);
          if (r.error) throw r.error;
        });
      }
    }

    const { data: viagens } = await sb.from("viagens").select("id,partida,status").eq("linha_id", l.id).gte("partida", new Date().toISOString()).neq("status", "CANCELADA");
    for (const v of viagens ?? []) {
      const { count } = await sb.from("passagens").select("id", { count: "exact", head: true }).eq("viagem_id", v.id);
      const d = local(v.partida);
      const rotulo = `${l.nome} ${d.toISOString().slice(0, 10)} (${DIAS[d.getUTCDay()]}) ${d.toISOString().slice(11, 16)}`;
      if (count) {
        if (d.getUTCDay() !== alvo.dia || d.toISOString().slice(11, 19) !== alvo.hora) acoes.push(`⚠ ${rotulo}: tem ${count} passagem(ns) — NÃO alterada, avisar o usuário`);
        continue;
      }
      if (d.getUTCDay() !== alvo.dia) {
        acoes.push(`${rotulo}: cancelar (dia fora da programação)`);
        executar.push(async () => {
          const r = await sb.from("viagens").update({ status: "CANCELADA", vendas_abertas: false, observacao: "Cancelada: fora da programação real (seg/qua 03:00)" }).eq("id", v.id);
          if (r.error) throw r.error;
        });
      } else if (d.toISOString().slice(11, 19) !== alvo.hora) {
        const [hh, mm] = alvo.hora.split(":").map(Number);
        const nova = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm) + OFFSET_MANAUS_MS).toISOString();
        acoes.push(`${rotulo}: mudar partida para ${alvo.hora.slice(0, 5)}`);
        executar.push(async () => {
          const r = await sb.from("viagens").update({ partida: nova }).eq("id", v.id);
          if (r.error) throw r.error;
        });
      }
    }
  }

  console.log(acoes.length ? acoes.join("\n") : "Nada a corrigir.");
  if (!confirmar) return console.log(`\n${executar.length} alteração(ões). Nada gravado; rode com --confirmar.`);
  for (const f of executar) await f();
  console.log(`\n✓ ${executar.length} alteração(ões) aplicadas.`);
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
