import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileDown, Search } from "lucide-react";
import { BarList } from "@/components/admin/charts";
import { PrintButton } from "@/components/print-button";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { date, dateTime } from "@/lib/format";
import { formatar, gerarRelatorio, lerFiltros, qsFiltros } from "@/lib/relatorios";
import { garantirAcesso } from "@/lib/sessao";
import { buscarBaseDeDadosParaRelatorios } from "@/lib/data/relatorios";

export const metadata = { title: "Relatório" };

export default async function RelatorioPage({ params, searchParams }: PageProps<"/admin/relatorios/[tipo]">) {
  await garantirAcesso("/admin/relatorios");
  const { tipo } = await params;
  const f = lerFiltros(await searchParams);
  const r = await gerarRelatorio(tipo, f);
  if (!r) notFound();
  
  const db = await buscarBaseDeDadosParaRelatorios(f);
  const config = db.config;
  const allLinhas = db.linhas;
  const allEmbarcacoes = db.embarcacoes;
  const allUsuarios = db.usuarios;
  
  const direita = (t?: string) => (t && t !== "texto" ? "text-right tabular-nums" : "");
  const qs = qsFiltros(f);

  return (
    <>
      <Link href="/admin/relatorios" className="no-print mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Relatórios</Link>
      <PageHeader
        title={`Relatório ${r.titulo.toLowerCase()}`}
        subtitle={r.descricao}
        actions={
          <div className="no-print flex gap-2">
            <a href={`/admin/relatorios/${tipo}/csv?${qs}`} className="btn-ghost"><FileDown size={16} /> Exportar CSV</a>
            <PrintButton label="Imprimir" />
          </div>
        }
      />
      <p className="mb-4 hidden text-sm print:block">
        {config.empresa.nome} · Período {date(f.de + "T12:00:00Z")} a {date(f.ate + "T12:00:00Z")} · Emitido em {dateTime(new Date())}
      </p>

      <form className="no-print card mb-6 grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        {r.filtros.includes("q") ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="label">Passageiro</label>
            <input name="q" defaultValue={f.q} className="input" placeholder="Nome ou CPF/RG" autoFocus />
          </div>
        ) : (
          <>
            <div><label className="label">De</label><input type="date" name="de" defaultValue={f.de} className="input" /></div>
            <div><label className="label">Até</label><input type="date" name="ate" defaultValue={f.ate} className="input" /></div>
          </>
        )}
        {r.filtros.includes("linha") && (
          <div>
            <label className="label">Linha</label>
            <select name="linha" defaultValue={f.linhaId} className="input">
              <option value="">Todas</option>
              {allLinhas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
        )}
        {r.filtros.includes("embarcacao") && (
          <div>
            <label className="label">Embarcação</label>
            <select name="embarcacao" defaultValue={f.embarcacaoId} className="input">
              <option value="">Todas</option>
              {allEmbarcacoes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        )}
        {r.filtros.includes("usuario") && (
          <div>
            <label className="label">Usuário</label>
            <select name="usuario" defaultValue={f.usuarioId} className="input">
              <option value="">Todos</option>
              {allUsuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        )}
        <button className="btn-primary"><Search size={16} /> Filtrar</button>
      </form>

      {r.destaques.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {r.destaques.map((d) => <Stat key={d.l} label={d.l} value={d.v} hint={d.hint} />)}
        </div>
      )}

      {r.grafico && r.grafico.dados.some((d) => d.value > 0) && r.grafico.dados.length <= 12 && (
        <div className="card no-print mb-6 p-5">
          <h2 className="mb-4 font-bold">{r.grafico.titulo}</h2>
          <BarList items={r.grafico.dados.filter((d) => d.value > 0)} />
        </div>
      )}

      <div className="card overflow-x-auto">
        {r.linhas.length === 0 ? (
          <div className="p-5"><Empty>Nenhum dado para os filtros escolhidos.</Empty></div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>{r.colunas.map((c) => <th key={c.k} className={direita(c.t)}>{c.l}</th>)}</tr>
            </thead>
            <tbody>
              {r.linhas.map((l, i) => (
                <tr key={i}>
                  {r.colunas.map((c, j) => (
                    <td key={c.k} className={`${direita(c.t)} ${j === 0 ? "font-medium whitespace-nowrap" : ""}`}>
                      {j === 0 && l._href ? <Link href={l._href} className="text-rio-700 hover:underline">{formatar(l[c.k], c.t)}</Link> : formatar(l[c.k], c.t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {r.total && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  {r.colunas.map((c) => <td key={c.k} className={`border-t border-slate-200 px-4 py-3 ${direita(c.t)}`}>{r.total![c.k] === undefined ? "" : formatar(r.total![c.k], c.t)}</td>)}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
      {r.nota && <p className="mt-3 text-xs text-slate-500">{r.nota}</p>}
    </>
  );
}
