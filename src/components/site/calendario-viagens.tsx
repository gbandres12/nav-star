"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Ship } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { longDay, money, time, TZ } from "@/lib/format";
import type { CalendarioViagem } from "@/lib/data/calendario";

type Props = {
  origem: string;
  destino: string;
  mes: string;
  viagens: CalendarioViagem[];
  selectedDay?: string;
  basePath?: string;
  compact?: boolean;
  titulo?: string;
};

const meses = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const diaNumero = new Intl.DateTimeFormat("pt-BR", { day: "numeric", timeZone: "UTC" });
const hojeManaus = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

function inicioDoMes(mes: string) {
  return new Date(`${mes}-01T00:00:00Z`);
}

function deslocarMes(mes: string, deslocamento: number) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const data = new Date(Date.UTC(ano, numeroMes - 1 + deslocamento, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

function mesDaData(dia: string) {
  return dia.slice(0, 7);
}

function diaPassado(dia: string, hoje: string) {
  return dia < hoje;
}

function rotaHref(basePath: string, origem: string, destino: string, mes: string, data?: string) {
  const params = new URLSearchParams({ origem, destino, mes });
  if (data) params.set("data", data);
  return `${basePath}?${params.toString()}`;
}

function statusLivre(livres: number) {
  if (livres === 0) return { label: "Esgotado", className: "text-red-600" };
  if (livres < 15) return { label: `${livres} lugares`, className: "text-amber-700" };
  return { label: `${livres} lugares`, className: "text-emerald-700" };
}

function resumoDoDia(viagens: CalendarioViagem[]) {
  return {
    menorValor: Math.min(...viagens.map((viagem) => viagem.valor)),
    maiorDisponibilidade: Math.max(...viagens.map((viagem) => viagem.livres)),
    primeiroHorario: viagens.slice().sort((a, b) => a.saida.localeCompare(b.saida))[0],
  };
}

export function CalendarioViagens({
  origem,
  destino,
  mes,
  viagens,
  selectedDay,
  basePath = "/viagens",
  compact = false,
  titulo,
}: Props) {
  const router = useRouter();
  const hoje = hojeManaus.format(new Date());
  const dias = useMemo(() => {
    const agrupados = new Map<string, CalendarioViagem[]>();
    for (const viagem of viagens) {
      const grupo = agrupados.get(viagem.dia) ?? [];
      grupo.push(viagem);
      agrupados.set(viagem.dia, grupo);
    }
    return agrupados;
  }, [viagens]);
  const diasDoMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
  const primeiroDiaSemana = inicioDoMes(mes).getUTCDay();
  const dataSelecionada = selectedDay && selectedDay.startsWith(mes) ? selectedDay : null;
  const saidasSelecionadas = dataSelecionada ? (dias.get(dataSelecionada) ?? []) : [];
  const anteriores = mes <= hoje.slice(0, 7);
  const nomeMes = meses.format(inicioDoMes(mes));

  const navegarParaDia = (dia: string) => {
    router.push(rotaHref(basePath, origem, destino, mes, dia), { scroll: false });
  };

  if (compact) {
    return (
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            {titulo && <h3 className="font-bold text-slate-900">{titulo}</h3>}
            <p className="mt-1 text-xs text-slate-500">Próximas datas disponíveis</p>
          </div>
          <CalendarDays size={19} className="shrink-0 text-rio-600" />
        </div>
        {viagens.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">Nenhuma data disponível no momento.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {viagens.map((viagem) => {
              const disponibilidade = statusLivre(viagem.livres);
              return (
                <Link
                  key={viagem.viagemId}
                  href={rotaHref(basePath, origem, destino, mesDaData(viagem.dia), viagem.dia)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-rio-300 hover:bg-rio-50"
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{longDay(`${viagem.dia}T12:00:00-04:00`)}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Clock size={12} /> {time(viagem.saida)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-bold text-rio-800">{money(viagem.valor)}</span>
                    <span className={`block text-xs font-semibold ${disponibilidade.className}`}>{disponibilidade.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
        <Link href={rotaHref(basePath, origem, destino, mes)} className="mt-4 inline-flex text-sm font-semibold text-rio-700 hover:underline">
          Ver calendário completo <ChevronRight size={16} />
        </Link>
      </div>
    );
  }

  const celulas: Array<{ key: string; vazio: true; dia?: never } | { key: string; vazio: false; dia: string }> = [
    ...Array.from({ length: primeiroDiaSemana }, (_, i) => ({ key: `vazio-${i}`, vazio: true as const })),
    ...Array.from({ length: diasDoMes }, (_, i) => {
      const dia = `${mes}-${String(i + 1).padStart(2, "0")}`;
      return { key: dia, dia, vazio: false as const };
    }),
  ];

  return (
    <section className="card p-4 sm:p-5" aria-label={titulo ?? "Calendário de viagens"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {titulo && <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>}
          <p className="mt-1 text-sm capitalize text-slate-500">{nomeMes}</p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={rotaHref(basePath, origem, destino, deslocarMes(mes, -1))}
            aria-label="Mês anterior"
            className={`grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-rio-300 hover:text-rio-700 ${anteriores ? "pointer-events-none opacity-40" : ""}`}
          >
            <ChevronLeft size={17} />
          </Link>
          <Link
            href={rotaHref(basePath, origem, destino, deslocarMes(mes, 1))}
            aria-label="Próximo mês"
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-rio-300 hover:text-rio-700"
          >
            <ChevronRight size={17} />
          </Link>
        </div>
      </div>

      <div className="mt-5 hidden grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400 sm:grid">
        {[
          ["dom", "domingo"], ["seg", "segunda-feira"], ["ter", "terça-feira"], ["qua", "quarta-feira"],
          ["qui", "quinta-feira"], ["sex", "sexta-feira"], ["sáb", "sábado"],
        ].map(([abrev, nome]) => <span key={abrev} aria-label={nome}>{abrev}</span>)}
      </div>

      <div className="mt-2 hidden grid-cols-7 gap-2 sm:grid">
        {celulas.map((celula) => {
          if (celula.vazio) return <span key={celula.key} className="min-h-28 rounded-xl bg-slate-50/50" aria-hidden />;
          const dia = celula.dia!;
          const doDia = dias.get(dia) ?? [];
          const resumo = doDia.length > 0 ? resumoDoDia(doDia) : null;
          const passado = diaPassado(dia, hoje);
          const selecionado = dataSelecionada === dia;
          const hojeClasse = hoje === dia ? "ring-2 ring-rubro-400" : "";
          return (
            <button
              key={celula.key}
              type="button"
              disabled={passado}
              onClick={() => navegarParaDia(dia)}
              className={`min-h-28 rounded-xl border p-2 text-left transition ${passado ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300" : doDia.length > 0 ? "border-rio-100 bg-white hover:border-rio-400 hover:shadow-sm" : "border-slate-100 bg-slate-50/60 text-slate-400 hover:border-slate-200"} ${selecionado ? "border-rio-600 bg-rio-50" : ""} ${hojeClasse}`}
            >
              <span className="flex items-center justify-between text-sm font-bold">
                {diaNumero.format(new Date(`${dia}T00:00:00Z`))}
                {hoje === dia && <span className="rounded-full bg-rubro-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rubro-700">Hoje</span>}
              </span>
              {resumo && (
                <span className="mt-3 block">
                  <span className="flex items-center gap-1 text-xs font-semibold text-rio-700"><Clock size={12} /> {time(resumo.primeiroHorario.saida)}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">a partir de {money(resumo.menorValor)}</span>
                  <span className={`mt-1 block text-[11px] font-semibold ${statusLivre(resumo.maiorDisponibilidade).className}`}>{statusLivre(resumo.maiorDisponibilidade).label}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2 sm:hidden">
        {viagens.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Nenhuma saída disponível neste mês.</p>
        ) : (
          Array.from(dias.entries()).map(([dia, doDia]) => {
            const resumo = resumoDoDia(doDia);
            const disponibilidade = statusLivre(resumo.maiorDisponibilidade);
            return (
              <button key={dia} type="button" disabled={diaPassado(dia, hoje)} onClick={() => navegarParaDia(dia)} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left ${diaPassado(dia, hoje) ? "border-slate-100 bg-slate-50 opacity-50" : "border-rio-100 bg-white"} ${hoje === dia ? "ring-2 ring-rubro-400" : ""}`}>
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{longDay(`${dia}T12:00:00-04:00`)}{hoje === dia && <span className="ml-2 rounded-full bg-rubro-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rubro-700">Hoje</span>}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock size={12} /> {time(resumo.primeiroHorario.saida)}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold text-rio-800">a partir de {money(resumo.menorValor)}</span>
                  <span className={`block text-xs font-semibold ${disponibilidade.className}`}>{disponibilidade.label}</span>
                </span>
              </button>
            );
          })
        )}
      </div>

      {dataSelecionada && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <h3 className="text-base font-bold text-slate-900">Saídas de {longDay(`${dataSelecionada}T12:00:00-04:00`)}</h3>
          {saidasSelecionadas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nenhuma saída disponível nessa data.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {saidasSelecionadas.map((viagem) => {
                const disponibilidade = statusLivre(viagem.livres);
                return (
                  <div key={viagem.viagemId} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-rio-50 text-rio-700"><Ship size={18} /></span>
                      <div>
                        <p className="font-bold text-slate-900">{time(viagem.saida)} <span className="font-normal text-slate-400">→ {time(viagem.chegada)}</span></p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {disponibilidade.label}{viagem.festival ? ` · ${viagem.festival}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right"><p className="font-extrabold text-rio-800">{money(viagem.valor)}</p>{viagem.taxa > 0 && <p className="text-xs text-slate-500">+ {money(viagem.taxa)} taxa</p>}</div>
                      {viagem.livres > 0 ? <Link href={`/viagens/${viagem.viagemId}?o=${viagem.origemOrdem}&d=${viagem.destinoOrdem}`} className="btn-sol">Comprar</Link> : <span className="btn-ghost opacity-60">Esgotado</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
