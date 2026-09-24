import Link from "next/link";
import { ArrowRight, Clock, MapPin, Ship } from "lucide-react";
import { SearchForm } from "@/components/site/search-form";
import { Empty } from "@/components/ui";
import { buscarViagens } from "@/lib/data/viagens";
import { cidade as getCidade } from "@/lib/data/catalogo";
import { cidadesAtendidas } from "@/lib/data/utils";
import { festivalDaViagem } from "@/lib/data/festivais";
import { calendarioViagens, mesAtual, mesValido } from "@/lib/data/calendario";
import { CalendarioViagens } from "@/components/site/calendario-viagens";
import { dateShort, duration, localDayKey, longDay, money, time, weekday } from "@/lib/format";

export const metadata = { title: "Passagens" };

export default async function Viagens({ searchParams }: PageProps<"/viagens">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const cidades = await cidadesAtendidas();
  const valida = (id?: string) => (id && cidades.some((c) => c.id === id) ? id : undefined);
  const origem = valida(str("origem"));
  const destino = valida(str("destino"));
  const data = str("data") && /^\d{4}-\d{2}-\d{2}$/.test(str("data")!) ? str("data") : undefined;

  if (!origem || !destino) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="card mb-6 p-5">
          <SearchForm cidades={cidades} origem={origem} destino={destino} data={data} hoje={localDayKey(new Date())} compact />
        </div>
        <Empty>Escolha as cidades de origem e destino para buscar viagens.</Empty>
      </div>
    );
  }


  const requestedMes = str("mes");
  const mes = mesValido(requestedMes) ? requestedMes : mesAtual();
  const todos = await buscarViagens(origem, destino);
  const calendario = await calendarioViagens(origem, destino, mes);
  const resultados = data ? todos.filter((r) => localDayKey(r.origemHorario) === data) : todos.slice(0, 12);
  const dias = [...new Map(todos.map((r) => [localDayKey(r.origemHorario), r])).values()].slice(0, 10);
  const datasDisponiveis = [...new Set(todos.map((r) => localDayKey(r.origemHorario)))].sort();
  const o = (await getCidade(origem))!;
  const d = (await getCidade(destino))!;
  const qs = (extra: Record<string, string>) => new URLSearchParams({ origem, destino, ...extra }).toString();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="card mb-6 p-5">
        <SearchForm cidades={cidades} origem={origem} destino={destino} data={data} hoje={localDayKey(new Date())} compact datasDisponiveis={datasDisponiveis} />
      </div>

      <h1 className="text-2xl font-bold tracking-tight">
        {o.nome} <span className="text-slate-400">→</span> {d.nome}
      </h1>
      <p className="text-sm text-slate-500">{data ? longDay(`${data}T12:00:00-04:00`) : "Próximas saídas disponíveis"}</p>

      <div className="mt-6">
        <CalendarioViagens origem={origem} destino={destino} mes={mes} viagens={calendario} selectedDay={data} titulo="Escolha a data da viagem" />
      </div>

      {dias.length > 0 && (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          <Link href={`/viagens?${qs({})}`} className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold ${!data ? "border-rio-600 bg-rio-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-rio-300"}`}>
            Todas
          </Link>
          {dias.map((r) => {
            const k = localDayKey(r.origemHorario);
            return (
              <Link key={k} href={`/viagens?${qs({ data: k })}`} className={`shrink-0 rounded-xl border px-4 py-2 text-center text-sm ${data === k ? "border-rio-600 bg-rio-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-rio-300"}`}>
                <span className="block text-xs opacity-80">{weekday(r.origemHorario)}</span>
                <span className="font-semibold">{dateShort(r.origemHorario)}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {origem === destino && <Empty>Escolha cidades de origem e destino diferentes.</Empty>}
        {origem !== destino && resultados.length === 0 && (
          <Empty>
            Nenhuma saída encontrada {data ? "nesta data" : "para este trecho"}.{" "}
            {data && todos.length > 0 && (
              <Link className="font-semibold text-rio-700 underline" href={`/viagens?${qs({})}`}>Ver outras datas</Link>
            )}
          </Empty>
        )}
        {await Promise.all(resultados.map(async (r) => {
          const esgotado = r.lugaresLivres === 0;
          const festival = await festivalDaViagem(r.viagem.id);
          return (
            <div key={r.viagem.id} className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-4 sm:gap-6">
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-500">{weekday(r.origemHorario)} {dateShort(r.origemHorario)}</p>
                  <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{time(r.origemHorario)}</p>
                  <p className="text-xs text-slate-500">{o.nome}</p>
                </div>
                <div className="flex flex-1 flex-col items-center px-2">
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    <Clock size={12} /> {duration(r.duracaoMinutos)}
                  </span>
                  <div className="relative my-1.5 h-0.5 w-full bg-gradient-to-r from-rio-300 to-rio-600">
                    <Ship size={16} className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white text-rio-600" />
                  </div>
                  <span className="text-xs text-slate-400">{r.destinoOrdem - r.origemOrdem - 1 > 0 ? `${r.destinoOrdem - r.origemOrdem - 1} parada(s)` : "direto"}</span>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-500">{weekday(r.destinoHorario)} {dateShort(r.destinoHorario)}</p>
                  <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{time(r.destinoHorario)}</p>
                  <p className="text-xs text-slate-500">{d.nome}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:w-44 sm:flex-col sm:items-start sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                <span className="font-semibold text-slate-800">{r.linhaNome}</span>
                {festival?.publicado && (
                  <Link href={`/festivais/${festival.slug}`} className="rounded-full bg-rubro-50 px-2 py-0.5 text-xs font-semibold text-rubro-700">{festival.nome}</Link>
                )}
                <span className="flex items-center gap-1 text-xs"><MapPin size={12} /> Porto Principal</span>
                <span className={`text-xs font-semibold ${r.lugaresLivres < 15 ? "text-red-600" : "text-emerald-600"}`}>
                  {esgotado ? "Esgotado" : `${r.lugaresLivres} lugares livres`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 sm:w-48 sm:flex-col sm:items-end">
                <div className="sm:text-right">
                  <p className="text-2xl font-extrabold text-rio-800 tabular-nums">{money(r.tarifaBase)}</p>
                  {r.taxaEmbarque > 0 && <p className="text-xs text-slate-500">+ {money(r.taxaEmbarque)} taxa de embarque</p>}
                </div>
                {esgotado ? (
                  <span className="btn-ghost pointer-events-none opacity-60">Esgotado</span>
                ) : (
                  <Link href={`/viagens/${r.viagem.id}?o=${r.origemOrdem}&d=${r.destinoOrdem}`} className="btn-sol">
                    Comprar <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  );
}
