import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronLeft, Clock, MapPin } from "lucide-react";
import { COR_FESTIVAL, periodoFestival } from "@/components/site/festival-card";
import { Empty } from "@/components/ui";
import { cidade as getCidade } from "@/lib/data/catalogo";
import { festivaisNoSite } from "@/lib/data/festivais";
import { opcoesFestival, type OpcaoFestival } from "@/lib/data/utils";
import { dateShort, duration, money, time, weekday } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/festivais/[slug]">) {
  const { slug } = await params;
  const f = (await festivaisNoSite()).find((x) => x.slug === slug);
  return f ? { title: f.nome, description: f.chamada || f.descricao } : { title: "Festival" };
}

export default async function FestivalPage({ params }: PageProps<"/festivais/[slug]">) {
  const { slug } = await params;
  const f = (await festivaisNoSite()).find((x) => x.slug === slug);
  if (!f) notFound();
  const c = (await getCidade(f.cidadeId))!;
  const cor = COR_FESTIVAL[f.cor];
  const { ida, volta } = await opcoesFestival(f);

  return (
    <>
      <section className={`bg-gradient-to-br ${cor.fundo} text-white`}>
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Link href="/festivais" className={`mb-6 inline-flex items-center gap-1 text-sm font-medium ${cor.texto} hover:underline`}><ChevronLeft size={16} /> Festivais</Link>
          <p className={`flex flex-wrap items-center gap-4 text-sm font-semibold ${cor.texto}`}>
            <span className="flex items-center gap-1"><CalendarDays size={16} /> {periodoFestival(f)}</span>
            <span className="flex items-center gap-1"><MapPin size={16} /> {c.nome}/{c.uf}</span>
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{f.nome}</h1>
          {f.chamada && <p className={`mt-2 text-lg ${cor.texto}`}>{f.chamada}</p>}
          {f.descricao && <p className="mt-5 max-w-2xl text-white/90">{f.descricao}</p>}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
        <Bloco titulo={`Ida para ${c.nome}`} vazio={`Sem saídas para ${c.nome} à venda.`} opcoes={ida} />
        <Bloco titulo={`Volta de ${c.nome}`} vazio={`Sem saídas de ${c.nome} à venda.`} opcoes={volta} />
        <p className="text-xs text-slate-500">
          Valores por passageiro; taxa de embarque do porto cobrada à parte. Crianças, idosos, estudantes e PCD têm os descontos habituais.
        </p>
      </div>
    </>
  );
}

function Bloco({ titulo, vazio, opcoes }: { titulo: string; vazio: string; opcoes: OpcaoFestival[] }) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold tracking-tight">{titulo}</h2>
      {opcoes.length === 0 ? (
        <Empty>{vazio}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {opcoes.map((o) => {
            const esgotado = o.livres === 0;
            return (
              <div key={`${o.viagem.id}-${o.origem}-${o.destino}`} className="card flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-xs font-semibold text-slate-500 capitalize">{weekday(o.saida)} {dateShort(o.saida)}</p>
                  <p className="mt-1 text-lg font-bold">{o.de} <span className="text-slate-400">→</span> {o.para}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <Clock size={14} /> {time(o.saida)} · chega {dateShort(o.chegada)} {time(o.chegada)} · {duration((o.chegada.getTime() - o.saida.getTime()) / 60_000)}
                  </p>
                  <p className={`mt-1 text-xs font-semibold ${o.livres < 15 ? "text-red-600" : "text-emerald-600"}`}>{esgotado ? "Esgotado" : `${o.livres} lugares`}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-rio-800 tabular-nums">{money(o.valor)}</p>
                  {o.taxa > 0 && <p className="text-xs text-slate-500">+ {money(o.taxa)} taxa</p>}
                  {esgotado ? (
                    <span className="btn-ghost pointer-events-none mt-2 opacity-60">Esgotado</span>
                  ) : (
                    <Link href={`/viagens/${o.viagem.id}?o=${o.origem}&d=${o.destino}`} className="btn-sol mt-2">Comprar <ArrowRight size={16} /></Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
