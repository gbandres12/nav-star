import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { FestivalForm } from "@/components/admin/festival-form";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { cidade, db, passagensDaViagem } from "@/lib/store";
import { date, money } from "@/lib/format";

export const metadata = { title: "Festivais" };

export default async function Festivais() {
  await garantirAcesso("/admin/festivais");
  const lista = [...db().festivais].sort((a, b) => b.inicio.localeCompare(a.inicio));
  return (
    <>
      <PageHeader title="Festivais" subtitle="Eventos com viagens especiais e página própria no site de vendas" />
      <div className="grid gap-4 lg:grid-cols-2">
        {lista.length === 0 && <Empty>Nenhum festival cadastrado.</Empty>}
        {lista.map((f) => {
          const pas = f.viagemIds.flatMap((id) => passagensDaViagem(id).filter((p) => p.status !== "RESERVADA"));
          return (
            <Link key={f.id} href={`/admin/festivais/${f.id}`} className="card p-5 transition hover:border-rio-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-rio-900">{f.nome}</h2>
                  <p className="text-sm text-slate-500">{cidade(f.cidadeId).nome} · {date(f.inicio + "T12:00:00Z")} a {date(f.fim + "T12:00:00Z")}</p>
                </div>
                <Badge status={f.publicado ? "ATIVA" : "INATIVA"}>{f.publicado ? "No site" : "Rascunho"}</Badge>
              </div>
              <p className="mt-3 text-sm text-slate-600">{f.chamada}</p>
              <p className="mt-3 text-xs text-slate-500">
                {f.viagemIds.length} viagem(ns) · {pas.length} passagens vendidas · {money(pas.reduce((s, p) => s + p.valor, 0))}
                {f.acrescimoPercentual > 0 && ` · tarifa +${f.acrescimoPercentual}%`}
              </p>
            </Link>
          );
        })}
      </div>
      <div className="card mt-6 p-6">
        <h2 className="mb-1 font-bold">Novo festival</h2>
        <p className="mb-4 flex items-center gap-1 text-sm text-slate-500">Depois de cadastrar, inclua as viagens (existentes ou extras). A página fica em /festivais/… <ExternalLink size={13} /></p>
        <FestivalForm cidades={db().cidades.map(({ id, nome }) => ({ id, nome }))} />
      </div>
    </>
  );
}
