import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { PixPayment } from "@/components/pix-payment";
import { BilheteTermico } from "@/components/bilhete-termico";
import { CancelarPedido } from "@/components/admin/cancelar-pedido";
import { Badge } from "@/components/ui";
import { calcularCancelamento, config, convenio, db, expirarPedidos, passagensDoPedido, pedidoPorCodigo, rotuloAssento, usuario } from "@/lib/store";
import { dateTime, label, money } from "@/lib/format";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Pedido" };

export default async function PedidoAdmin({ params }: PageProps<"/admin/pedidos/[codigo]">) {
  const op = await garantirAcesso("/admin/pedidos");
  const { codigo } = await params;
  expirarPedidos();
  const p = pedidoPorCodigo(codigo);
  if (!p) notFound();
  const pas = passagensDoPedido(p.id);
  const vendedor = usuario(p.vendedorId);
  const agencia = db().agencias.find((a) => a.id === p.agenciaId);
  const conv = convenio(pas[0]?.convenioId);
  const cancelamentos = db().cancelamentos.filter((c) => c.pedidoId === p.id);
  const ativas = pas.filter((x) => x.status === "EMITIDA" || x.status === "RESERVADA");
  const podeCancelar = (p.status === "PAGO" || p.status === "AGUARDANDO_PAGAMENTO") && ativas.length > 0 && (op.papel !== "VENDEDOR" || p.vendedorId === op.id);
  const { multaCancelamentoPct, horasCancelamentoSemMulta } = config().valores;
  const calc = calcularCancelamento(p, ativas.map((x) => x.id));
  const regra =
    p.status !== "PAGO"
      ? "Pedido ainda não pago: o cancelamento só libera as poltronas."
      : p.pagamentos[0].metodo === "FATURADO"
        ? "Pedido de convênio faturado: nada a reembolsar, a passagem sai da fatura."
        : `Saída em ${Math.max(0, Math.floor(calc.horasAntes))} h. Até ${horasCancelamentoSemMulta} h antes o reembolso é integral; depois, retém-se ${multaCancelamentoPct}%.` +
          (calc.multa ? ` Cancelando tudo agora: multa de ${money(calc.multa)}, reembolso de ${money(calc.reembolso)}.` : "");
  const jaImpresso = pas.some((x) => x.impressoes > 0);

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
          {podeCancelar && ativas.length > 0 && <CancelarPedido codigo={p.codigo} regra={regra} passagens={ativas.map((x) => ({ id: x.id, nome: x.nome, assento: rotuloAssento(x), valor: money(x.valor + x.taxaEmbarque) }))} />}
          {p.status === "PAGO" && (
            <Link href={`/bilhete/${p.codigo}?imprimir=1&voltar=/admin/pedidos/${p.codigo}`} className="btn-primary">
              <Printer size={16} /> {jaImpresso ? "Reimprimir (2ª via)" : `Imprimir bilhetes (${config().bilhete.larguraMm} mm)`}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-wrap items-start gap-6">
          {p.status === "AGUARDANDO_PAGAMENTO" && p.pagamentos[0].metodo === "PIX" && (
            <PixPayment codigo={p.codigo} copiaCola={p.pagamentos[0].pixCopiaCola ?? p.codigo} expiraEm={p.expiraEm!} total={money(p.total)} />
          )}
          {p.status === "PAGO" &&
            pas.filter((x) => x.status !== "CANCELADA").map((x) => (
              <div key={x.id} className="rounded-sm shadow-lg ring-1 ring-slate-200">
                <BilheteTermico passagem={x} pedido={p} />
              </div>
            ))}
          {pas.some((x) => x.status === "CANCELADA") && (
            <div className="card w-full overflow-x-auto">
              <h2 className="p-5 font-bold">Passagens canceladas</h2>
              <table className="table-base">
                <thead><tr><th>Passageiro</th><th>Poltrona</th><th className="text-right">Valor</th></tr></thead>
                <tbody>
                  {pas.filter((x) => x.status === "CANCELADA").map((x) => (
                    <tr key={x.id}><td>{x.nome}</td><td>{rotuloAssento(x)}</td><td className="text-right tabular-nums">{money(x.valor + x.taxaEmbarque)}</td></tr>
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
                ["Vendedor", vendedor?.nome ?? "—"],
                ["Agência", agencia?.nome ?? "—"],
                ["Convênio", conv ? `${conv.nome} (−${conv.descontoPercentual}%)` : "—"],
                ["Criado em", dateTime(p.createdAt)],
                ["Pagamento", `${label(p.pagamentos[0].metodo)} · ${label(p.pagamentos[0].status)}`],
                ["Vias impressas", String(Math.max(0, ...pas.map((x) => x.impressoes)))],
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
              {p.comissaoAgencia > 0 && <div className="flex justify-between"><span className="text-slate-500">Comissão agência</span><span className="tabular-nums">−{money(p.comissaoAgencia)}</span></div>}
              <div className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular-nums">{money(p.total)}</span></div>
            </div>
          </div>
          {cancelamentos.length > 0 && (
            <div className="card p-5 text-sm">
              <h2 className="mb-3 font-bold">Cancelamentos</h2>
              <ul className="space-y-3">
                {cancelamentos.map((c) => (
                  <li key={c.id} className="rounded-lg bg-slate-50 p-3">
                    <p className="font-medium">{c.motivo}</p>
                    <p className="text-xs text-slate-500">{dateTime(c.createdAt)} · {usuario(c.usuarioId)?.nome ?? "—"} · {c.passagemIds.length} passagem(ns)</p>
                    <p className="mt-1 text-xs">Reembolso <strong>{money(c.reembolso)}</strong>{c.multa > 0 && <> · multa {money(c.multa)}</>}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
