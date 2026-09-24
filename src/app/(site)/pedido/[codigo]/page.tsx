import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, CircleX, Download, MessageCircle, Smartphone } from "lucide-react";
import { PagamentoEmConferencia, PixPayment } from "@/components/pix-payment";
import { BilheteTermico } from "@/components/bilhete-termico";
import { pedidoCompleto } from "@/lib/data/pedidos";
import { configPix } from "@/lib/data/pix";
import { getConfig } from "@/lib/data/utils";
import { money } from "@/lib/format";
import { brCodePix } from "@/lib/pix";

export const metadata = { title: "Seu pedido", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PedidoPage({ params }: PageProps<"/pedido/[codigo]">) {
  const { codigo } = await params;
  const pedido = await pedidoCompleto(codigo);
  if (!pedido) notFound();
  const [config, pix] = await Promise.all([getConfig(), configPix()]);
  const EMPRESA = config.empresa;
  const emitidas = pedido.passagens.filter((p) => p.status === "EMITIDA" || p.status === "EMBARCADA");
  // Código do pedido sem hífen vira o identificador no extrato do banco
  const copiaCola = pix.recebedor ? brCodePix(pix.recebedor, { valor: pedido.total, txid: pedido.codigo }) : null;
  const falarComEmpresa = (texto: string) => `https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(texto)}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-center text-sm text-slate-500">
        Pedido <span className="font-mono font-semibold text-slate-800">{pedido.codigo}</span>
      </p>

      {pedido.status === "AGUARDANDO_PAGAMENTO" && pedido.expiraEm && (
        <div className="mt-4">
          {pedido.pagamentoInformadoEm ? (
            <PagamentoEmConferencia codigo={pedido.codigo} expiraEm={pedido.expiraEm} whatsapp={EMPRESA.whatsapp} />
          ) : copiaCola ? (
            <>
              <h1 className="mb-6 text-center text-2xl font-bold">Falta pouco! Finalize o pagamento</h1>
              <PixPayment
                codigo={pedido.codigo}
                copiaCola={copiaCola}
                expiraEm={pedido.expiraEm}
                total={money(pedido.total)}
                whatsapp={EMPRESA.whatsapp}
                simulado={process.env.NODE_ENV !== "production" && process.env.PAGAMENTO_SIMULADO === "true"}
              />
            </>
          ) : (
            <div className="card mx-auto max-w-md p-6 text-center">
              <h1 className="text-xl font-bold">Poltronas reservadas</h1>
              <p className="mt-1 text-3xl font-extrabold text-rio-900">{money(pedido.total)}</p>
              <p className="mt-2 text-sm text-slate-600">Fale com a empresa pelo WhatsApp para receber os dados de pagamento.</p>
              <a className="btn-sol mt-5" href={falarComEmpresa(`Olá! Quero pagar o pedido ${pedido.codigo} (${money(pedido.total)}).`)}>
                <MessageCircle size={16} /> Pagar pelo WhatsApp
              </a>
            </div>
          )}
        </div>
      )}

      {(pedido.status === "EXPIRADO" || pedido.status === "CANCELADO" || pedido.status === "REEMBOLSADO") && (
        <div className="card mt-4 p-8 text-center">
          <CircleX className="mx-auto text-red-500" size={44} />
          <h1 className="mt-3 text-xl font-bold">{pedido.status === "EXPIRADO" ? "Reserva expirada" : "Pedido cancelado"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {pedido.status === "EXPIRADO"
              ? "O pagamento não foi confirmado a tempo e as poltronas foram liberadas."
              : "Este pedido foi cancelado e as poltronas foram liberadas."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/viagens" className="btn-sol">Fazer nova busca</Link>
            <a className="btn-ghost" href={falarComEmpresa(`Olá! Tenho uma dúvida sobre o pedido ${pedido.codigo}.`)}>
              <MessageCircle size={16} /> Falar com a empresa
            </a>
          </div>
        </div>
      )}

      {pedido.status === "PAGO" && (
        <>
          <div className="no-print mt-4 text-center">
            <CircleCheck className="mx-auto text-emerald-500" size={48} />
            <h1 className="mt-3 text-2xl font-bold">Pagamento confirmado. Boa viagem!</h1>
            <p className="mt-1 text-sm text-slate-500">
              {emitidas.length > 1 ? "Seus bilhetes estão" : "Seu bilhete está"} logo abaixo. Guarde este link ou baixe em PDF.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href={`/bilhete/${pedido.codigo}?imprimir=1`} className="btn-primary">
                <Download size={16} /> Baixar / imprimir bilhete
              </Link>
              <a className="btn-ghost" href={falarComEmpresa(`Olá! Tenho uma dúvida sobre o pedido ${pedido.codigo}`)}>
                <MessageCircle size={16} /> Falar com a empresa
              </a>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6">
            {emitidas.map((p) => (
              <div key={p.id} className="rounded-sm shadow-lg ring-1 ring-slate-200">
                <BilheteTermico passagem={p} pedido={pedido} config={config} />
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
