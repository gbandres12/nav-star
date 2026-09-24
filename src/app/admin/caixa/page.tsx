import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, Banknote, LockKeyhole, Vault } from "lucide-react";
import { ActionForm, Campo } from "@/components/admin/action-form";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";
import { abrirCaixaAction, fecharCaixaAction, movimentarCaixaAction } from "@/lib/admin-actions";
import { dateTime, label, money, time } from "@/lib/format";
import { garantirAcesso } from "@/lib/sessao";
import { caixaAberto, resumoCaixa, listarCaixasAbertos, ultimosCaixasFechados } from "@/lib/data";

export const metadata = { title: "Caixa" };

export default async function Caixa() {
  const op = await garantirAcesso("/admin/caixa");
  const c = await caixaAberto(op.id);
  const gestor = op.papel === "ADMIN" || op.papel === "GERENTE";
  
  const todosAbertos = gestor ? await listarCaixasAbertos() : [];
  const abertosOutros = todosAbertos.filter((x: any) => x.usuarioId !== op.id);
  const meus = await ultimosCaixasFechados(op.id);

  return (
    <>
      <PageHeader
        title="Caixa do balcão"
        subtitle={`Operador: ${op.nome} · Abra o caixa no início do turno e feche contando o dinheiro da gaveta`}
        actions={gestor && <Link href="/admin/relatorios/caixas" className="btn-ghost">Caixas fechados</Link>}
      />

      {!c ? (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="card p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-rio-50 text-rio-600"><LockKeyhole size={20} /></span>
              <div>
                <h2 className="font-bold">Caixa fechado</h2>
                <p className="text-sm text-slate-500">Informe o troco inicial para começar a vender em dinheiro.</p>
              </div>
            </div>
            <ActionForm action={abrirCaixaAction} submit="Abrir caixa">
              <Campo label="Troco inicial (R$)">
                <input name="valorAbertura" type="number" step="0.01" min="0" defaultValue="100" className="input" />
              </Campo>
            </ActionForm>
          </div>
          <UltimosCaixas caixas={meus} />
        </div>
      ) : (
        <CaixaAberto id={c.id} />
      )}

      {gestor && abertosOutros.length > 0 && (
        <div className="card mt-6 overflow-x-auto">
          <h2 className="p-5 font-bold">Outros caixas abertos agora</h2>
          <table className="table-base">
            <thead><tr><th>Operador</th><th>Aberto às</th><th className="text-right">Vendido</th><th className="text-right">Dinheiro esperado</th></tr></thead>
            <tbody>
              {abertosOutros.map(async (x: any) => {
                const r = await resumoCaixa(x.id);
                return (
                  <tr key={x.id}>
                    <td className="font-semibold">{x.usuarioNome}</td>
                    <td>{dateTime(x.abertoEm)}</td>
                    <td className="text-right tabular-nums">{money(r.vendido)}</td>
                    <td className="text-right tabular-nums">{money(r.esperado)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

async function CaixaAberto({ id }: { id: string }) {
  const r = await resumoCaixa(id);
  const c = await caixaAberto((await garantirAcesso("/admin/caixa")).id);
  if (!c) return null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Aberto desde" value={time(c.abertoEm)} hint={`Troco inicial ${money(c.valorAbertura)}`} icon={<Vault size={18} />} />
        <Stat label="Vendido no turno" value={money(r.vendido)} hint={`${r.pagamentos.length} pedido(s)`} icon={<Banknote size={18} />} />
        <Stat label="Sangrias / suprimentos" value={`−${money(r.sangrias)}`} hint={`+${money(r.suprimentos)} em suprimentos`} icon={<ArrowUpCircle size={18} />} />
        <Stat label="Dinheiro esperado na gaveta" value={money(r.esperado)} hint="Troco + dinheiro + suprimentos − sangrias" icon={<ArrowDownCircle size={18} />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="card overflow-x-auto">
            <h2 className="p-5 font-bold">Vendas por forma de pagamento</h2>
            {r.porMetodo.length === 0 ? (
              <div className="px-5 pb-5"><Empty>Nenhuma venda neste caixa ainda.</Empty></div>
            ) : (
              <table className="table-base">
                <thead><tr><th>Forma</th><th>Pedidos</th><th className="text-right">Valor</th></tr></thead>
                <tbody>
                  {r.porMetodo.map((m) => (
                    <tr key={m.metodo}><td>{label(m.metodo)}</td><td>{m.qtd}</td><td className="text-right tabular-nums">{money(m.valor)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card overflow-x-auto">
            <h2 className="p-5 font-bold">Pedidos do turno</h2>
            {r.pagamentos.length === 0 ? (
              <div className="px-5 pb-5"><Empty>Sem pedidos.</Empty></div>
            ) : (
              <table className="table-base">
                <thead><tr><th>Hora</th><th>Pedido</th><th>Comprador</th><th>Forma</th><th>Status</th><th className="text-right">Valor</th></tr></thead>
                <tbody>
                  {[...r.pagamentos].reverse().map(({ pedido: p, pg }) => (
                    <tr key={pg.id}>
                      <td>{time(p.createdAt)}</td>
                      <td><Link href={`/admin/pedidos/${p.codigo}`} className="font-mono text-xs font-bold text-rio-700 hover:underline">{p.codigo}</Link></td>
                      <td>{p.compradorNome}</td>
                      <td>{label(pg.metodo)}</td>
                      <td><Badge status={p.status} /></td>
                      <td className="text-right tabular-nums">{money(pg.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {c.movimentos.length > 0 && (
            <div className="card overflow-x-auto">
              <h2 className="p-5 font-bold">Movimentos</h2>
              <table className="table-base">
                <thead><tr><th>Hora</th><th>Tipo</th><th>Observação</th><th className="text-right">Valor</th></tr></thead>
                <tbody>
                  {c.movimentos.map((m: any, i: number) => (
                    <tr key={i}>
                      <td>{time(m.createdAt)}</td>
                      <td>{m.tipo === "SANGRIA" ? "Sangria" : "Suprimento"}</td>
                      <td className="text-slate-600">{m.observacao}</td>
                      <td className={`text-right tabular-nums ${m.tipo === "SANGRIA" ? "text-red-700" : "text-emerald-700"}`}>{m.tipo === "SANGRIA" ? "−" : "+"}{money(m.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 font-bold">Sangria ou suprimento</h2>
            <ActionForm action={movimentarCaixaAction} submit="Registrar" limparAoSalvar botaoClassName="btn-ghost">
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Tipo">
                  <select name="tipo" className="input">
                    <option value="SANGRIA">Sangria (retirada)</option>
                    <option value="SUPRIMENTO">Suprimento (entrada)</option>
                  </select>
                </Campo>
                <Campo label="Valor (R$)">
                  <input name="valor" type="number" step="0.01" min="0.01" required className="input" />
                </Campo>
              </div>
              <Campo label="Observação" className="mt-3">
                <input name="observacao" className="input" placeholder="Ex.: depósito no banco" />
              </Campo>
            </ActionForm>
          </div>
          <div className="card border-rubro-300 p-5">
            <h2 className="mb-1 font-bold">Fechar caixa</h2>
            <p className="mb-3 text-sm text-slate-500">Conte o dinheiro da gaveta. A diferença para o esperado ({money(r.esperado)}) fica registrada.</p>
            <ActionForm action={fecharCaixaAction} submit="Fechar e imprimir comprovante" confirmar="Fechar o caixa agora? Depois disso vendas em dinheiro exigem abrir outro caixa.">
              <Campo label="Dinheiro contado (R$)">
                <input name="valorContado" type="number" step="0.01" min="0" required className="input" />
              </Campo>
              <Campo label="Observação" className="mt-3">
                <input name="observacao" className="input" />
              </Campo>
            </ActionForm>
          </div>
        </div>
      </div>
    </>
  );
}

function UltimosCaixas({ caixas }: { caixas: any[] }) {
  return (
    <div className="card overflow-x-auto">
      <h2 className="p-5 font-bold">Seus últimos fechamentos</h2>
      {caixas.length === 0 ? (
        <div className="px-5 pb-5"><Empty>Nenhum caixa fechado.</Empty></div>
      ) : (
        <table className="table-base">
          <thead><tr><th>Fechado em</th><th className="text-right">Contado</th><th /></tr></thead>
          <tbody>
            {caixas.map((c) => {
              return (
                <tr key={c.id}>
                  <td>{dateTime(c.fechadoEm!)}</td>
                  <td className="text-right tabular-nums">{money(c.valorContado ?? 0)}</td>
                  <td><Link href={`/admin/caixa/${c.id}`} className="text-sm font-semibold text-rio-700 hover:underline">Comprovante</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
