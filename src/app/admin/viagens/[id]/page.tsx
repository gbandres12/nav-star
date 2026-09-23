import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { SeatMap } from "@/components/seat-map";
import { PrintButton } from "@/components/print-button";
import { Badge, PageHeader, Stat } from "@/components/ui";
import { assentosOcupados, cidade, db, embarcacao, horarioParada, linha, ocupacaoViagem, paradaInfo, viagem } from "@/lib/store";
import { dateShort, label, longDay, money, time } from "@/lib/format";

export const metadata = { title: "Viagem" };

export default async function ViagemDetalhe({ params, searchParams }: PageProps<"/admin/viagens/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const v = viagem(id);
  if (!v) notFound();
  const l = linha(v.linhaId);
  const e = embarcacao(v.embarcacaoId);
  const seg = Math.min(Math.max(0, Number(sp.seg) || 0), l.paradas.length - 2);

  const passagens = db()
    .passagens.filter((p) => p.viagemId === v.id && p.status !== "CANCELADA")
    .sort((a, b) => a.origemOrdem - b.origemOrdem || a.nome.localeCompare(b.nome));
  const ocup = ocupacaoViagem(v);
  const encomendas = db().encomendas.filter((x) => x.viagemId === v.id);
  const codigo = new Map(e.assentos.map((a) => [a.id, a.codigo]));
  const ocupadosSeg = assentosOcupados(v.id, seg, seg + 1);
  const nomes = Object.fromEntries(passagens.filter((p) => p.origemOrdem <= seg && p.destinoOrdem > seg).map((p) => [p.assentoId, p.nome]));
  const receita = passagens.filter((p) => p.status !== "RESERVADA").reduce((s, p) => s + p.valor, 0);
  const embarcados = passagens.filter((p) => p.status === "EMBARCADA").length;

  return (
    <>
      <Link href="/admin/viagens" className="no-print mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Viagens
      </Link>
      <PageHeader
        title={`${l.nome}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{longDay(v.partida)}</span> · {time(v.partida)} · {e.nome} · {v.comandante} <Badge status={v.status} />
          </span>
        }
        actions={
          <>
            <PrintButton label="Imprimir manifesto" />
            {v.status !== "CONCLUIDA" && (
              <Link href={`/admin/vender/${v.id}?o=0&d=${l.paradas.length - 1}`} className="btn bg-emerald-500 text-white hover:bg-emerald-600">
                <ShoppingCart size={16} /> Vender
              </Link>
            )}
          </>
        }
      />

      <div className="no-print grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Passageiros" value={passagens.length} hint={`${embarcados} embarcados`} />
        <Stat label="Lotação máxima" value={`${ocup.pct}%`} hint={`${ocup.ocupados} de ${ocup.total} no trecho mais cheio`} />
        <Stat label="Receita de passagens" value={money(receita)} />
        <Stat label="Encomendas" value={encomendas.length} hint={`${encomendas.reduce((s, x) => s + x.pesoKg, 0).toLocaleString("pt-BR")} kg`} />
      </div>

      <div className="no-print card mt-6 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Mapa de ocupação por trecho</h2>
          <div className="flex flex-wrap gap-1">
            {l.paradas.slice(0, -1).map((p, i) => (
              <Link
                key={i}
                href={`/admin/viagens/${v.id}?seg=${i}`}
                scroll={false}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${seg === i ? "bg-rio-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {paradaInfo(l.id, i).cidade.nome} → {paradaInfo(l.id, i + 1).cidade.nome}
              </Link>
            ))}
          </div>
        </div>
        <SeatMap assentos={e.assentos} colunas={e.colunasMapa} ocupados={[...ocupadosSeg]} labels={nomes} />
        <p className="mt-2 text-xs text-slate-500">Passe o mouse sobre a poltrona para ver o passageiro. {ocupadosSeg.size} ocupadas neste trecho.</p>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <div className="flex items-center justify-between p-5">
          <h2 className="font-bold">Manifesto de passageiros</h2>
          <span className="text-sm text-slate-500">{e.nome} · {dateShort(v.partida)} {time(v.partida)}</span>
        </div>
        <table className="table-base">
          <thead>
            <tr><th>#</th><th>Poltrona</th><th>Passageiro</th><th>Documento</th><th>Tipo</th><th>Embarque</th><th>Desembarque</th><th>Pedido</th><th>Status</th></tr>
          </thead>
          <tbody>
            {passagens.map((p, i) => {
              const ped = db().pedidos.find((x) => x.id === p.pedidoId)!;
              return (
                <tr key={p.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td className="font-bold">{codigo.get(p.assentoId)}</td>
                  <td className="font-medium whitespace-nowrap">{p.nome}</td>
                  <td className="font-mono text-xs">{p.documento}</td>
                  <td>{label(p.tipo)}</td>
                  <td>{paradaInfo(l.id, p.origemOrdem).cidade.nome}</td>
                  <td>{paradaInfo(l.id, p.destinoOrdem).cidade.nome}</td>
                  <td><Link href={`/admin/pedidos/${ped.codigo}`} className="font-mono text-xs text-rio-700 hover:underline">{ped.codigo}</Link></td>
                  <td><Badge status={p.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {encomendas.length > 0 && (
        <div className="card mt-6 overflow-x-auto">
          <h2 className="p-5 font-bold">Encomendas nesta viagem</h2>
          <table className="table-base">
            <thead><tr><th>Código</th><th>Descrição</th><th>Trecho</th><th>Peso</th><th>Status</th></tr></thead>
            <tbody>
              {encomendas.map((x) => (
                <tr key={x.id}>
                  <td><Link href={`/admin/encomendas/${x.codigo}`} className="font-mono text-xs font-bold text-rio-700 hover:underline">{x.codigo}</Link></td>
                  <td>{x.descricao}</td>
                  <td className="whitespace-nowrap">{cidade(x.origemCidadeId).nome} → {cidade(x.destinoCidadeId).nome}</td>
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
          {l.paradas.map((p) => {
            const info = paradaInfo(l.id, p.ordem);
            return (
              <li key={p.ordem} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold">{info.cidade.nome}</p>
                <p className="text-xs text-slate-500">{info.porto.nome}</p>
                <p className="mt-1 text-sm font-semibold text-rio-700">{dateShort(horarioParada(v, p.ordem))} {time(horarioParada(v, p.ordem))}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
