import { PackageSearch, Search } from "lucide-react";
import { EncomendaTimeline } from "@/components/encomenda-timeline";
import { Badge, Empty } from "@/components/ui";
import { cidade as getCidade } from "@/lib/data/catalogo";
import { encomendaPorCodigo } from "@/lib/data/encomendas";
import { money } from "@/lib/format";

export const metadata = { title: "Rastrear encomenda" };

export default async function Rastreio({ searchParams }: PageProps<"/rastreio">) {
  const sp = await searchParams;
  const codigo = typeof sp.codigo === "string" ? sp.codigo.trim() : "";
  const e = codigo ? await encomendaPorCodigo(codigo) : undefined;

  const origemCidade = e ? await getCidade(e.origemCidadeId) : null;
  const destinoCidade = e ? await getCidade(e.destinoCidadeId) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rio-100 text-rio-700">
          <PackageSearch size={28} />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Rastrear encomenda</h1>
        <p className="mt-1 text-sm text-slate-500">Digite o código que está no comprovante (ex.: EN-48210).</p>
      </div>
      <form className="mt-6 flex gap-2">
        <input name="codigo" defaultValue={codigo} className="input uppercase" placeholder="EN-00000" required />
        <button className="btn-primary shrink-0">
          <Search size={16} /> Buscar
        </button>
      </form>

      {codigo && !e && <div className="mt-6"><Empty>Nenhuma encomenda encontrada com o código “{codigo}”.</Empty></div>}

      {e && (
        <div className="card mt-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-sm font-semibold text-slate-500">{e.codigo}</p>
              <p className="mt-1 text-lg font-bold">
                {origemCidade?.nome} → {destinoCidade?.nome}
              </p>
              <p className="text-sm text-slate-500">
                Para {e.destinatarioNome.split(" ")[0]} · {e.volumes} volume(s) · {e.pesoKg.toLocaleString("pt-BR")} kg
              </p>
            </div>
            <Badge status={e.status} />
          </div>
          {e.pagador === "DESTINATARIO" && !e.fretePago && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Frete de {money(e.frete)} a pagar na retirada.
            </p>
          )}
          <div className="mt-6">
            <EncomendaTimeline e={e} />
          </div>
          {e.status === "DISPONIVEL_RETIRADA" && (
            <p className="mt-6 text-sm text-slate-600">Retire no porto de {destinoCidade?.nome} com documento com foto.</p>
          )}
        </div>
      )}
    </div>
  );
}
