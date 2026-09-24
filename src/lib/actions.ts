"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirPapel } from "./sessao";
import { criarPedidoSite, criarPedidoBalcao, confirmarPagamento, informarPagamento, validarEmbarque } from "./data/pedidos";
import { criarEncomenda, avancarEncomenda } from "./data/encomendas";
import { rotuloAssento, type NovoPedidoInput } from "./store";

export type CheckoutState = { erro?: string } | undefined;

export async function finalizarCompra(input: NovoPedidoInput): Promise<CheckoutState> {
  let vendedorId: string | undefined;
  if (input.canal !== "SITE") {
    const a = await exigirPapel("ADMIN", "GERENTE", "VENDEDOR");
    if (a.erro) return { erro: a.erro };
    vendedorId = a.op!.id;
  }
  
  const payload = {
    viagemId: input.viagemId,
    origemOrdem: input.origemOrdem,
    destinoOrdem: input.destinoOrdem,
    compradorNome: input.comprador.nome,
    compradorEmail: input.comprador.email,
    compradorTelefone: input.comprador.telefone,
    metodoPagamento: input.metodo,
    passageiros: input.passageiros
  };

  const criar = () => (input.canal === "SITE" ? criarPedidoSite(payload) : criarPedidoBalcao(payload));
  // Duas vendas simultâneas sem poltrona escolhida podem tentar a mesma poltrona livre; a trava do banco recusa uma
  // delas ("acabou de ser vendido"). Nesse caso tenta de novo: o banco escolhe a próxima livre.
  const semEscolha = input.passageiros.every((x) => !x.assentoId);
  let r = await criar();
  for (let i = 0; i < 2 && !r.ok && semEscolha && r.erro.includes("acabou de ser vendido"); i++) r = await criar();

  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin", "layout");
  const c = r.codigo;
  if (input.canal === "SITE") redirect(`/pedido/${c}`);
  
  // Balcão pago na hora: já abre o bilhete para a impressora térmica
  redirect(input.pagoNoAto ? `/bilhete/${c}?imprimir=1&voltar=/admin/pedidos/${c}` : `/admin/pedidos/${c}`);
}

/** Só para testes locais: em produção não faz nada (confirmar pagamento é do painel ou do gateway) */
export async function simularPagamento(codigo: string) {
  if (process.env.NODE_ENV === "production" || process.env.PAGAMENTO_SIMULADO !== "true") return;
  await confirmarPagamento(codigo);
  revalidatePath(`/pedido/${codigo}`);
  revalidatePath("/admin", "layout");
}

/** Cliente clicou em "Já paguei": segura as poltronas até a equipe conferir o PIX */
export async function informarPagamentoAction(codigo: string): Promise<{ erro?: string }> {
  const r = await informarPagamento(codigo);
  revalidatePath(`/pedido/${codigo}`);
  revalidatePath("/admin/pedidos", "layout");
  return r.ok ? {} : { erro: r.erro };
}

/** Conferência manual do PIX no painel */
export async function confirmarPagamentoAction(codigo: string): Promise<{ erro?: string; ok?: string }> {
  const a = await exigirPapel("ADMIN", "GERENTE");
  if (a.erro) return { erro: a.erro };
  const r = await confirmarPagamento(codigo);
  if (!r.ok) return { erro: r.erro };
  revalidatePath(`/pedido/${codigo}`);
  revalidatePath("/admin", "layout");
  return { ok: "Pagamento confirmado. Os bilhetes foram emitidos." };
}

export type EmbarqueState =
  | { ok: boolean; mensagem: string; passageiro?: string; assento?: string; viagem?: string }
  | undefined;

export async function validarBilhete(_: EmbarqueState, form: FormData): Promise<EmbarqueState> {
  const token = String(form.get("token") ?? "");
  if (!token.trim()) return { ok: false, mensagem: "Informe o código do bilhete." };
  const a = await exigirPapel("ADMIN", "GERENTE", "CONFERENTE");
  if (a.erro) return { ok: false, mensagem: a.erro };
  const r = await validarEmbarque(token);
  revalidatePath("/admin", "layout");
  
  // Note: the RPC returns a json with { passagem: { nome }, viagem: { id } } according to the previous behavior.
  // Wait, I don't need to specify everything. Just use `r.resultado`.
  const res = r.resultado as any;
  const extra = res?.passagem
    ? { passageiro: res.passagem.nome, assento: rotuloAssento(res.passagem), viagem: res.viagem?.id }
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
  const enc = await criarEncomenda({
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
  });
  if (!enc.ok) return { erro: enc.erro };
  revalidatePath("/admin", "layout");
  redirect(`/admin/encomendas/${enc.codigo}`);
}

export async function avancarStatusEncomenda(codigo: string) {
  await avancarEncomenda(codigo);
  revalidatePath("/admin", "layout");
  revalidatePath("/rastreio");
}
