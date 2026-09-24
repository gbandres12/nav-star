import Image from "next/image";
import Link from "next/link";
import { ExternalLink, ImageOff } from "lucide-react";
import { FestivalForm } from "@/components/admin/festival-form";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { cidades as listarCidades } from "@/lib/data/catalogo";
import { festivais, vendasPorViagem } from "@/lib/data/festivais";
import { date, money } from "@/lib/format";

export const metadata = { title: "Festivais" };

export default async function Festivais() {
  await garantirAcesso("/admin/festivais");
  const [todos, cidades] = await Promise.all([festivais(), listarCidades()]);
  const lista = [...todos].sort((a, b) => b.inicio.localeCompare(a.inicio));
  const vendas = await vendasPorViagem(lista.flatMap((f) => f.viagemIds));
  const nomeCidade = (id: string) => cidades.find((c) => c.id === id)?.nome ?? "";

  return (
    <>
      <PageHeader title="Festivais" subtitle="Eventos com viagens especiais e página própria no site de vendas" />
      <div className="grid gap-4 lg:grid-cols-2">
        {lista.length === 0 && <Empty>Nenhum festival cadastrado.</Empty>}
        {lista.map((f) => {
          const v = f.viagemIds.map((id) => vendas.get(id) ?? { quantidade: 0, valor: 0 });
          const capa = f.fotos?.[0];
          return (
            <Link key={f.id} href={`/admin/festivais/${f.id}`} className="card flex gap-4 p-4 transition hover:border-rio-300 hover:shadow-md">
              <div className="relative hidden h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:block">
                {capa ? (
                  <Image src={capa.url} alt="" fill sizes="128px" className="object-cover" />
                ) : (
                  <ImageOff size={20} className="absolute inset-0 m-auto text-slate-400" aria-label="Sem foto" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-rio-900">{f.nome}</h2>
                    <p className="text-sm text-slate-500">{nomeCidade(f.cidadeId)} · {date(f.inicio + "T12:00:00Z")} a {date(f.fim + "T12:00:00Z")}</p>
                  </div>
                  <Badge status={f.publicado ? "ATIVA" : "INATIVA"}>{f.publicado ? "No site" : "Rascunho"}</Badge>
                </div>
                {f.chamada && <p className="mt-2 text-sm text-slate-600">{f.chamada}</p>}
                <p className="mt-2 text-xs text-slate-500">
                  {f.viagemIds.length} viagem(ns) · {f.fotos?.length ?? 0} foto(s) · {v.reduce((s, x) => s + x.quantidade, 0)} passagens vendidas ·{" "}
                  {money(v.reduce((s, x) => s + x.valor, 0))}
                  {f.acrescimoPercentual > 0 && ` · tarifa +${f.acrescimoPercentual}%`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="card mt-6 p-6">
        <h2 className="mb-1 font-bold">Novo festival</h2>
        <p className="mb-4 flex items-center gap-1 text-sm text-slate-500">
          Depois de cadastrar, inclua as fotos e as viagens. A página fica em /festivais/… <ExternalLink size={13} />
        </p>
        <FestivalForm cidades={cidades.map(({ id, nome }) => ({ id, nome }))} />
      </div>
    </>
  );
}
