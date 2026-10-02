import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { SeatMap } from "@/components/seat-map";
import { PrintButton } from "@/components/print-button";
import { Badge, OccupancyBar, PageHeader, Stat } from "@/components/ui";
import { ViagemControles } from "@/components/admin/viagem-controles";
import { PisosAgenciaForm } from "@/components/admin/pisos-agencia-form";
import { CATEGORIAS_PISO, pisosDaViagem, vendasDeAgenciasNaViagem } from "@/lib/data/agencias-parceiras";
import { operadorAtual } from "@/lib/sessao";
import { embarcacao as buscarEmbarcacao, linha as buscarLinha } from "@/lib/data/catalogo";
import { tripulantes as listarTripulantes } from "@/lib/data/frota";
import { horarioParada, mapaComodos, paradaInfo } from "@/lib/data/utils";
import { assentosOcupados } from "@/lib/data/viagens";
import { detalheViagem, proximosStatus } from "@/lib/data/viagens-gestao";
import { dateShort, label, longDay, money, time } from "@/lib/format";

export const metadata = { title: "Viagem" };

export default async function ViagemDetalhe({ params, searchParams }: PageProps<"/admin/viagens/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const d = await detalheViagem(id);
  if (!d) notFound();
  const v = d.viagem;
  const [l, e, op, tripulantes] = await Promise.all([buscarLinha(v.linhaId), buscarEmbarcacao(v.embarcacaoId), operadorAtual(), listarTripulantes()]);
  if (!l || !e) notFound();

  const ultima = l.paradas.length - 1;
  const seg = Math.min(Math.max(0, Number(sp.seg) || 0), ultima - 1);
  const paradas = await Promise.all(l.paradas.map((p) => paradaInfo(l.id, p.ordem)));
  const horarios = await Promise.all(l.paradas.map((p) => horarioParada(v, p.ordem)));
  const [ocupadosSeg, comodos] = await Promise.all([assentosOcupados(v.id, seg, seg + 1), mapaComodos(e.id)]);

  const [pisos, vendasAgencias] = await Promise.all([pisosDaViagem(v.id), vendasDeAgenciasNaViagem(v.id)]);
  const ativas = d.manifesto.filter((p) => p.status !== "NAO_COMPARECEU");
  const porSegmento = l.paradas.slice(0, -1).map((_, s) => ativas.filter((p) => p.origemOrdem <= s && p.destinoOrdem > s).length);
  const pico = Math.max(0, ...porSegmento);
  // Quem embarca e desembarca em cada parada: explica por que a lotação muda entre os trechos
  const embarcamEm = (o: number) => ativas.filter((p) => p.origemOrdem === o).length;
  const desembarcamEm = (o: number) => ativas.filter((p) => p.destinoOrdem === o).length;
  const cap = e.capacidadePassageiros;
  const nomes = Object.fromEntries(ativas.filter((p) => p.assentoId && p.origemOrdem <= seg && p.destinoOrdem > seg).map((p) => [p.assentoId!, p.nome]));
  const receita = d.manifesto.filter((p) => p.status !== "RESERVADA").reduce((s, p) => s + p.valor, 0);
  const embarcados = d.manifesto.filter((p) => p.status === "EMBARCADA").length;
  const gestor = op.papel === "ADMIN" || op.papel === "GERENTE";
  const escalados = tripulantes.filter((t) => d.tripulacao.includes(t.id));
  const podeVender = op.papel !== "CONFERENTE" && v.vendasAbertas && (v.status === "PROGRAMADA" || v.status === "EMBARQUE") && new Date(v.partida) > new Date();

  return (
    <>
      <Link href="/admin/viagens" className="no-print mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Viagens
      </Link>
      <PageHeader
        title={l.nome}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{longDay(v.partida)}</span> · {time(v.partida)} · {e.nome}{v.comandante && ` · ${v.comandante}`} <Badge status={v.status} />
          </span>
        }
        actions={
          <>
            <PrintButton label="Imprimir manifesto" />
            {podeVender && (
              <Link href={`/admin/vender/${v.id}?o=0&d=${ultima}`} className="btn bg-emerald-500 text-white hover:bg-emerald-600">
                <ShoppingCart size={16} /> Vender
              </Link>
            )}
          </>
        }
      />

      <div className="no-print grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Passageiros" value={ativas.length} hint={`${embarcados} embarcados`} />
        <Stat label="Lotação máxima" value={`${cap ? Math.round((pico / cap) * 100) : 0}%`} hint={`${pico} de ${cap} no trecho mais cheio`} />
        <Stat label="Receita de passagens" value={money(receita)} />
        <Stat label="Encomendas" value={d.encomendas.length} hint={`${d.encomendas.reduce((s, x) => s + x.pesoKg, 0).toLocaleString("pt-BR")} kg`} />
      </div>

      <div className="no-print card mt-6 overflow-x-auto">
        <div className="p-5 pb-3">
          <h2 className="font-bold">Lotação por trecho</h2>
          <p className="text-sm text-slate-500">Passageiros a bordo entre cada parada, contando quem embarca e desembarca no caminho.</p>
        </div>
        <table className="table-base">
          <thead>
            <tr><th>Trecho</th><th>Saída</th><th className="text-right">Embarcam</th><th className="text-right">Desembarcam</th><th className="text-right">A bordo</th><th className="text-right">Livres</th><th>Ocupação</th></tr>
          </thead>
          <tbody>
            {porSegmento.map((n, i) => (
              <tr key={i} className={i === seg ? "bg-slate-50" : undefined}>
                <td className="font-semibold whitespace-nowrap">
                  <Link href={`/admin/viagens/${v.id}?seg=${i}`} scroll={false} className="hover:text-rio-700 hover:underline">
                    {paradas[i].cidade.nome} → {paradas[i + 1].cidade.nome}
                  </Link>
                </td>
                <td className="whitespace-nowrap tabular-nums">{dateShort(horarios[i])} {time(horarios[i])}</td>
                <td className="text-right tabular-nums">{embarcamEm(i)}</td>
                <td className="text-right tabular-nums">{i === 0 ? "—" : desembarcamEm(i)}</td>
                <td className="text-right font-bold tabular-nums">{n}</td>
                <td className="text-right tabular-nums">{Math.max(0, cap - n)}</td>
                <td><OccupancyBar pct={cap ? Math.min(100, Math.round((n / cap) * 100)) : 0} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="no-print card mt-6 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Mapa de ocupação por trecho</h2>
          <div className="flex flex-wrap gap-1">
            {l.paradas.slice(0, -1).map((_, i) => (
              <Link
                key={i}
                href={`/admin/viagens/${v.id}?seg=${i}`}
                scroll={false}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${seg === i ? "bg-rio-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {paradas[i].cidade.nome} → {paradas[i + 1].cidade.nome} · {porSegmento[i]}/{cap}
              </Link>
            ))}
          </div>
        </div>
        <SeatMap assentos={e.assentos} colunas={e.colunasMapa} ocupados={[...ocupadosSeg]} labels={nomes} comodos={comodos} />
        <p className="mt-2 text-xs text-slate-500">
          Passe o mouse sobre a poltrona para ver o passageiro. {ocupadosSeg.size} poltronas ocupadas neste trecho
          {porSegmento[seg] > ocupadosSeg.size && ` + ${porSegmento[seg] - ocupadosSeg.size} criança(s) de colo`}.
        </p>
      </div>

      {gestor && (
        <ViagemControles
          v={{ ...v, tripulacao: d.tripulacao, observacao: d.observacao, motivoCancelamento: d.motivoCancelamento }}
          proximos={proximosStatus(v.status)}
          tripulantes={tripulantes.filter((t) => t.ativo)}
        />
      )}

      {gestor && (
        <div className="no-print card mt-6 p-5">
          <h2 className="font-bold">Agências parceiras</h2>
          <p className="mb-4 text-sm text-slate-500">
            Piso = quanto a agência repassa à empresa, em % do preço de tabela do trecho (100% = sem desconto). A agência pode cobrar mais, nunca menos que o piso; o que passar do piso fica com ela.
          </p>
          <PisosAgenciaForm viagemId={v.id} categorias={CATEGORIAS_PISO} pisos={pisos} />
          {vendasAgencias.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <h3 className="mb-2 text-sm font-bold">Vendas das agências nesta viagem</h3>
              <table className="table-base">
                <thead><tr><th>Agência</th><th>Bilhete</th><th>Passageiro</th><th>Trecho</th><th className="text-right">Cobrado</th><th className="text-right">Repasse</th><th>Status</th></tr></thead>
                <tbody>
                  {vendasAgencias.map((x) => (
                    <tr key={x.numero}>
                      <td className="font-medium whitespace-nowrap">{x.agencia}</td>
                      <td className="font-mono text-xs">{x.pedidoCodigo ? <Link href={`/admin/pedidos/${x.pedidoCodigo}`} className="text-rio-700 hover:underline">{x.numero}</Link> : x.numero}</td>
                      <td className="whitespace-nowrap">{x.passageiro}</td>
                      <td className="whitespace-nowrap">{paradas[x.origemOrdem]?.cidade.nome} → {paradas[x.destinoOrdem]?.cidade.nome}</td>
                      <td className="text-right tabular-nums">{money(x.valorCobrado)}</td>
                      <td className="text-right tabular-nums">{money(x.valorRepasse)}</td>
                      <td><Badge status={x.status === "EMITIDO" ? "EMITIDA" : x.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5">
          <h2 className="font-bold">Manifesto de passageiros</h2>
          <span className="text-sm text-slate-500">{e.nome} · Inscrição {e.inscricaoCapitania || "—"} · {dateShort(v.partida)} {time(v.partida)}</span>
        </div>
        {(escalados.length > 0 || d.observacao) && (
          <div className="border-t border-slate-100 px-5 py-3 text-sm">
            {escalados.length > 0 && (
              <>
                <span className="font-semibold">Tripulação: </span>
                {escalados.map((t) => `${t.nome} (${label(t.funcao).toLowerCase()}${t.habilitacao !== "—" ? `, ${t.habilitacao}` : ""})`).join(" · ")}
              </>
            )}
            {d.observacao && <p className="mt-1 text-slate-500">Obs.: {d.observacao}</p>}
          </div>
        )}
        {d.manifesto.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">Nenhuma passagem vendida.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr><th>#</th><th>Poltrona</th><th>Passageiro</th><th>Documento</th><th>Tipo</th><th>Embarque</th><th>Desembarque</th><th>Pedido</th><th>Status</th></tr>
            </thead>
            <tbody>
              {d.manifesto.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td className="font-bold">{p.assento}</td>
                  <td className="font-medium whitespace-nowrap">{p.nome}</td>
                  <td className="font-mono text-xs">{p.documento}</td>
                  <td>{label(p.tipo)}</td>
                  <td>{paradas[p.origemOrdem]?.cidade.nome}</td>
                  <td>{paradas[p.destinoOrdem]?.cidade.nome}</td>
                  <td>{p.pedidoCodigo && <Link href={`/admin/pedidos/${p.pedidoCodigo}`} className="font-mono text-xs text-rio-700 hover:underline">{p.pedidoCodigo}</Link>}</td>
                  <td><Badge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {d.encomendas.length > 0 && (
        <div className="card mt-6 overflow-x-auto">
          <h2 className="p-5 font-bold">Encomendas nesta viagem</h2>
          <table className="table-base">
            <thead><tr><th>Código</th><th>Descrição</th><th>Trecho</th><th>Peso</th><th>Status</th></tr></thead>
            <tbody>
              {d.encomendas.map((x) => (
                <tr key={x.codigo}>
                  <td><Link href={`/admin/encomendas/${x.codigo}`} className="font-mono text-xs font-bold text-rio-700 hover:underline">{x.codigo}</Link></td>
                  <td>{x.descricao}</td>
                  <td className="whitespace-nowrap">{x.trecho}</td>
                  <td className="tabular-nums">{x.pesoKg.toLocaleString("pt-BR")} kg</td>
                  <td><Badge status={x.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="no-print card mt-6 p-5">
        <h2 className="mb-3 font-bold">Horários previstos</h2>
        <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {paradas.map((info, i) => (
            <li key={i} className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-bold">{info.cidade.nome}</p>
              <p className="text-xs text-slate-500">{info.porto.nome}</p>
              <p className="mt-1 text-sm font-semibold text-rio-700">{dateShort(horarios[i])} {time(horarios[i])}</p>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
