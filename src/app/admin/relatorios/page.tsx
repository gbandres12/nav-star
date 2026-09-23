import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { RELATORIOS } from "@/lib/relatorios-lista";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Relatórios" };

export default async function Relatorios() {
  await garantirAcesso("/admin/relatorios");
  return (
    <>
      <PageHeader title="Relatórios" subtitle="Todos com filtro de período, impressão e exportação para Excel (CSV)" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {RELATORIOS.map((r) => (
          <Link key={r.slug} href={`/admin/relatorios/${r.slug}`} className="card p-5 transition hover:border-rio-300 hover:shadow-md">
            <h2 className="font-bold text-rio-900">{r.titulo}</h2>
            <p className="mt-1 text-sm text-slate-500">{r.descricao}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
