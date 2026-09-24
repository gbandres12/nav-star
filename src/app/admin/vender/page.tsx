import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Empty, PageHeader } from "@/components/ui";
import { embarcacoes as listarEmbarcacoes } from "@/lib/data/catalogo";
import { cidadesAtendidas, paradaInfo } from "@/lib/data/utils";
import { buscarViagens } from "@/lib/data/viagens";
import { dateShort, duration, localDayKey, money, time, weekday } from "@/lib/format";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Vender passagens" };

export default async function Vender({ searchParams }: PageProps<"/admin/vender">) {
  await garantirAcesso("/admin/vender");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const [cidades, embarcacoes] = await Promise.all([cidadesAtendidas(), listarEmbarcacoes()]);
  const origem = s("origem");
  const destino = s("destino");
  const data = s("data") ?? localDayKey(new Date());

  // Sem filtro de cidade: lista todos os trechos com saída na data (a mesma busca do site, com lotação por trecho)
  const pares = cidades
    .flatMap((o) => cidades.filter((d) => d.id !== o.id).map((d) => [o.id, d.id] as const))
    .filter(([o, d]) => (!origem || o === origem) && (!destino || d === destino));
  const encontrados = (await Promise.all(pares.map(([o, d]) => buscarViagens(o, d, data)))).flat();
  const resultados = (
    await Promise.all(
      encontrados.map(async (r) => {
        const [po, pd] = await Promise.all([paradaInfo(r.viagem.linhaId, r.origemOrdem), paradaInfo(r.viagem.linhaId, r.destinoOrdem)]);
        return {
          ...r,
          saida: new Date(r.origemHorario),
          origemCidade: po.cidade.nome,
          destinoCidade: pd.cidade.nome,
          portoEmbarque: po.porto.nome,
          embarcacao: embarcacoes.find((e) => e.id === r.viagem.embarcacaoId)?.nome ?? "",
        };
      }),
    )
  ).sort((a, b) => a.saida.getTime() - b.saida.getTime() || a.destinoOrdem - b.destinoOrdem);

  return (
    <>
      <PageHeader title="Vender passagens" subtitle="Venda no balcão — dinheiro, PIX ou cartão na maquininha" />
      <form className="card mb-6 grid items-end gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <div>
          <label className="label">Município de origem</label>
          <select name="origem" defaultValue={origem ?? ""} className="input">
            <option value="">Todos</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}/{c.uf}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Município de destino</label>
          <select name="destino" defaultValue={destino ?? ""} className="input">
            <option value="">Todos</option>
            {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}/{c.uf}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Data</label>
          <input type="date" name="data" defaultValue={data} className="input" />
        </div>
        <button className="btn-primary">Filtrar</button>
        <Link href="/admin/vender" className="btn-ghost">Limpar</Link>
      </form>

      {resultados.length === 0 ? (
        <Empty>Nenhuma saída com venda aberta para esses filtros. Tente outra data.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Trecho</th><th>Porto</th><th>Saída</th><th>Duração</th><th className="text-right">Valor</th><th className="text-right">Taxa emb.</th><th>Livres</th><th></th></tr>
            </thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={`${r.viagem.id}-${r.origemOrdem}-${r.destinoOrdem}`}>
                  <td>
                    <p className="font-semibold text-slate-800">{r.origemCidade} → {r.destinoCidade}</p>
                    <p className="text-xs text-slate-500">Linha {r.linhaNome} · {r.embarcacao}</p>
                  </td>
                  <td>{r.portoEmbarque}</td>
                  <td className="whitespace-nowrap"><span>{weekday(r.saida)}</span> {dateShort(r.saida)} · <b>{time(r.saida)}</b></td>
                  <td>{duration(r.duracaoMinutos)}</td>
                  <td className="text-right font-bold tabular-nums">{money(r.tarifaBase)}</td>
                  <td className="text-right tabular-nums">{money(r.taxaEmbarque)}</td>
                  <td>
                    <span className={`inline-flex min-w-9 justify-center rounded-full px-2 py-0.5 text-xs font-bold ${r.lugaresLivres < 15 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{r.lugaresLivres}</span>
                  </td>
                  <td>
                    <Link href={`/admin/vender/${r.viagem.id}?o=${r.origemOrdem}&d=${r.destinoOrdem}`} className="btn bg-emerald-500 py-2 text-white hover:bg-emerald-600">
                      <ShoppingCart size={15} /> Vender
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

