"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirPapel } from "./sessao";
import { criarPedidoSite, criarPedidoBalcao, confirmarPagamento, validarEmbarque } from "./data/pedidos";
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

  const r = input.canal === "SITE" 
    ? await criarPedidoSite(payload)
    : await criarPedidoBalcao({ ...payload, passageiros: input.passageiros });

  if (!r.ok) return { erro: r.erro };
  revalidatePath("/admin", "layout");
  const c = r.codigo;
  if (input.canal === "SITE") redirect(`/pedido/${c}`);
  
  // Balcão pago na hora: já abre o bilhete para a impressora térmica
  redirect(input.pagoNoAto ? `/bilhete/${c}?imprimir=1&voltar=/admin/pedidos/${c}` : `/admin/pedidos/${c}`);
}

export async function simularPagamento(codigo: string) {
  await confirmarPagamento(codigo);
  revalidatePath(`/pedido/${codigo}`);
  revalidatePath("/admin", "layout");
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
