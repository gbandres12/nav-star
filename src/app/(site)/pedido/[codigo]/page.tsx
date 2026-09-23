import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, CircleX, Download, MessageCircle, Smartphone } from "lucide-react";
import { PixPayment } from "@/components/pix-payment";
import { BilheteTermico } from "@/components/bilhete-termico";
import { passagensDoPedido, pedidoPorCodigo } from "@/lib/data/pedidos";
import { getConfig } from "@/lib/data/utils";
import { money } from "@/lib/format";

export const metadata = { title: "Seu pedido" };

export default async function PedidoPage({ params }: PageProps<"/pedido/[codigo]">) {
  const { codigo } = await params;
  const pedido = await pedidoPorCodigo(codigo);
  if (!pedido) notFound();
  const passagens = await passagensDoPedido(pedido.id);
  const pg = pedido.pagamentos[0];
  const config = await getConfig();
  const EMPRESA = config.empresa;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-center text-sm text-slate-500">
        Pedido <span className="font-mono font-semibold text-slate-800">{pedido.codigo}</span>
      </p>

      {pedido.status === "AGUARDANDO_PAGAMENTO" && (
        <div className="mt-4">
          <h1 className="mb-6 text-center text-2xl font-bold">Falta pouco! Finalize o pagamento</h1>
          <PixPayment codigo={pedido.codigo} copiaCola={pg.pixCopiaCola ?? pedido.codigo} expiraEm={pedido.expiraEm!} total={money(pedido.total)} />
        </div>
      )}

      {(pedido.status === "EXPIRADO" || pedido.status === "CANCELADO") && (
        <div className="card mt-4 p-8 text-center">
          <CircleX className="mx-auto text-red-500" size={44} />
          <h1 className="mt-3 text-xl font-bold">Reserva expirada</h1>
          <p className="mt-1 text-sm text-slate-500">O pagamento não foi confirmado a tempo e as poltronas foram liberadas.</p>
          <Link href="/viagens" className="btn-sol mt-5">Fazer nova busca</Link>
        </div>
      )}

      {pedido.status === "PAGO" && (
        <>
          <div className="no-print mt-4 text-center">
            <CircleCheck className="mx-auto text-emerald-500" size={48} />
            <h1 className="mt-3 text-2xl font-bold">Pagamento confirmado. Boa viagem!</h1>
            <p className="mt-1 text-sm text-slate-500">
              Enviamos {passagens.length > 1 ? "os bilhetes" : "o bilhete"} para {pedido.compradorTelefone}
              {pedido.compradorEmail ? ` e ${pedido.compradorEmail}` : ""}.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href={`/bilhete/${pedido.codigo}?imprimir=1`} className="btn-primary">
                <Download size={16} /> Baixar / imprimir bilhete
              </Link>
              <a className="btn-ghost" href={`https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre o pedido ${pedido.codigo}`)}`}>
                <MessageCircle size={16} /> Falar com a empresa
              </a>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6">
            {passagens.map((p) => (
              <div key={p.id} className="rounded-sm shadow-lg ring-1 ring-slate-200">
                <BilheteTermico passagem={p} pedido={pedido} />
              </div>
            ))}
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <Smartphone size={14} /> Não precisa imprimir: o bilhete no celular é aceito no embarque.
          </p>
        </>
      )}
    </div>
  );
}
