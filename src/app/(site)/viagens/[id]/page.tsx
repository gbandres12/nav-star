import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BookingFlow } from "@/components/booking-flow";
import { TripSummary } from "@/components/trip-summary";
import { viagem, assentosOcupados } from "@/lib/data/viagens";
import { embarcacao as getEmbarcacao, linha as getLinha } from "@/lib/data/catalogo";
import { tarifaViagem, acrescimosEmbarcacao, livresSemAcrescimo, lugaresLivres, getConfig, horarioParada, mapaComodos, paradaInfo } from "@/lib/data/utils";

export const metadata = { title: "Comprar passagem" };

export default async function EscolherPoltrona({ params, searchParams }: PageProps<"/viagens/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await viagem(id);
  if (!v) notFound();
  const l = await getLinha(v.linhaId);
  if (!l) notFound();
  const o = Number(sp.o ?? 0);
  const d = Number(sp.d ?? l.paradas.length - 1);
  if (!(Number.isInteger(o) && Number.isInteger(d) && o >= 0 && d < l.paradas.length && o < d)) notFound();

  const saida = await horarioParada(v, o);
  const chegada = await horarioParada(v, d);
  const encerrada = saida <= new Date() || v.status === "CANCELADA" || !v.vendasAbertas;
  const origem = await paradaInfo(l.id, o);
  const destino = await paradaInfo(l.id, d);
  const e = (await getEmbarcacao(v.embarcacaoId))!;

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
          valor={await tarifaViagem(v, o, d)}
          taxa={origem.porto.taxaEmbarque}
          assentos={e.assentos}
          colunas={e.colunasMapa}
          ocupados={[...(await assentosOcupados(v.id, o, d))]}
          canal="SITE"
          descontos={(await getConfig()).valores.descontos}
          acrescimos={await acrescimosEmbarcacao(e.id)}
          livresSemAcrescimo={await livresSemAcrescimo(v.id, o, d)}
          livres={await lugaresLivres(v, o, d)}
          assentoLivre={!!e.assentoLivre}
          comodos={await mapaComodos(e.id)}
          resumo={<TripSummary origem={origem} destino={destino} saida={saida} chegada={chegada} embarcacao={e.nome} />}
        />
      )}
    </div>
  );
}
