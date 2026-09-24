import Link from "next/link";
import { Anchor, Navigation, Wrench } from "lucide-react";
import { Badge, OccupancyBar, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { dateShort, dateTime, label, time } from "@/lib/format";
import { carregarDadosMapa, chegadaFinal, cidade, embarcacao, horarioParada, linha, ocupacaoViagem, paradaInfo, posicaoFrota, type PosicaoEmbarcacao } from "@/lib/data/mapa";

export const metadata = { title: "Mapa de embarcações" };

const W = 1000;
const MARGEM = 70;

export default async function Mapa() {
  await garantirAcesso("/admin/mapa");
  const agora = new Date();
  
  const db = await carregarDadosMapa();
  const frota = posicaoFrota(agora);
  
  // Ordem do rio: a linha ativa com mais paradas define a sequência das cidades no desenho
  const base = [...db.linhas].filter((l) => l.ativa).sort((a, b) => b.paradas.length - a.paradas.length)[0];
  const ordem = base ? base.paradas.map((p) => paradaInfo(base.id, p.ordem).cidade.id) : [];
  const x = (cidadeId: string) => MARGEM + (ordem.indexOf(cidadeId) / Math.max(1, ordem.length - 1)) * (W - 2 * MARGEM);
  const y = (i: number) => 110 + Math.sin(i * 1.3) * 18; // leve curva do rio
  const yCidade = (id: string) => y(ordem.indexOf(id));

  const ponto = (p: PosicaoEmbarcacao) => {
    if (p.situacao === "NAVEGANDO" && p.deCidadeId && p.paraCidadeId && ordem.includes(p.deCidadeId) && ordem.includes(p.paraCidadeId)) {
      const t = p.progresso ?? 0;
      return { cx: x(p.deCidadeId) + (x(p.paraCidadeId) - x(p.deCidadeId)) * t, cy: yCidade(p.deCidadeId) + (yCidade(p.paraCidadeId) - yCidade(p.deCidadeId)) * t };
    }
    if (p.cidadeId && ordem.includes(p.cidadeId)) return { cx: x(p.cidadeId), cy: yCidade(p.cidadeId) };
    return null;
  };

  return (
    <>
      <PageHeader title="Mapa de embarcações" subtitle={`Posição estimada pelo horário previsto de cada parada · atualizado ${dateTime(agora)}`} />
      <div className="card overflow-x-auto p-4">
        <svg viewBox={`0 0 ${W} 220`} className="min-w-[640px]" role="img" aria-label="Posição das embarcações no rio">
          <path
            d={ordem.map((c, i) => `${i === 0 ? "M" : "L"} ${x(c)} ${y(i)}`).join(" ")}
            className="fill-none stroke-rio-200"
            strokeWidth={22}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {ordem.map((c, i) => (
            <g key={c}>
              <circle cx={x(c)} cy={y(i)} r={7} className="fill-white stroke-rio-700" strokeWidth={3} />
              <text x={x(c)} y={y(i) + (i % 2 ? -26 : 38)} textAnchor="middle" className="fill-slate-700 text-[14px] font-semibold">{cidade(c).nome}</text>
            </g>
          ))}
          {frota.map((p, i) => {
            const pt = ponto(p);
            if (!pt) return null;
            const e = embarcacao(p.embarcacaoId);
            const dy = p.situacao === "NAVEGANDO" ? -2 : -30 - (i % 2) * 16;
            return (
              <g key={p.embarcacaoId}>
                {p.situacao !== "NAVEGANDO" && <line x1={pt.cx} y1={pt.cy} x2={pt.cx} y2={pt.cy + dy + 8} className="stroke-slate-400" strokeDasharray="3 3" />}
                <g transform={`translate(${pt.cx} ${pt.cy + dy})`}>
                  <path d="M -16 -4 L 16 -4 L 10 7 L -10 7 Z" className={p.situacao === "NAVEGANDO" ? "fill-rubro-500" : "fill-rio-800"} />
                  <rect x={-6} y={-11} width={12} height={7} rx={2} className="fill-white stroke-rio-800" />
                </g>
                <text x={pt.cx} y={pt.cy + dy - 16} textAnchor="middle" className="fill-slate-900 text-[12px] font-bold">{e.nome}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {frota.map((p) => {
          const e = embarcacao(p.embarcacaoId);
          const v = p.viagem;
          const l = v ? linha(v.linhaId) : undefined;
          const proxParada = v && l && p.situacao === "NAVEGANDO" ? l.paradas.findIndex((x) => horarioParada(v, x.ordem) > agora) : -1;
          return (
            <div key={e.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${p.situacao === "NAVEGANDO" ? "bg-rubro-50 text-rubro-600" : p.situacao === "MANUTENCAO" || p.situacao === "INATIVA" ? "bg-amber-50 text-amber-600" : "bg-rio-50 text-rio-600"}`}>
                    {p.situacao === "NAVEGANDO" ? <Navigation size={20} /> : p.situacao === "MANUTENCAO" || p.situacao === "INATIVA" ? <Wrench size={20} /> : <Anchor size={20} />}
                  </span>
                  <div>
                    <h2 className="font-bold">{e.nome}</h2>
                    <p className="text-sm text-slate-500">
                      {p.situacao === "NAVEGANDO" && p.deCidadeId && p.paraCidadeId && `Entre ${cidade(p.deCidadeId).nome} e ${cidade(p.paraCidadeId).nome} (${Math.round((p.progresso ?? 0) * 100)}% do trecho)`}
                      {p.situacao === "ATRACADA" && (p.cidadeId ? `Atracada em ${cidade(p.cidadeId).nome}` : "Atracada")}
                      {p.situacao === "EMBARQUE" && p.cidadeId && `Em embarque em ${cidade(p.cidadeId).nome}`}
                      {(p.situacao === "MANUTENCAO" || p.situacao === "INATIVA") && label(p.situacao)}
                    </p>
                  </div>
                </div>
                <Badge status={p.situacao === "NAVEGANDO" ? "EM_CURSO" : p.situacao === "EMBARQUE" ? "EMBARQUE" : p.situacao === "ATRACADA" ? "PROGRAMADA" : p.situacao}>{label(p.situacao)}</Badge>
              </div>
              {v && l && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                  <Link href={`/admin/viagens/${v.id}`} className="font-semibold text-rio-700 hover:underline">{l.nome} · {v.id}</Link>
                  <p className="text-slate-600">Saída {dateShort(v.partida)} {time(v.partida)} · chegada prevista {dateShort(chegadaFinal(v))} {time(chegadaFinal(v))}</p>
                  {proxParada > 0 && <p className="text-slate-600">Próxima parada: {paradaInfo(l.id, proxParada).cidade.nome} às {time(horarioParada(v, proxParada))}</p>}
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">Lotação <OccupancyBar pct={ocupacaoViagem(v).pct} /></div>
                </div>
              )}
              {p.proximaSaida && p.proximaSaida.id !== v?.id && (
                <p className="mt-3 text-sm text-slate-600">
                  Próxima saída: <Link href={`/admin/viagens/${p.proximaSaida.id}`} className="font-semibold text-rio-700 hover:underline">{dateShort(p.proximaSaida.partida)} {time(p.proximaSaida.partida)}</Link> · {linha(p.proximaSaida.linhaId).nome}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500">Sem GPS: a posição é calculada pelo horário previsto de chegada em cada parada. Atrasos reais não aparecem aqui.</p>
    </>
  );
}
