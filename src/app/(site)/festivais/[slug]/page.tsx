import Image from "next/image";
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
  if (!f) return { title: "Festival" };
  const capa = f.fotos?.[0];
  return { title: f.nome, description: f.chamada || f.descricao, openGraph: capa ? { images: [capa.url] } : undefined };
}

export default async function FestivalPage({ params }: PageProps<"/festivais/[slug]">) {
  const { slug } = await params;
  const f = (await festivaisNoSite()).find((x) => x.slug === slug);
  if (!f) notFound();
  const c = (await getCidade(f.cidadeId))!;
  const cor = COR_FESTIVAL[f.cor];
  const { ida, volta } = await opcoesFestival(f);
  const [capa, ...galeria] = f.fotos ?? [];
  // Sobre a foto, o texto claro da cor do festival pode perder contraste: usa branco
  const textoCor = capa ? "text-white/90" : cor.texto;

  return (
    <>
      <section className={`relative isolate overflow-hidden bg-gradient-to-br ${cor.fundo} text-white`}>
        {capa && (
          <>
            <Image src={capa.url} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/55 to-black/30" aria-hidden />
          </>
        )}
        <div className={`mx-auto max-w-6xl px-4 ${capa ? "pt-12 pb-14 sm:pt-24" : "py-12"}`}>
          <Link href="/festivais" className={`mb-6 inline-flex items-center gap-1 text-sm font-medium ${textoCor} hover:underline`}><ChevronLeft size={16} /> Festivais</Link>
          <p className={`flex flex-wrap items-center gap-4 text-sm font-semibold ${textoCor}`}>
            <span className="flex items-center gap-1"><CalendarDays size={16} /> {periodoFestival(f)}</span>
            <span className="flex items-center gap-1"><MapPin size={16} /> {c.nome}/{c.uf}</span>
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{f.nome}</h1>
          {f.chamada && <p className={`mt-2 text-lg ${textoCor}`}>{f.chamada}</p>}
          {f.descricao && <p className="mt-5 max-w-2xl text-white/90">{f.descricao}</p>}
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
        {galeria.length > 0 && (
          <section aria-label="Fotos do festival">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {galeria.map((foto, i) => (
                <li key={foto.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                  <Image src={foto.url} alt={`${f.nome}, foto ${i + 2}`} fill sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw" className="object-cover" />
                </li>
              ))}
            </ul>
          </section>
        )}
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
