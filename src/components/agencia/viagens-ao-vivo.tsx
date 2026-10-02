"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { longDay, time } from "@/lib/format";
import type { Trecho, ViagemPortal } from "@/lib/agencia/dados";
import { BarrasLotacao } from "./barras-lotacao";
import { useLotacaoAoVivo } from "./use-lotacao";

export function ViagensAoVivo({ viagens, inicial }: { viagens: ViagemPortal[]; inicial: Record<string, Trecho[]> }) {
  const lotacao = useLotacaoAoVivo(viagens.map((v) => v.id), inicial);

  if (!viagens.length) return <p className="card p-6 text-sm text-slate-500">Nenhuma viagem aberta para venda no momento.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {viagens.map((v) => {
        const trechos = lotacao[v.id] ?? [];
        const lotada = trechos.length > 0 && trechos.every((t) => t.livres === 0);
        return (
          <article key={v.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">{v.linha}</h2>
                <p className="text-sm text-slate-500">{longDay(v.partida)} · saída {time(v.partida)} · {v.embarcacao}</p>
              </div>
              {lotada ? (
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Lotada</span>
              ) : (
                <Link href={`/agencia/painel/vender/${v.id}`} className="btn-primary !px-3 !py-1.5 text-sm">
                  <ShoppingCart size={15} /> Vender
                </Link>
              )}
            </div>
            <div className="mt-4"><BarrasLotacao trechos={trechos} paradas={v.paradas} /></div>
          </article>
        );
      })}
      <p className="text-xs text-slate-400 lg:col-span-2">As vagas se atualizam sozinhas a cada 15 segundos.</p>
    </div>
  );
}
