"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  avancarEncomenda,
  confirmarPagamento,
  criarEncomenda,
  criarPedido,
  validarEmbarque,
  type NovoPedidoInput,
} from "./store";

export type CheckoutState = { erro?: string } | undefined;

export async function finalizarCompra(input: NovoPedidoInput): Promise<CheckoutState> {
  // Canais internos (balcão) só com usuário autenticado — autenticação entra na próxima fase
  const r = criarPedido(input);
  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin", "layout");
  const c = r.pedido.codigo;
  if (input.canal === "SITE") redirect(`/pedido/${c}`);
  // Balcão pago na hora: já abre o bilhete para a impressora térmica
  redirect(r.pedido.status === "PAGO" ? `/bilhete/${c}?imprimir=1&voltar=/admin/pedidos/${c}` : `/admin/pedidos/${c}`);
}

export async function simularPagamento(codigo: string) {
  confirmarPagamento(codigo);
  revalidatePath(`/pedido/${codigo}`);
  revalidatePath("/admin", "layout");
}

export type EmbarqueState =
  | { ok: boolean; mensagem: string; passageiro?: string; assento?: string; viagem?: string }
  | undefined;

export async function validarBilhete(_: EmbarqueState, form: FormData): Promise<EmbarqueState> {
  const token = String(form.get("token") ?? "");
  if (!token.trim()) return { ok: false, mensagem: "Informe o código do bilhete." };
  const r = validarEmbarque(token);
  revalidatePath("/admin", "layout");
  const extra = r.passagem
    ? { passageiro: r.passagem.nome, assento: r.passagem.assentoId.split("-").pop(), viagem: r.viagem?.id }
    : {};
  return r.ok ? { ok: true, mensagem: "Embarque liberado", ...extra } : { ok: false, mensagem: r.erro, ...extra };
}

export async function novaEncomenda(_: { erro?: string } | undefined, form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const n = (k: string) => Number(s(k).replace(",", ".")) || 0;
  const obrig = ["remetenteNome", "remetenteDoc", "remetenteTel", "destinatarioNome", "destinatarioTel", "descricao", "origemCidadeId", "destinoCidadeId"];
  if (obrig.some((k) => !s(k))) return { erro: "Preencha todos os campos obrigatórios." };
  if (s("origemCidadeId") === s("destinoCidadeId")) return { erro: "Origem e destino devem ser diferentes." };
  if (n("pesoKg") <= 0 || n("frete") <= 0) return { erro: "Informe peso e valor do frete." };
  const enc = criarEncomenda({
    viagemId: s("viagemId") || undefined,
    origemCidadeId: s("origemCidadeId"),
    destinoCidadeId: s("destinoCidadeId"),
    remetenteNome: s("remetenteNome"),
    remetenteDoc: s("remetenteDoc"),
    remetenteTel: s("remetenteTel"),
    destinatarioNome: s("destinatarioNome"),
    destinatarioTel: s("destinatarioTel"),
    descricao: s("descricao"),
    volumes: Math.max(1, Math.round(n("volumes"))),
    pesoKg: n("pesoKg"),
    valorDeclarado: n("valorDeclarado") || undefined,
    frete: n("frete"),
    pagador: s("pagador") === "DESTINATARIO" ? "DESTINATARIO" : "REMETENTE",
    fretePago: s("pagador") !== "DESTINATARIO",
  });
  revalidatePath("/admin", "layout");
  redirect(`/admin/encomendas/${enc.codigo}`);
}

export async function avancarStatusEncomenda(codigo: string) {
  avancarEncomenda(codigo);
  revalidatePath("/admin", "layout");
  revalidatePath("/rastreio");
}
