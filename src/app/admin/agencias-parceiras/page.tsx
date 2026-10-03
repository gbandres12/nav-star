import { headers } from "next/headers";
import { AgenciaParceiraAcoes } from "@/components/admin/agencia-parceira-acoes";
import { CopiarLink } from "@/components/admin/copiar-link";
import { Badge, PageHeader } from "@/components/ui";
import Link from "next/link";
import { MonthNav } from "@/components/admin/month-nav";
import { empresaDoOperador, listarAgenciasParceiras, resumoAgencias, type AgenciaParceira, type ResumoAgencia } from "@/lib/data/agencias-parceiras";
import { money } from "@/lib/format";
import { periodoMes } from "@/lib/periodo";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Agências parceiras" };

const data = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Manaus" }) : "—");

function Linha({ a, r }: { a: AgenciaParceira; r?: ResumoAgencia }) {
  return (
    <li className="flex flex-wrap items-start gap-x-6 gap-y-3 p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{a.nome}</span>
          <Badge status={a.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {a.responsavel} · {a.email} · {a.telefone}
          {a.documento ? ` · ${a.documento}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          Cadastrada em {data(a.criadaEm)}
          {a.status === "APROVADA" && ` · aprovada em ${data(a.aprovadoEm)} · último acesso ${data(a.ultimoLogin)}`}
        </p>
        {r && (r.bilhetesPeriodo > 0 || r.aReceber > 0) && (
          <p className="mt-1 text-sm text-slate-600">
            No mês: {money(r.vendidoPeriodo)} em {r.bilhetesPeriodo} bilhete(s) · <b>a receber: {money(r.aReceber)}</b>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/admin/agencias-parceiras/${a.id}`} className="text-sm font-semibold text-rio-700 hover:underline">Painel e repasses</Link>
        <AgenciaParceiraAcoes id={a.id} status={a.status} />
      </div>
    </li>
  );
}

export default async function AgenciasParceiras({ searchParams }: PageProps<"/admin/agencias-parceiras">) {
  const op = await garantirAcesso("/admin/agencias-parceiras");
  const { mes } = await searchParams;
  const per = periodoMes(mes);
  const [lista, empresaId, h, resumos] = await Promise.all([listarAgenciasParceiras(), empresaDoOperador(op.id), headers(), resumoAgencias(per.inicio, per.fim)]);

  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origem = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  const link = `${origem.replace(/\/$/, "")}/agencia?empresa=${empresaId}`;

  const pendentes = lista.filter((a) => a.status === "PENDENTE");
  const demais = lista.filter((a) => a.status !== "PENDENTE");

  return (
    <>
      <PageHeader title="Agências parceiras" subtitle="Agências que vendem passagens pelo portal próprio, com acesso separado do sistema. Só vendem depois de aprovadas."
        actions={<><Link href="/admin/agencias-parceiras/ao-vivo" className="btn-ghost">Painel ao vivo</Link><MonthNav base="/admin/agencias-parceiras" {...per} /></>}
      />

      <div className="card mb-6 p-5">
        <h2 className="mb-1 font-bold">Link de cadastro</h2>
        <p className="mb-3 text-sm text-slate-500">Envie este link às agências. Elas se cadastram sozinhas e ficam pendentes até você aprovar.</p>
        <CopiarLink link={link} />
      </div>

      <div className="card mb-6 overflow-hidden">
        <h2 className="border-b border-slate-100 p-5 font-bold">Aguardando aprovação ({pendentes.length})</h2>
        {pendentes.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhum cadastro pendente.</p> : <ul className="divide-y divide-slate-100">{pendentes.map((a) => <Linha key={a.id} a={a} r={resumos.get(a.id)} />)}</ul>}
      </div>

      <div className="card overflow-hidden">
        <h2 className="border-b border-slate-100 p-5 font-bold">Agências ({demais.length})</h2>
        {demais.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhuma agência aprovada ainda.</p> : <ul className="divide-y divide-slate-100">{demais.map((a) => <Linha key={a.id} a={a} r={resumos.get(a.id)} />)}</ul>}
      </div>
    </>
  );
}
