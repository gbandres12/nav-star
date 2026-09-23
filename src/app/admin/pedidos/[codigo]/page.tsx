import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { PixPayment } from "@/components/pix-payment";
import { BilheteTermico } from "@/components/bilhete-termico";
import { Badge } from "@/components/ui";
import { db, expirarPedidos, passagensDoPedido, pedidoPorCodigo } from "@/lib/store";
import { dateTime, label, money } from "@/lib/format";

export const metadata = { title: "Pedido" };

export default async function PedidoAdmin({ params }: PageProps<"/admin/pedidos/[codigo]">) {
  const { codigo } = await params;
  expirarPedidos();
  const p = pedidoPorCodigo(codigo);
  if (!p) notFound();
  const pas = passagensDoPedido(p.id);
  const vendedor = db().usuarios.find((u) => u.id === p.vendedorId);
  const agencia = db().agencias.find((a) => a.id === p.agenciaId);

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
        {p.status === "PAGO" && (
          <Link href={`/bilhete/${p.codigo}?imprimir=1&voltar=/admin/pedidos/${p.codigo}`} className="btn-primary">
            <Printer size={16} /> Imprimir bilhetes (80 mm)
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-wrap items-start gap-6">
          {p.status === "AGUARDANDO_PAGAMENTO" && p.pagamentos[0].metodo === "PIX" && (
            <PixPayment codigo={p.codigo} copiaCola={p.pagamentos[0].pixCopiaCola ?? p.codigo} expiraEm={p.expiraEm!} total={money(p.total)} />
          )}
          {p.status === "PAGO" &&
            pas.map((x) => (
              <div key={x.id} className="rounded-sm shadow-lg ring-1 ring-slate-200">
                <BilheteTermico passagem={x} pedido={p} />
              </div>
            ))}
        </div>
        <aside className="no-print card h-fit p-5 text-sm">
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
              ["Criado em", dateTime(p.createdAt)],
              ["Pagamento", `${label(p.pagamentos[0].metodo)} · ${label(p.pagamentos[0].status)}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4">
            <div className="flex justify-between"><span className="text-slate-500">Passagens</span><span className="tabular-nums">{money(p.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Taxas de embarque</span><span className="tabular-nums">{money(p.taxas)}</span></div>
            {p.comissaoAgencia > 0 && <div className="flex justify-between"><span className="text-slate-500">Comissão agência</span><span className="tabular-nums">−{money(p.comissaoAgencia)}</span></div>}
            <div className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular-nums">{money(p.total)}</span></div>
          </div>
        </aside>
      </div>
    </>
  );
}
