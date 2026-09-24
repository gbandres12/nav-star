import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, PackageCheck, QrCode, ShieldCheck, Smartphone, Ticket } from "lucide-react";
import { FestivalCard } from "@/components/site/festival-card";
import { SearchForm } from "@/components/site/search-form";
import { cidade as getCidade } from "@/lib/data/catalogo";
import { cidadesAtendidas, horarioParada, lugaresLivres, opcoesFestival, paradaInfo, proximasSaidas, tarifaViagem } from "@/lib/data/utils";
import { festivaisNoSite } from "@/lib/data/festivais";
import { proximasDatasCalendario } from "@/lib/data/calendario";
import { CalendarioViagens } from "@/components/site/calendario-viagens";
import { embarcacoes, linhas } from "@/lib/data/catalogo";
import fotoAerea from "@/assets/lancha/lancha-aerea.webp";
import fotoChegada from "@/assets/lancha/lancha-chegada.webp";
import fotoLateral from "@/assets/lancha/lancha-lateral.webp";
import { duration, localDayKey, longDay, money, time } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cidades = await cidadesAtendidas();
  const hoje = localDayKey(new Date());
  const allLinhas = await linhas();
  const principal = allLinhas[0];
  const saidas = await proximasSaidas(4);
  const festivais = (await festivaisNoSite()).slice(0, 2);
  const lancha = (await embarcacoes()).find((e) => e.status === "ATIVA");
  const rotasPrincipais = [
    { origem: "manaus", destino: "santarem", titulo: "Manaus → Santarém" },
    { origem: "santarem", destino: "manaus", titulo: "Santarém → Manaus" },
  ].filter((rota) => cidades.some((cidade) => cidade.id === rota.origem) && cidades.some((cidade) => cidade.id === rota.destino));
  const datasPrincipais = await Promise.all(rotasPrincipais.map(async (rota) => ({
    ...rota,
    viagens: await proximasDatasCalendario(rota.origem, rota.destino),
  })));

  return (
    <>
      <section className="wave-bg relative isolate overflow-hidden bg-rio-950 pb-28 text-white">
        {/* Foto vertical: no celular cobre o fundo; no computador fica na metade direita, fundindo com o azul */}
        <div className="absolute inset-0 -z-10 lg:left-[42%]" aria-hidden>
          <Image src={fotoLateral} alt="" fill priority placeholder="blur" sizes="(min-width: 1024px) 58vw, 100vw" className="object-cover object-[50%_48%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-rio-950/90 via-rio-950/75 to-rio-950/95 lg:bg-gradient-to-r lg:from-rio-950 lg:via-rio-950/45 lg:to-rio-950/5" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-rio-950/70 to-transparent" />
        </div>
        <div className="mx-auto max-w-6xl px-4 pt-14 sm:pt-20 lg:pb-10">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-rio-300">
            <ShieldCheck size={14} /> Venda oficial da empresa
          </p>
          <h1 className="max-w-2xl text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl">
            De Manaus a Santarém <span className="text-rio-400">pelo rio</span>, com a poltrona garantida.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-rio-100">
            Compre sua passagem de lancha online, escolha a poltrona e embarque com o bilhete com QR Code no celular.
          </p>
        </div>
        <svg className="absolute right-0 bottom-0 left-0 h-16 w-full text-[#f5f7fb]" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0 40c120 20 240 30 360 20s240-40 360-40 240 30 360 40 240-10 360-20v80H0z" />
        </svg>
      </section>

      <div className="relative z-10 mx-auto -mt-24 max-w-6xl px-4">
        <div className="card p-5 shadow-xl shadow-rio-950/10 sm:p-6">
          <SearchForm cidades={cidades} hoje={hoje} />
        </div>
      </div>

      {festivais.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Festivais</h2>
              <p className="text-sm text-slate-500">Viagens especiais para as festas da região</p>
            </div>
            <Link href="/festivais" className="hidden items-center gap-1 text-sm font-semibold text-rio-700 hover:underline sm:flex">
              Todos <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {await Promise.all(festivais.map(async (f) => {
              const { ida, volta } = await opcoesFestival(f);
              const menor = Math.min(...[...ida, ...volta].map((o) => o.valor));
              const fCidade = await getCidade(f.cidadeId);
              return <FestivalCard key={f.id} f={f} cidade={fCidade?.nome || ""} aPartirDe={Number.isFinite(menor) ? money(menor) : undefined} />;
            }))}
          </div>
        </section>
      )}

      {datasPrincipais.some((rota) => rota.viagens.length > 0) && (
        <section className="mx-auto max-w-6xl px-4 pt-14">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Próximas datas</h2>
              <p className="text-sm text-slate-500">Consulte as saídas disponíveis por rota</p>
            </div>
            <Link href="/viagens" className="hidden items-center gap-1 text-sm font-semibold text-rio-700 hover:underline sm:flex">
              Calendário completo <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {datasPrincipais.map((rota) => (
              <CalendarioViagens key={`${rota.origem}-${rota.destino}`} origem={rota.origem} destino={rota.destino} mes={localDayKey(new Date()).slice(0, 7)} viagens={rota.viagens} compact titulo={rota.titulo} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Próximas saídas</h2>
            <p className="text-sm text-slate-500">Lugares disponíveis para a viagem completa</p>
          </div>
          <Link href="/viagens" className="hidden items-center gap-1 text-sm font-semibold text-rio-700 hover:underline sm:flex">
            Ver todas <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {await Promise.all(saidas.map(async (v) => {
            const l = allLinhas.find(x => x.id === v.linhaId)!;
            const ult = l.paradas.length - 1;
            const o = await paradaInfo(l.id, 0);
            const d = await paradaInfo(l.id, ult);
            const livres = await lugaresLivres(v, 0, ult);
            const horario = await horarioParada(v, ult);
            const tarifa = await tarifaViagem(v, 0, ult);
            return (
              <Link
                key={v.id}
                href={`/viagens/${v.id}?o=0&d=${ult}`}
                className="card group p-5 transition hover:-translate-y-0.5 hover:border-rio-300 hover:shadow-lg"
              >
                <p className="text-xs font-semibold text-slate-500">{longDay(v.partida)}</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {o.cidade.nome} <span className="text-slate-400">→</span> {d.cidade.nome}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                  <Clock size={14} /> {time(v.partida)} · chega {time(horario)}
                </p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-slate-500">viagem completa</p>
                    <p className="text-xl font-extrabold text-rio-800">{money(tarifa)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${livres < 15 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {livres} lugares
                  </span>
                </div>
              </Link>
            );
          }))}
        </div>
      </section>

      <section className="overflow-hidden bg-rio-950 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-[1fr_1.35fr]">
          <div>
            <p className="text-sm font-semibold tracking-wide text-rio-300 uppercase">Conheça a lancha</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{lancha?.nome ?? "São Tomé Expresso"}</h2>
            <p className="mt-3 max-w-md text-rio-100">
              Rápida e confortável pelo rio Amazonas, ligando Manaus a Santarém com paradas nas cidades do caminho.
            </p>
            <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                lancha && { v: String(lancha.capacidadePassageiros), l: "poltronas numeradas" },
                principal && { v: String(principal.paradas.length), l: "cidades na rota" },
                principal && principal.paradas.length > 1 && { v: duration(principal.paradas[principal.paradas.length - 1].minutosDesdeOrigem), l: "de Manaus a Santarém" },
              ]
                .filter((x): x is { v: string; l: string } => !!x)
                .map((x) => (
                  <div key={x.l}>
                    <dt className="sr-only">{x.l}</dt>
                    <dd className="text-2xl font-extrabold tabular-nums">{x.v}</dd>
                    <dd className="text-xs text-rio-300">{x.l}</dd>
                  </div>
                ))}
            </dl>
          </div>
          {/* No celular as fotos deslizam de lado; a partir de sm ficam lado a lado, com a do meio deslocada */}
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
            {[
              { foto: fotoLateral, alt: "Lancha São Tomé Expresso navegando no rio, vista de lado" },
              { foto: fotoChegada, alt: "Lancha São Tomé Expresso chegando à cidade pelo rio" },
              { foto: fotoAerea, alt: "Lancha São Tomé Expresso vista do alto, navegando" },
            ].map((x, i) => (
              <li key={x.alt} className={`relative aspect-[3/4] w-[70%] shrink-0 snap-center overflow-hidden rounded-2xl shadow-2xl shadow-black/30 ring-1 ring-white/10 sm:w-auto ${i === 1 ? "sm:translate-y-8" : ""}`}>
                <Image src={x.foto} alt={x.alt} fill placeholder="blur" sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 70vw" className="object-cover" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {principal && principal.paradas.length > 1 && (
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight">Nossa rota</h2>
          <p className="text-sm text-slate-500">Embarque ou desembarque em qualquer parada. Valores a partir de Manaus.</p>
          <div className="mt-8 overflow-x-auto pb-2">
            <ol className="relative flex min-w-[720px] justify-between">
              <div className="absolute top-[18px] right-[4%] left-[4%] h-1 rounded-full bg-gradient-to-r from-rio-300 via-rio-500 to-rio-700" />
              {await Promise.all(principal.paradas.map(async (p, i) => {
                const info = await paradaInfo(principal.id, p.ordem);
                return (
                  <li key={p.ordem} className="relative flex w-1/6 flex-col items-center text-center">
                    <span className={`z-10 grid h-10 w-10 place-items-center rounded-full border-4 border-white text-sm font-bold shadow ${i === 0 || i === principal.paradas.length - 1 ? "bg-rubro-500 text-white" : "bg-rio-600 text-white"}`}>
                      {i + 1}
                    </span>
                    <p className="mt-3 font-bold text-slate-900">{info.cidade.nome}</p>
                    <p className="text-xs text-slate-500">{info.porto.nome}</p>
                    {i > 0 && (
                      <>
                        <p className="mt-2 text-sm font-bold text-rio-700">{money(principal.tarifas[0]?.[i] ?? 0)}</p>
                        <p className="text-xs text-slate-500">{duration(p.minutosDesdeOrigem)}</p>
                      </>
                    )}
                  </li>
                );
              }))}
            </ol>
          </div>
        </div>
      </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: <Ticket />, t: "Escolha a poltrona", d: "Veja o mapa da lancha e escolha onde vai sentar — janela, corredor ou preferencial." },
            { icon: <Smartphone />, t: "Pague com PIX", d: "QR Code com o valor certo. Depois de conferido o pagamento, o bilhete fica disponível no seu pedido." },
            { icon: <QrCode />, t: "Embarque com QR Code", d: "Apresente o QR Code e um documento com foto no porto. Sem fila no guichê." },
          ].map((x) => (
            <div key={x.t} className="card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-rubro-50 text-rubro-500">{x.icon}</span>
              <h3 className="mt-4 font-bold">{x.t}</h3>
              <p className="mt-1 text-sm text-slate-600">{x.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-rio-900 p-8 text-white sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-rio-300">
              <PackageCheck />
            </span>
            <div>
              <h3 className="text-lg font-bold">Enviou uma encomenda?</h3>
              <p className="text-sm text-rio-200">Acompanhe pelo código que está no seu comprovante.</p>
            </div>
          </div>
          <Link href="/rastreio" className="btn-sol">
            Rastrear encomenda <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
