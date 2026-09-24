import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BilheteTermico } from "@/components/bilhete-termico";
import { AutoPrint } from "@/components/auto-print";
import { PrintButton } from "@/components/print-button";
import { PrintBilheteButton } from "@/components/print-bilhete-button";
import { pedidoCompleto } from "@/lib/data/pedidos";
import { getConfig } from "@/lib/data/utils";

export const metadata = { title: "Bilhete", robots: { index: false } };

/** Página só com os bilhetes, pronta para a impressora térmica ou "Salvar como PDF" */
export default async function BilhetePage({ params, searchParams }: PageProps<"/bilhete/[codigo]">) {
  const { codigo } = await params;
  const sp = await searchParams;
  const pedido = await pedidoCompleto(codigo);
  if (!pedido) notFound();
  const passagens = pedido.passagens.filter((p) => p.status === "EMITIDA" || p.status === "EMBARCADA");
  const config = await getConfig();
  const voltar = typeof sp.voltar === "string" && sp.voltar.startsWith("/") ? sp.voltar : `/pedido/${pedido.codigo}`;

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-3">
        <Link href={voltar} className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-rio-700">
          <ChevronLeft size={16} /> Voltar
        </Link>
        <p className="hidden text-sm text-slate-500 sm:block">
          {passagens.length} bilhete(s) · papel {config.bilhete.larguraMm} mm — na impressão escolha a impressora térmica ou “Salvar como PDF”
        </p>
        {voltar.startsWith("/admin") ? <PrintBilheteButton codigo={pedido.codigo} /> : <PrintButton label="Imprimir" />}
      </div>

      {pedido.status !== "PAGO" || passagens.length === 0 ? (
        <p className="p-10 text-center text-slate-600">Os bilhetes ficam disponíveis após a confirmação do pagamento.</p>
      ) : (
        <div className="flex flex-col items-center gap-6 py-8 print:block print:py-0">
          {passagens.map((p) => (
            <div key={p.id} className="shadow-lg print:shadow-none">
              <BilheteTermico passagem={p} pedido={pedido} config={config} />
            </div>
          ))}
          {sp.imprimir === "1" && <AutoPrint codigoPedido={pedido.codigo} />}
        </div>
      )}
    </div>
  );
}
