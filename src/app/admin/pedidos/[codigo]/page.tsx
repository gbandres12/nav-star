import Link from "next/link";
import { notFound } from "next/navigation";
import { BellRing, ChevronLeft, Printer } from "lucide-react";
import { BilheteTermico } from "@/components/bilhete-termico";
import { CancelarPedido } from "@/components/admin/cancelar-pedido";
import { ConfirmarPagamento } from "@/components/admin/confirmar-pagamento";
import { Badge } from "@/components/ui";
import { pedidoCompleto, pedidoPorCodigo } from "@/lib/data/pedidos";
import { getConfig } from "@/lib/data/utils";
import { createClient } from "@/lib/supabase/server";
import { dateTime, label, money } from "@/lib/format";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Pedido" };

const horasAte = (instante: number) => Math.max(0, Math.floor((instante - Date.now()) / 3_600_000));

export default async function PedidoAdmin({ params }: PageProps<"/admin/pedidos/[codigo]">) {
  const op = await garantirAcesso("/admin/pedidos");
  const { codigo } = await params;
  const [p, interno, config] = await Promise.all([pedidoCompleto(codigo), pedidoPorCodigo(codigo), getConfig()]);
  if (!p || !interno) notFound();

  const vendedor = interno.vendedorId
    ? (await (await createClient()).from("perfis").select("nome").eq("id", interno.vendedorId).maybeSingle()).data?.nome
    : undefined;
  const ativas = p.passagens.filter((x) => x.status === "EMITIDA" || x.status === "RESERVADA");
  const emitidas = p.passagens.filter((x) => x.status === "EMITIDA" || x.status === "EMBARCADA");
  const canceladas = p.passagens.filter((x) => x.status === "CANCELADA");
  const gestao = op.papel === "ADMIN" || op.papel === "GERENTE";
  // Mesma regra da função cancelar_pedido: vendedor só cancela o próprio pedido ainda não pago
  const podeCancelar =
    ativas.length > 0 &&
    (p.status === "PAGO" || p.status === "AGUARDANDO_PAGAMENTO") &&
    (gestao || (interno.vendedorId === op.id && p.status === "AGUARDANDO_PAGAMENTO"));

  const { multaCancelamentoPct, horasCancelamentoSemMulta } = config.valores;
  const primeiraSaida = Math.min(...p.passagens.map((x) => new Date(x.saida).getTime()));
  const horasAntes = horasAte(primeiraSaida);
  const regra =
    p.status !== "PAGO"
      ? "Pedido ainda não pago: o cancelamento só libera as poltronas."
      : p.pagamento.metodo === "FATURADO"
        ? "Pedido de convênio faturado: nada a reembolsar, a passagem sai da fatura."
        : `Saída em ${horasAntes} h. Até ${horasCancelamentoSemMulta} h antes o reembolso é integral; depois, retém-se ${multaCancelamentoPct}%. O reembolso é feito fora do sistema.`;

  return (
    <>
      <Link href="/admin/pedidos" className="no-print mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Pedidos
      </Link>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold">{p.codigo}</h1>
          <Badge status={p.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {podeCancelar && (
            <CancelarPedido codigo={p.codigo} regra={regra} passagens={ativas.map((x) => ({ id: x.id, nome: x.nome, assento: x.assento, valor: money(x.valor + x.taxaEmbarque) }))} />
          )}
          {p.status === "PAGO" && (
            <Link href={`/bilhete/${p.codigo}?imprimir=1&voltar=/admin/pedidos/${p.codigo}`} className="btn-primary">
              <Printer size={16} /> Imprimir bilhetes ({config.bilhete.larguraMm} mm)
            </Link>
          )}
        </div>
      </div>

      {p.status === "AGUARDANDO_PAGAMENTO" && (
        <div className={`no-print mb-6 rounded-2xl border p-5 ${p.pagamentoInformadoEm ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
          <p className="flex items-center gap-2 font-semibold">
            <BellRing size={18} />
            {p.pagamentoInformadoEm
              ? `Cliente informou o pagamento em ${dateTime(p.pagamentoInformadoEm)}`
              : "Aguardando o pagamento do cliente"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Confira no extrato um PIX de <strong>{money(p.total)}</strong>
            {" "}com identificador <span className="font-mono font-semibold">{p.codigo.replace(/[^A-Za-z0-9]/g, "")}</span>.
            {p.expiraEm && ` A reserva vale até ${dateTime(p.expiraEm)}.`}
          </p>
          {gestao ? (
            <div className="mt-3"><ConfirmarPagamento codigo={p.codigo} total={money(p.total)} /></div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Só gerente ou administrador confirmam pagamentos.</p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-wrap items-start gap-6">
          {p.status === "PAGO" &&
            emitidas.map((x) => (
              <div key={x.id} className="rounded-sm shadow-lg ring-1 ring-slate-200">
                <BilheteTermico passagem={x} pedido={p} config={config} />
              </div>
            ))}
          {p.status !== "PAGO" && ativas.length > 0 && (
            <div className="card w-full overflow-x-auto">
              <h2 className="p-5 font-bold">Passagens reservadas</h2>
              <table className="table-base">
                <thead><tr><th>Passageiro</th><th>Trecho</th><th>Poltrona</th><th className="text-right">Valor</th></tr></thead>
                <tbody>
                  {ativas.map((x) => (
                    <tr key={x.id}>
                      <td>{x.nome}<p className="text-xs text-slate-500">{label(x.tipo)} · {x.documento}</p></td>
                      <td className="whitespace-nowrap">{x.origemCidade} → {x.destinoCidade}<p className="text-xs text-slate-500">{dateTime(x.saida)}</p></td>
                      <td>{x.assento === "COLO" ? "Colo" : x.assento}</td>
                      <td className="text-right tabular-nums">{money(x.valor + x.taxaEmbarque)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {canceladas.length > 0 && (
            <div className="card w-full overflow-x-auto">
              <h2 className="p-5 font-bold">Passagens canceladas</h2>
              <table className="table-base">
                <thead><tr><th>Passageiro</th><th>Poltrona</th><th className="text-right">Valor</th></tr></thead>
                <tbody>
                  {canceladas.map((x) => (
                    <tr key={x.id}><td>{x.nome}</td><td>{x.assento === "COLO" ? "Colo" : x.assento}</td><td className="text-right tabular-nums">{money(x.valor + x.taxaEmbarque)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <aside className="no-print h-fit space-y-6">
          <div className="card p-5 text-sm">
            <h2 className="mb-3 font-bold">Resumo</h2>
            <dl className="space-y-2">
              {[
                ["Nº do pedido", p.numero],
                ["Comprador", p.compradorNome],
                ["Telefone", p.compradorTelefone],
                ["E-mail", p.compradorEmail ?? "—"],
                ["Canal", label(p.canal)],
                ["Vendedor", vendedor ?? "—"],
                ["Criado em", dateTime(p.createdAt)],
                ["Pagamento", `${label(p.pagamento.metodo)} · ${label(p.pagamento.status)}`],
                ...(p.pagamento.pagoEm ? [["Pago em", dateTime(p.pagamento.pagoEm)]] : []),
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium">{val}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4">
              <div className="flex justify-between"><span className="text-slate-500">Passagens</span><span className="tabular-nums">{money(p.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Taxas de embarque</span><span className="tabular-nums">{money(p.taxas)}</span></div>
              {interno.comissaoAgencia > 0 && <div className="flex justify-between"><span className="text-slate-500">Comissão agência</span><span className="tabular-nums">−{money(interno.comissaoAgencia)}</span></div>}
              <div className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular-nums">{money(p.total)}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
