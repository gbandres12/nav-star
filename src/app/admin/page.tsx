import Link from "next/link";
import { ArrowRight, Banknote, Landmark, Package, Ticket } from "lucide-react";
import { BarChart } from "@/components/admin/charts";
import { MonthNav } from "@/components/admin/month-nav";
import { Badge, OccupancyBar, PageHeader, Stat } from "@/components/ui";
import { db, expirarPedidos, linha, ocupacaoViagem, passagensDoPedido, pedidosPagos } from "@/lib/store";
import { dateShort, dateTime, label, localDayKey, money, time, weekday } from "@/lib/format";
import { periodoMes } from "@/lib/periodo";
import { usuarioAtual } from "@/lib/auth";
import { OnboardingModal } from "@/components/admin/onboarding-modal";
import { OnboardingChecklist } from "@/components/admin/onboarding-checklist";

export const metadata = { title: "Painel" };

export default async function Painel({ searchParams }: PageProps<"/admin">) {
  const { mes, bemvindo } = await searchParams;
  const user = await usuarioAtual();
  expirarPedidos();
  const per = periodoMes(mes);
  const pedidos = pedidosPagos(per.inicio, per.fim);
  const total = pedidos.reduce((s, p) => s + p.total, 0);
  const taxas = pedidos.reduce((s, p) => s + p.taxas, 0);
  const comissao = pedidos.reduce((s, p) => s + p.comissaoAgencia, 0);
  const qtdPassagens = pedidos.reduce((s, p) => s + passagensDoPedido(p.id).length, 0);
  const encomendasMes = db().encomendas.filter((e) => new Date(e.createdAt) >= per.inicio && new Date(e.createdAt) < per.fim);
  const fretes = encomendasMes.reduce((s, e) => s + e.frete, 0);

  const porDia = Array.from({ length: per.dias }, (_, i) => {
    const key = `${per.mes}-${String(i + 1).padStart(2, "0")}`;
    const doDia = pedidos.filter((p) => localDayKey(p.createdAt) === key);
    return { label: String(i + 1), sub: `${String(i + 1).padStart(2, "0")}/${per.mes.slice(5)}`, value: doDia.reduce((s, p) => s + p.total, 0), hint: `${doDia.length} pedido(s)` };
  });

  const agora = new Date();
  const proximas = db().viagens.filter((v) => new Date(v.partida) > new Date(agora.getTime() - 86_400_000) && v.status !== "CONCLUIDA").slice(0, 5);
  const ultimos = [...db().pedidos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7);
  const encPend = db().encomendas.filter((e) => e.status === "RECEBIDA" || e.status === "DISPONIVEL_RETIRADA");

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total vendido" value={money(total)} hint={`${pedidos.length} pedidos pagos`} icon={<Banknote size={18} />} />
        <Stat label="Líquido da empresa" value={money(total - taxas - comissao)} hint={`Comissão agências ${money(comissao)} · Taxas ${money(taxas)}`} icon={<Landmark size={18} />} />
        <Stat label="Passagens vendidas" value={qtdPassagens.toLocaleString("pt-BR")} hint={`Ticket médio ${money(pedidos.length ? total / pedidos.length : 0)}`} icon={<Ticket size={18} />} />
        <Stat label="Fretes de encomendas" value={money(fretes)} hint={`${encomendasMes.length} encomendas recebidas`} icon={<Package size={18} />} />
      </div>

      <div className="card mt-6 p-5 sm:p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-bold">Vendas por dia</h2>
          <span className="text-xs text-slate-500">Valor total dos pedidos pagos (R$)</span>
        </div>
        <BarChart data={porDia} />
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
                {proximas.map((v) => {
                  const oc = ocupacaoViagem(v);
                  return (
                    <tr key={v.id}>
                      <td>
                        <Link href={`/admin/viagens/${v.id}`} className="font-semibold text-rio-700 hover:underline">
                          <span>{weekday(v.partida)}</span> {dateShort(v.partida)} · {time(v.partida)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{linha(v.linhaId).nome}</td>
                      <td><Badge status={v.status} /></td>
                      <td><OccupancyBar pct={oc.pct} /></td>
                    </tr>
                  );
                })}
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
              <p className="text-2xl font-bold text-rio-800">{encPend.filter((e) => e.status === "RECEBIDA").length}</p>
              <p className="text-xs text-rio-700">no porto p/ embarcar</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-2xl font-bold text-amber-800">{encPend.filter((e) => e.status === "DISPONIVEL_RETIRADA").length}</p>
              <p className="text-xs text-amber-700">aguardando retirada</p>
            </div>
          </div>
          <h3 className="mt-6 mb-2 text-sm font-bold">Últimos pedidos</h3>
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
