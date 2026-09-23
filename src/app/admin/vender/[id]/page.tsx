import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BookingFlow } from "@/components/booking-flow";
import { TripSummary } from "@/components/trip-summary";
import { assentosOcupados, embarcacao, horarioParada, linha, paradaInfo, viagem } from "@/lib/store";

export const metadata = { title: "Nova venda" };

export default async function VenderViagem({ params, searchParams }: PageProps<"/admin/vender/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const v = viagem(id);
  if (!v) notFound();
  const l = linha(v.linhaId);
  const o = Number(sp.o ?? 0);
  const d = Number(sp.d ?? l.paradas.length - 1);
  if (!(Number.isInteger(o) && Number.isInteger(d) && o >= 0 && d < l.paradas.length && o < d)) notFound();
  const origem = paradaInfo(l.id, o);
  const destino = paradaInfo(l.id, d);
  const e = embarcacao(v.embarcacaoId);

  return (
    <>
      <Link href="/admin/vender" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Voltar
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        Venda: {origem.cidade.nome} → {destino.cidade.nome}
      </h1>
      <BookingFlow
        viagemId={v.id}
        origemOrdem={o}
        destinoOrdem={d}
        valor={l.tarifas[o][d]}
        taxa={origem.porto.taxaEmbarque}
        assentos={e.assentos}
        colunas={e.colunasMapa}
        ocupados={[...assentosOcupados(v.id, o, d)]}
        canal="BALCAO"
        vendedorId="u-balcao-mao"
        resumo={<TripSummary origem={origem} destino={destino} saida={horarioParada(v, o)} chegada={horarioParada(v, d)} embarcacao={e.nome} />}
      />
    </>
  );
}
