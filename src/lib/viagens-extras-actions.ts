"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { manausDate } from "./format";
import { exigirPapel } from "./sessao";
import { conflitosDaEmbarcacao, salvarViagemExtra, type TipoViagemExtra } from "./data/viagens-extras";
import type { Estado } from "./admin-actions";
import type { StatusViagem } from "./types";

const STATUS: StatusViagem[] = ["PROGRAMADA", "EM_CURSO", "CONCLUIDA", "CANCELADA"];

/** "2026-10-20T14:30" (hora de Manaus, do campo datetime-local) → Date */
function dataHora(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  return m ? manausDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
}

/** Aceita "1234.5" e "1.234,50" */
function dinheiro(v: string) {
  if (!v) return 0;
  return Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
}

export async function salvarViagemExtraAction(_: Estado, form: FormData): Promise<Estado> {
  const a = await exigirPapel("ADMIN", "GERENTE");
  if (!a.op) return { erro: a.erro ?? "Seu perfil não tem permissão para esta ação." };

  const s = (k: string) => String(form.get(k) ?? "").trim();
  const id = s("id") || undefined;
  const tipo = s("tipo") as TipoViagemExtra;
  if (tipo !== "EXTRA" && tipo !== "FRETAMENTO") return { erro: "Escolha o tipo da viagem." };
  if (s("origem").length < 2 || s("destino").length < 2) return { erro: "Informe origem e destino." };
  if (!s("embarcacaoId")) return { erro: "Escolha a embarcação." };

  const ida = dataHora(s("ida"));
  if (!ida) return { erro: "Informe a data e a hora da ida." };
  const volta = s("temVolta") === "on" ? dataHora(s("volta")) : null;
  if (s("temVolta") === "on" && !volta) return { erro: "Informe a data e a hora da volta." };
  if (volta && volta <= ida) return { erro: "A volta precisa ser depois da ida." };

  const valorTotal = dinheiro(s("valorTotal"));
  const valorRecebido = dinheiro(s("valorRecebido"));
  if (!Number.isFinite(valorTotal) || valorTotal < 0 || !Number.isFinite(valorRecebido) || valorRecebido < 0) return { erro: "Valores inválidos." };
  const passageiros = s("passageiros") ? Number(s("passageiros")) : undefined;
  if (passageiros !== undefined && (!Number.isInteger(passageiros) || passageiros < 0)) return { erro: "Número de passageiros inválido." };
  if (tipo === "FRETAMENTO" && s("clienteNome").length < 2) return { erro: "Informe o cliente do fretamento." };

  const status = (id ? s("status") : "PROGRAMADA") as StatusViagem;
  if (!STATUS.includes(status)) return { erro: "Situação inválida." };
  if (status === "CANCELADA" && s("motivo").length < 3) return { erro: "Informe o motivo do cancelamento." };

  // Conflito de lancha: avisa, e só salva se a pessoa marcar "salvar mesmo assim"
  if (status !== "CANCELADA" && form.get("ignorarConflito") !== "on") {
    const conflitos = await conflitosDaEmbarcacao(s("embarcacaoId"), ida, volta ?? undefined, id);
    if (conflitos.length) return { erro: `A embarcação já está em: ${conflitos.join("; ")}. Se mesmo assim está certo, marque "Salvar mesmo assim".` };
  }

  const r = await salvarViagemExtra({
    id, tipo, origem: s("origem"), destino: s("destino"), embarcacaoId: s("embarcacaoId"),
    saidaIda: ida.toISOString(), saidaVolta: volta?.toISOString(), status,
    clienteNome: s("clienteNome"), clienteContato: s("clienteContato"),
    valorTotal, valorRecebido, passageiros, observacao: s("observacao"), motivoCancelamento: s("motivo"),
  });
  if (!r.ok) return { erro: r.erro };

  revalidatePath("/admin/viagens/extras", "layout");
  if (!id) redirect("/admin/viagens/extras");
  return { ok: "Viagem salva." };
}
