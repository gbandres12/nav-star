import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BookingFlow } from "@/components/booking-flow";
import { TripSummary } from "@/components/trip-summary";
import { assentosOcupados, embarcacao, horarioParada, linha, paradaInfo, viagem } from "@/lib/store";

export const metadata = { title: "Escolha sua poltrona" };

export default async function EscolherPoltrona({ params, searchParams }: PageProps<"/viagens/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const v = viagem(id);
  if (!v) notFound();
  const l = linha(v.linhaId);
  const o = Number(sp.o ?? 0);
  const d = Number(sp.d ?? l.paradas.length - 1);
  if (!(Number.isInteger(o) && Number.isInteger(d) && o >= 0 && d < l.paradas.length && o < d)) notFound();

  const saida = horarioParada(v, o);
  const encerrada = saida <= new Date() || v.status === "CANCELADA" || !v.vendasAbertas;
  const origem = paradaInfo(l.id, o);
  const destino = paradaInfo(l.id, d);
  const e = embarcacao(v.embarcacaoId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`/viagens?origem=${origem.cidade.id}&destino=${destino.cidade.id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Voltar para os horários
      </Link>
      {encerrada ? (
        <div className="card p-8 text-center">
          <p className="text-lg font-bold">Vendas encerradas para esta saída.</p>
          <p className="mt-1 text-sm text-slate-500">Escolha outra data na lista de horários.</p>
        </div>
      ) : (
        <BookingFlow
          viagemId={v.id}
          origemOrdem={o}
          destinoOrdem={d}
          valor={l.tarifas[o][d]}
          taxa={origem.porto.taxaEmbarque}
          assentos={e.assentos}
          colunas={e.colunasMapa}
          ocupados={[...assentosOcupados(v.id, o, d)]}
          canal="SITE"
          resumo={<TripSummary origem={origem} destino={destino} saida={saida} chegada={horarioParada(v, d)} embarcacao={e.nome} />}
        />
      )}
    </div>
  );
}
