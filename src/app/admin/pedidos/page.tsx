import Link from "next/link";
import { BellRing, Search } from "lucide-react";
import { ConfirmarPagamento } from "@/components/admin/confirmar-pagamento";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { cidades as listarCidades, linhas as listarLinhas, portos as listarPortos } from "@/lib/data/catalogo";
import { pedidosAConferir, pedidosAdmin, resumoPassagens } from "@/lib/data/pedidos";
import { dateShort, dateTime, label, money, time } from "@/lib/format";
import type { CanalVenda, StatusPedido } from "@/lib/types";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Pedidos" };

const CANAIS: CanalVenda[] = ["SITE", "BALCAO", "AGENCIA", "WHATSAPP"];
const STATUS: StatusPedido[] = ["PAGO", "AGUARDANDO_PAGAMENTO", "EXPIRADO", "CANCELADO", "REEMBOLSADO"];

export default async function Pedidos({ searchParams }: PageProps<"/admin/pedidos">) {
  const op = await garantirAcesso("/admin/pedidos");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = s("q").trim();
  const canal = s("canal");
  const status = s("status");
  const aConferir = status === "CONFERIR";
  const pagina = Math.max(1, Number(s("p")) || 1);
  const podeConfirmar = op.papel === "ADMIN" || op.papel === "GERENTE";

  const [{ pedidos, total, paginas }, pendentes, linhas, portos, cidades] = await Promise.all([
    pedidosAdmin({ busca: q, canal, status: aConferir ? "" : status, aConferir, pagina }),
    pedidosAConferir(),
    listarLinhas(),
    listarPortos(),
    listarCidades(),
  ]);
  const resumo = await resumoPassagens(pedidos.map((p) => p.id));
  const cidadeDaParada = (linhaId: string, ordem: number) => {
    const portoId = linhas.find((l) => l.id === linhaId)?.paradas[ordem]?.portoId;
    const cidadeId = portos.find((p) => p.id === portoId)?.cidadeId;
    return cidades.find((c) => c.id === cidadeId)?.nome ?? "?";
  };
  const qs = (p: number) => new URLSearchParams({ q, canal, status, p: String(p) }).toString();

  return (
    <>
      <PageHeader title="Pedidos e passagens" subtitle={`${total.toLocaleString("pt-BR")} pedidos encontrados`} />

      {pendentes > 0 && !aConferir && (
        <Link href="/admin/pedidos?status=CONFERIR" className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 hover:bg-amber-100">
          <BellRing size={20} className="shrink-0" />
          <span className="flex-1 text-sm">
            <strong>{pendentes} {pendentes === 1 ? "pedido" : "pedidos"} com PIX informado pelo cliente.</strong> Confira no extrato do banco e confirme para emitir os bilhetes.
          </span>
          <span className="text-sm font-semibold">Conferir →</span>
        </Link>
      )}

      <form className="card mb-6 grid items-end gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <div>
          <label className="label" htmlFor="q">Buscar</label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input id="q" name="q" defaultValue={q} className="input pl-9" placeholder="Código, nº do pedido, comprador ou telefone" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="canal">Canal</label>
          <select id="canal" name="canal" defaultValue={canal} className="input">
            <option value="">Todos</option>
            {CANAIS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status} className="input">
            <option value="">Todos</option>
            <option value="CONFERIR">PIX a conferir</option>
            {STATUS.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
        </div>
        <button className="btn-primary">Filtrar</button>
      </form>

      {pedidos.length === 0 ? (
        <Empty>Nenhum pedido encontrado.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Pedido</th><th>Comprador</th><th>Viagem / trecho</th><th>Pax</th><th>Canal</th><th>Pagamento</th><th className="text-right">Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {pedidos.map((p) => {
                const r = resumo.get(p.id);
                const informado = p.status === "AGUARDANDO_PAGAMENTO" && p.pagamentoInformadoEm;
                return (
                  <tr key={p.id} className={informado ? "bg-amber-50/60" : undefined}>
                    <td>
                      <Link href={`/admin/pedidos/${p.codigo}`} className="font-mono text-xs font-bold text-rio-700 hover:underline">{p.numero}</Link>
                      <p className="text-xs text-slate-500">{dateTime(p.createdAt)}</p>
                    </td>
                    <td>
                      <p className="font-medium">{p.compradorNome}</p>
                      <p className="text-xs text-slate-500">{p.compradorTelefone}</p>
                    </td>
                    <td className="whitespace-nowrap">
                      {r && (
                        <>
                          <p>{cidadeDaParada(r.linhaId, r.origemOrdem)} → {cidadeDaParada(r.linhaId, r.destinoOrdem)}</p>
                          <p className="text-xs text-slate-500">{dateShort(r.partida)} · {time(r.partida)}</p>
                        </>
                      )}
                    </td>
                    <td className="text-center">{r?.quantidade ?? 0}</td>
                    <td>{label(p.canal)}</td>
                    <td className="whitespace-nowrap">{p.pagamentos[0] ? label(p.pagamentos[0].metodo) : "—"}</td>
                    <td className="text-right font-semibold tabular-nums">{money(p.total)}</td>
                    <td>
                      {informado ? (
                        <>
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">PIX informado</span>
                          {podeConfirmar && <ConfirmarPagamento codigo={p.codigo} total={money(p.total)} compacto />}
                        </>
                      ) : (
                        <Badge status={p.status} />
                      )}
                    </td>
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
