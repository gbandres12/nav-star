import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BookingFlow } from "@/components/booking-flow";
import { TripSummary } from "@/components/trip-summary";
import { embarcacao as getEmbarcacao, linha as getLinha } from "@/lib/data/catalogo";
import { configPix } from "@/lib/data/pix";
import { acrescimosEmbarcacao, getConfig, horarioParada, livresSemAcrescimo, lugaresLivres, mapaComodos, paradaInfo, tarifaViagem } from "@/lib/data/utils";
import { assentosOcupados, viagem } from "@/lib/data/viagens";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Nova venda" };

export default async function VenderViagem({ params, searchParams }: PageProps<"/admin/vender/[id]">) {
  await garantirAcesso("/admin/vender");
  const { id } = await params;
  const sp = await searchParams;
  const v = await viagem(id);
  if (!v) notFound();
  const l = await getLinha(v.linhaId);
  if (!l) notFound();
  const o = Number(sp.o ?? 0);
  const d = Number(sp.d ?? l.paradas.length - 1);
  if (!(Number.isInteger(o) && Number.isInteger(d) && o >= 0 && d < l.paradas.length && o < d)) notFound();

  const [origem, destino, e, saida, chegada, config, pix] = await Promise.all([
    paradaInfo(l.id, o),
    paradaInfo(l.id, d),
    getEmbarcacao(v.embarcacaoId),
    horarioParada(v, o),
    horarioParada(v, d),
    getConfig(),
    configPix(),
  ]);
  if (!e) notFound();
  const encerrada = saida <= new Date() || v.status === "CANCELADA" || !v.vendasAbertas;

  return (
    <>
      <Link href={`/admin/vender?origem=${origem.cidade.id}&destino=${destino.cidade.id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Voltar
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        Venda: {origem.cidade.nome} → {destino.cidade.nome}
      </h1>
      {encerrada ? (
        <div className="card p-8 text-center">
          <p className="text-lg font-bold">Vendas encerradas para esta saída.</p>
          <p className="mt-1 text-sm text-slate-500">A viagem já partiu, foi cancelada ou teve as vendas fechadas.</p>
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
          canal="BALCAO"
          descontos={config.valores.descontos}
          acrescimos={await acrescimosEmbarcacao(e.id)}
          livresSemAcrescimo={await livresSemAcrescimo(v.id, o, d)}
          livres={await lugaresLivres(v, o, d)}
          assentoLivre={!!e.assentoLivre}
          comodos={await mapaComodos(e.id)}
          pix={pix.recebedor}
          resumo={<TripSummary origem={origem} destino={destino} saida={saida} chegada={chegada} embarcacao={e.nome} />}
        />
      )}
    </>
  );
}
