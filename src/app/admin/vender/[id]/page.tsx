import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BookingFlow } from "@/components/booking-flow";
import { TripSummary } from "@/components/trip-summary";
import { tarifaViagem, acrescimosEmbarcacao, assentosOcupados, livresSemAcrescimo, lugaresLivres, caixaAberto, config, db, embarcacao, horarioParada, linha, mapaComodos, paradaInfo, viagem } from "@/lib/store";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Nova venda" };

export default async function VenderViagem({ params, searchParams }: PageProps<"/admin/vender/[id]">) {
  const op = await garantirAcesso("/admin/vender");
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
      {!caixaAberto(op.id) && (
        <p className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Seu caixa está fechado: vendas em dinheiro ficam bloqueadas.
          <Link href="/admin/caixa" className="font-semibold underline">Abrir caixa</Link>
        </p>
      )}
      <BookingFlow
        viagemId={v.id}
        origemOrdem={o}
        destinoOrdem={d}
        valor={tarifaViagem(v, o, d)}
        taxa={origem.porto.taxaEmbarque}
        assentos={e.assentos}
        colunas={e.colunasMapa}
        ocupados={[...assentosOcupados(v.id, o, d)]}
        canal="BALCAO"
        descontos={config().valores.descontos}
        acrescimos={acrescimosEmbarcacao(e.id)}
        livresSemAcrescimo={livresSemAcrescimo(v.id, o, d)}
        livres={lugaresLivres(v, o, d)}
        assentoLivre={!!e.assentoLivre}
        comodos={mapaComodos(e.id)}
        convenios={db().convenios.filter((c) => c.ativo).map(({ id, nome, descontoPercentual, faturado }) => ({ id, nome, descontoPercentual, faturado }))}
        resumo={<TripSummary origem={origem} destino={destino} saida={horarioParada(v, o)} chegada={horarioParada(v, d)} embarcacao={e.nome} />}
      />
    </>
  );
}
