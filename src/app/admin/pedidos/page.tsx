import Link from "next/link";
import { Search } from "lucide-react";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { db, expirarPedidos, passagensDoPedido, viagem, paradaInfo } from "@/lib/store";
import { dateTime, label, money, onlyDigits } from "@/lib/format";
import type { CanalVenda, StatusPedido } from "@/lib/types";

export const metadata = { title: "Pedidos" };

const CANAIS: CanalVenda[] = ["SITE", "BALCAO", "AGENCIA", "WHATSAPP"];
const STATUS: StatusPedido[] = ["PAGO", "AGUARDANDO_PAGAMENTO", "EXPIRADO", "CANCELADO", "REEMBOLSADO"];

export default async function Pedidos({ searchParams }: PageProps<"/admin/pedidos">) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = s("q").trim().toLowerCase();
  const canal = s("canal");
  const status = s("status");
  const pagina = Math.max(1, Number(s("p")) || 1);
  expirarPedidos();

  const lista = [...db().pedidos]
    .filter((p) => (!canal || p.canal === canal) && (!status || p.status === status))
    .filter((p) => {
      if (!q) return true;
      if (p.codigo.toLowerCase().includes(q) || p.numero.toLowerCase().includes(q) || p.compradorNome.toLowerCase().includes(q)) return true;
      return passagensDoPedido(p.id).some((x) => x.nome.toLowerCase().includes(q) || (onlyDigits(q) && onlyDigits(x.documento).includes(onlyDigits(q))));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const porPagina = 25;
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const itens = lista.slice((pagina - 1) * porPagina, pagina * porPagina);
  const qs = (p: number) => new URLSearchParams({ q, canal, status, p: String(p) }).toString();

  return (
    <>
      <PageHeader title="Pedidos e passagens" subtitle={`${lista.length.toLocaleString("pt-BR")} pedidos encontrados`} />
      <form className="card mb-6 grid items-end gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <div>
          <label className="label">Buscar</label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} className="input pl-9" placeholder="Nº do pedido, comprador, passageiro ou CPF" />
          </div>
        </div>
        <div>
          <label className="label">Canal</label>
          <select name="canal" defaultValue={canal} className="input">
            <option value="">Todos</option>
            {CANAIS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={status} className="input">
            <option value="">Todos</option>
            {STATUS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
        </div>
        <button className="btn-primary">Filtrar</button>
      </form>

      {itens.length === 0 ? (
        <Empty>Nenhum pedido encontrado.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Pedido</th><th>Comprador</th><th>Viagem / trecho</th><th>Pax</th><th>Canal</th><th>Pagamento</th><th className="text-right">Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {itens.map((p) => {
                const pas = passagensDoPedido(p.id);
                const v = pas[0] && viagem(pas[0].viagemId);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/pedidos/${p.codigo}`} className="font-mono text-xs font-bold text-rio-700 hover:underline">{p.numero}</Link>
                      <p className="text-xs text-slate-500">{dateTime(p.createdAt)}</p>
                    </td>
                    <td className="font-medium">{p.compradorNome}</td>
                    <td className="whitespace-nowrap">
                      {v && (
                        <>
                          <p>{paradaInfo(v.linhaId, pas[0].origemOrdem).cidade.nome} → {paradaInfo(v.linhaId, pas[0].destinoOrdem).cidade.nome}</p>
                          <Link href={`/admin/viagens/${v.id}`} className="text-xs text-slate-500 hover:underline">{v.id}</Link>
                        </>
                      )}
                    </td>
                    <td className="text-center">{pas.length}</td>
                    <td>{label(p.canal)}</td>
                    <td className="whitespace-nowrap">{label(p.pagamentos[0].metodo)}</td>
                    <td className="text-right font-semibold tabular-nums">{money(p.total)}</td>
                    <td><Badge status={p.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {paginas > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Página {pagina} de {paginas}</span>
          <div className="flex gap-2">
            {pagina > 1 && <Link className="btn-ghost py-1.5" href={`/admin/pedidos?${qs(pagina - 1)}`}>Anterior</Link>}
            {pagina < paginas && <Link className="btn-ghost py-1.5" href={`/admin/pedidos?${qs(pagina + 1)}`}>Próxima</Link>}
          </div>
        </div>
      )}
    </>
  );
}
