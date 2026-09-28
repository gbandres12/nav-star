import Link from "next/link";
import { ArrowRight, Banknote, BellRing, Landmark, Package, Ticket } from "lucide-react";
import { BarChart } from "@/components/admin/charts";
import { MonthNav } from "@/components/admin/month-nav";
import { Badge, OccupancyBar, PageHeader, Stat } from "@/components/ui";
import { linhas as listarLinhas } from "@/lib/data/catalogo";
import { encomendasPendentes, proximasViagensPainel, resumoDoMes, ultimosPedidos } from "@/lib/data/painel";
import { pedidosAConferir } from "@/lib/data/pedidos";
import { dateShort, dateTime, label, money, time, weekday } from "@/lib/format";
import { periodoMes } from "@/lib/periodo";
import { usuarioAtual } from "@/lib/auth";
import { OnboardingModal } from "@/components/admin/onboarding-modal";
import { OnboardingChecklist } from "@/components/admin/onboarding-checklist";

export const metadata = { title: "Painel" };

export default async function Painel({ searchParams }: PageProps<"/admin">) {
  const { mes, bemvindo } = await searchParams;
  const user = await usuarioAtual();
  const per = periodoMes(mes);
  const [r, proximas, ultimos, encPend, aConferir, linhas] = await Promise.all([
    resumoDoMes(per.inicio, per.fim, per.dias, per.mes),
    proximasViagensPainel(5),
    ultimosPedidos(7),
    encomendasPendentes(),
    pedidosAConferir(),
    listarLinhas(),
  ]);
  const nomeLinha = (id: string) => linhas.find((l) => l.id === id)?.nome ?? "";

  return (
    <>
      <PageHeader
        title="Painel administrativo"
        subtitle="Visão geral das vendas e da operação"
        actions={<MonthNav base="/admin" {...per} />}
      />

      {user && (
        <OnboardingModal
          nome={user.nome}
          papel={user.papel}
          abertoInicialmente={bemvindo === "1" || !user.onboardingConcluido}
        />
      )}

      {user && !user.onboardingConcluido && (
        <div className="mb-6">
          <OnboardingChecklist
            papel={user.papel}
            passoSalvo={user.onboardingPasso}
            concluido={user.onboardingConcluido}
          />
        </div>
      )}

      {aConferir > 0 && (
        <Link href="/admin/pedidos?status=CONFERIR" className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 hover:bg-amber-100">
          <BellRing size={20} className="shrink-0" />
          <span className="flex-1 text-sm"><strong>{aConferir} {aConferir === 1 ? "pedido" : "pedidos"} com PIX informado pelo cliente</strong> esperando conferência.</span>
          <span className="text-sm font-semibold">Conferir →</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total vendido" value={money(r.total)} hint={`${r.pedidos} pedidos pagos`} icon={<Banknote size={18} />} />
        <Stat label="Líquido da empresa" value={money(r.total - r.taxas - r.comissao)} hint={`Comissão agências ${money(r.comissao)} · Taxas ${money(r.taxas)}`} icon={<Landmark size={18} />} />
        <Stat label="Passagens vendidas" value={r.passagens.toLocaleString("pt-BR")} hint={`Ticket médio ${money(r.pedidos ? r.total / r.pedidos : 0)}`} icon={<Ticket size={18} />} />
        <Stat label="Fretes de encomendas" value={money(r.fretes)} hint={`${r.encomendas} encomendas recebidas`} icon={<Package size={18} />} />
      </div>

      <div className="card mt-6 p-5 sm:p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-bold">Vendas por dia</h2>
          <span className="text-xs text-slate-500">
            Valor total dos pedidos pagos (R$){r.porCanal.length > 0 && ` · ${r.porCanal.map((c) => `${label(c.canal)} ${money(c.valor)}`).join(" · ")}`}
          </span>
        </div>
        <BarChart data={r.porDia} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <h2 className="font-bold">Próximas viagens</h2>
            <Link href="/admin/viagens" className="flex items-center gap-1 text-sm font-semibold text-rio-700 hover:underline">
              Todas <ArrowRight size={14} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Saída</th><th>Linha</th><th>Status</th><th>Lotação</th></tr>
              </thead>
              <tbody>
                {proximas.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-sm text-slate-500">Nenhuma viagem programada.</td></tr>
                )}
                {proximas.map(({ viagem: v, pct, ocupados, capacidade }) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap font-semibold text-slate-800">
                      <span>{weekday(v.partida)}</span> {dateShort(v.partida)} · {time(v.partida)}
                    </td>
                    <td className="whitespace-nowrap">{nomeLinha(v.linhaId)}</td>
                    <td><Badge status={v.status} /></td>
                    <td title={`${ocupados} de ${capacidade} no trecho mais cheio`}><OccupancyBar pct={pct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Encomendas aguardando ação</h2>
            <Link href="/admin/encomendas" className="text-sm font-semibold text-rio-700 hover:underline">Ver</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-rio-50 p-4">
              <p className="text-2xl font-bold text-rio-800">{encPend.noPorto}</p>
              <p className="text-xs text-rio-700">no porto p/ embarcar</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-2xl font-bold text-amber-800">{encPend.retirada}</p>
              <p className="text-xs text-amber-700">aguardando retirada</p>
            </div>
          </div>
          <h3 className="mt-6 mb-2 text-sm font-bold">Últimos pedidos</h3>
          {ultimos.length === 0 && <p className="text-sm text-slate-500">Nenhum pedido ainda.</p>}
          <ul className="divide-y divide-slate-100">
            {ultimos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/admin/pedidos/${p.codigo}`} className="font-semibold text-slate-800 hover:text-rio-700">{p.compradorNome}</Link>
                  <p className="text-xs text-slate-500">{label(p.canal)} · {dateTime(p.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{money(p.total)}</p>
                  <Badge status={p.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
