"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, WifiOff } from "lucide-react";
import { Badge, OccupancyBar, Stat } from "@/components/ui";
import { painelAoVivoAction } from "@/lib/agencias-parceiras-actions";
import type { PainelAoVivo } from "@/lib/data/agencias-parceiras";
import { dateShort, money, time } from "@/lib/format";

const INTERVALO_MS = 15_000;

export function PainelAgenciasAoVivo({ inicial }: { inicial: PainelAoVivo }) {
  const [d, setD] = useState(inicial);
  const [semConexao, setSemConexao] = useState(false);

  useEffect(() => {
    let vivo = true;
    const atualizar = async () => {
      if (document.hidden) return;
      try {
        const r = await painelAoVivoAction();
        if (!vivo || !r) return;
        setD(r);
        setSemConexao(false);
      } catch {
        if (vivo) setSemConexao(true);
      }
    };
    const timer = setInterval(atualizar, INTERVALO_MS);
    const aoVoltar = () => {
      if (!document.hidden) atualizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
        {semConexao ? (
          <><WifiOff size={14} className="text-amber-600" /> Sem conexão: mostrando os dados de {time(d.atualizadoEm)}. Tentando de novo…</>
        ) : (
          <><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span> Ao vivo · atualizado às {time(d.atualizadoEm)} · a cada 15 s</>
        )}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Vendido hoje" value={money(d.hoje.vendido)} hint={`${d.hoje.bilhetes} bilhete(s)`} />
        <Stat label={`Vendido em ${d.mes.nome}`} value={money(d.mes.vendido)} hint={`${d.mes.bilhetes} bilhete(s) · margem das agências ${money(d.mes.margem)}`} />
        <Stat label="A receber das agências" value={money(d.aReceber)} hint={`${d.aReceberQtd} bilhete(s) sem baixa`} />
        <Stat label="Agências aprovadas" value={d.agencias.APROVADA} hint={`${d.agencias.SUSPENSA} suspensa(s) · ${d.agencias.RECUSADA} recusada(s)`} />
        <Stat label="Aguardando aprovação" value={d.agencias.PENDENTE} hint={d.agencias.PENDENTE ? "precisam da sua decisão" : "nenhuma pendente"} />
      </div>

      {d.aDevolver > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} /> {money(d.aDevolver)} a devolver a agências: a baixa já tinha sido dada e o bilhete foi cancelado depois.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-100 p-5 font-bold">Últimas vendas</h2>
          {d.ultimas.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Nenhuma venda de agência ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.ultimas.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {u.agencia}
                      {u.recente && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">novo</span>}
                    </p>
                    <p className="text-slate-500">{u.passageiro} · {u.origem} → {u.destino}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{money(u.valor)}</p>
                    <p className="text-xs text-slate-400">{dateShort(u.criadoEm)} {time(u.criadoEm)}</p>
                  </div>
                  <Badge status={u.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="card overflow-hidden">
            <h2 className="border-b border-slate-100 p-5 font-bold">Cadastros pendentes</h2>
            {d.pendentes.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Nenhum cadastro aguardando.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.pendentes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="font-medium">{p.nome}<span className="block text-xs font-normal text-slate-400">{dateShort(p.criadaEm)} {time(p.criadaEm)}</span></span>
                    <Link href="/admin/agencias-parceiras" className="font-semibold text-rio-700 hover:underline">Decidir</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-slate-100 p-5 font-bold">Ranking do mês</h2>
            {d.ranking.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Sem vendas no mês.</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {d.ranking.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="w-5 text-slate-400">{i + 1}</span>
                    <Link href={`/admin/agencias-parceiras/${r.id}`} className="min-w-0 flex-1 truncate font-medium text-rio-700 hover:underline">{r.nome}</Link>
                    <span className="text-xs text-slate-500">{r.bilhetes} bilh.</span>
                    <span className="font-semibold tabular-nums">{money(r.vendido)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-slate-100 p-5 font-bold">Viagens quase lotadas (7 dias)</h2>
            {d.viagensCheias.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Nenhuma viagem acima de 80% no trecho mais cheio.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.viagensCheias.map((v) => (
                  <li key={v.id} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/admin/viagens/${v.id}`} className="font-medium text-rio-700 hover:underline">{v.linha}</Link>
                      <OccupancyBar pct={Math.min(100, v.pct)} />
                    </div>
                    <p className="text-xs text-slate-500">{dateShort(v.partida)} {time(v.partida)} · {v.trecho} · {v.livres === 0 ? "lotado" : `${v.livres} vaga(s)`}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
