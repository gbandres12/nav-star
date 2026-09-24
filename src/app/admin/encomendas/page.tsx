import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { dateTime, label, money } from "@/lib/format";
import type { StatusEncomenda } from "@/lib/types";
import { encomendasAdmin, cidades } from "@/lib/data";

export const metadata = { title: "Encomendas" };

const STATUS: StatusEncomenda[] = ["RECEBIDA", "EMBARCADA", "EM_TRANSITO", "DISPONIVEL_RETIRADA", "ENTREGUE", "DEVOLVIDA"];

export default async function Encomendas({ searchParams }: PageProps<"/admin/encomendas">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  
  const { encomendas: todas } = await encomendasAdmin({ limite: 10000 });
  const allCidades = await cidades();
  const getCidade = (id: string) => allCidades.find(c => c.id === id);

  const lista = todas
    .filter((e) => !status || e.status === status)
    .filter((e) => !q || [e.codigo, e.remetenteNome, e.destinatarioNome, e.descricao].some((x) => x.toLowerCase().includes(q)));
  const contagem = Object.fromEntries(STATUS.map((s) => [s, todas.filter((e) => e.status === s).length]));

  return (
    <>
      <PageHeader
        title="Encomendas"
        subtitle="Cargas e volumes transportados nas viagens"
        actions={<Link href="/admin/encomendas/nova" className="btn-primary"><Plus size={16} /> Nova encomenda</Link>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/encomendas" className={`rounded-full border px-3 py-1.5 text-sm ${!status ? "border-rio-600 bg-rio-50 font-semibold text-rio-800" : "border-slate-200 bg-white text-slate-600"}`}>
          Todas <span className="text-slate-400">{todas.length}</span>
        </Link>
        {STATUS.map((s) => (
          <Link key={s} href={`/admin/encomendas?status=${s}`} className={`rounded-full border px-3 py-1.5 text-sm ${status === s ? "border-rio-600 bg-rio-50 font-semibold text-rio-800" : "border-slate-200 bg-white text-slate-600"}`}>
            {label(s)} <span className="text-slate-400">{contagem[s]}</span>
          </Link>
        ))}
      </div>

      <form className="mb-4 flex max-w-md gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} className="input pl-9" placeholder="Código, remetente, destinatário…" />
        </div>
        <button className="btn-ghost">Buscar</button>
      </form>

      {lista.length === 0 ? (
        <Empty>Nenhuma encomenda encontrada.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Código</th><th>Descrição</th><th>Trecho</th><th>Remetente</th><th>Destinatário</th><th>Peso</th><th className="text-right">Frete</th><th>Status</th></tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/admin/encomendas/${e.codigo}`} className="font-mono text-xs font-bold text-rio-700 hover:underline">{e.codigo}</Link>
                    <p className="text-xs text-slate-500">{dateTime(e.createdAt)}</p>
                  </td>
                  <td className="max-w-48 truncate">{e.descricao}</td>
                  <td className="whitespace-nowrap">{getCidade(e.origemCidadeId)?.nome} → {getCidade(e.destinoCidadeId)?.nome}</td>
                  <td className="whitespace-nowrap">{e.remetenteNome}</td>
                  <td className="whitespace-nowrap">{e.destinatarioNome}</td>
                  <td className="whitespace-nowrap tabular-nums">{e.pesoKg.toLocaleString("pt-BR")} kg</td>
                  <td className="text-right whitespace-nowrap tabular-nums">
                    {money(e.frete)}
                    {!e.fretePago && <p className="text-xs text-amber-700">a receber</p>}
                  </td>
                  <td><Badge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
