import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MonthNav } from "@/components/admin/month-nav";
import { RepassesAgencia } from "@/components/admin/repasses-agencia";
import { Badge, PageHeader, Stat } from "@/components/ui";
import { agenciaParceiraPorId, bilhetesDaAgenciaInterno, ocupacaoDaAgencia, resumoAgencias } from "@/lib/data/agencias-parceiras";
import { dateShort, money, time } from "@/lib/format";
import { periodoMes } from "@/lib/periodo";
import { garantirAcesso } from "@/lib/sessao";
import { UUID } from "@/lib/agencia/banco";

export const metadata = { title: "Agência parceira" };

export default async function PainelAgenciaParceira({ params, searchParams }: PageProps<"/admin/agencias-parceiras/[id]">) {
  await garantirAcesso("/admin/agencias-parceiras");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { mes } = await searchParams;
  const per = periodoMes(mes);

  const [agencia, resumos, aReceber, baixados, ocupacao] = await Promise.all([
    agenciaParceiraPorId(id),
    resumoAgencias(per.inicio, per.fim),
    bilhetesDaAgenciaInterno(id, "a_receber"),
    bilhetesDaAgenciaInterno(id, "baixados"),
    ocupacaoDaAgencia(id),
  ]);
  if (!agencia) notFound();
  const r = resumos.get(id);

  return (
    <>
      <Link href="/admin/agencias-parceiras" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Agências parceiras
      </Link>
      <PageHeader
        title={agencia.nome}
        subtitle={<span className="flex flex-wrap items-center gap-2">{agencia.responsavel} · {agencia.email} · {agencia.telefone} <Badge status={agencia.status} /></span>}
        actions={<MonthNav base={`/admin/agencias-parceiras/${id}`} {...per} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={`Vendido em ${per.nome}`} value={money(r?.vendidoPeriodo ?? 0)} hint={`${r?.bilhetesPeriodo ?? 0} bilhete(s)`} />
        <Stat label="Repasse do mês" value={money(r?.repassePeriodo ?? 0)} hint="piso + taxa de embarque" />
        <Stat label="Margem da agência" value={money(r?.margemPeriodo ?? 0)} hint="cobrado acima do piso" />
        <Stat label="A receber da agência" value={money(r?.aReceber ?? 0)} hint={`${r?.aReceberQtd ?? 0} bilhete(s) sem baixa`} />
        <Stat label="A devolver à agência" value={money(r?.aDevolver ?? 0)} hint="baixa dada e bilhete cancelado depois" />
      </div>

      <div className="card mt-6 pt-5">
        <h2 className="px-5 font-bold">A receber da agência</h2>
        <p className="mb-3 px-5 text-sm text-slate-500">Repasse = piso da viagem + taxa de embarque. Dê a baixa quando o dinheiro for recebido da agência. Ao transferir, o bilhete continua válido, com o novo titular.</p>
        <RepassesAgencia bilhetes={aReceber} modo="receber" />
      </div>

      <div className="card mt-6 p-5">
        <h2 className="font-bold">Ocupação nas próximas viagens</h2>
        <p className="mb-4 text-sm text-slate-500">Quantos lugares a agência ocupa em cada trecho, frente ao total a bordo.</p>
        {ocupacao.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma viagem futura com bilhetes desta agência.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {ocupacao.map((o) => (
              <div key={o.viagemId} className="rounded-xl border border-slate-200 p-4">
                <Link href={`/admin/viagens/${o.viagemId}`} className="font-semibold text-rio-700 hover:underline">{o.linha}</Link>
                <p className="mb-3 text-xs text-slate-500">{dateShort(o.partida)} {time(o.partida)} · capacidade {o.capacidade}</p>
                <ul className="space-y-2">
                  {o.trechos.map((t) => (
                    <li key={`${t.origem}-${t.destino}`}>
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-700">{t.origem} → {t.destino}</span>
                        <span className="tabular-nums text-slate-500"><b className="text-rio-700">{t.daAgencia}</b> da agência · {t.total}/{o.capacidade} a bordo</span>
                      </div>
                      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${t.daAgencia} da agência, ${t.total - t.daAgencia} de outros, capacidade ${o.capacidade}`}>
                        <div className="bg-rio-600" style={{ width: `${o.capacidade ? (t.daAgencia / o.capacidade) * 100 : 0}%` }} />
                        <div className="bg-slate-400" style={{ width: `${o.capacidade ? (Math.max(0, t.total - t.daAgencia) / o.capacidade) * 100 : 0}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mt-6 pt-5">
        <h2 className="px-5 font-bold">Repasses baixados</h2>
        <p className="mb-3 px-5 text-sm text-slate-500">Últimos 100. Use “Desfazer baixa” em caso de engano.</p>
        <RepassesAgencia bilhetes={baixados} modo="baixados" />
      </div>
    </>
  );
}
