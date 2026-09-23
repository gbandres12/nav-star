import { PageHeader } from "@/components/ui";
import { cidade, db } from "@/lib/store";
import { money } from "@/lib/format";

export const metadata = { title: "Portos" };

export default function Portos() {
  return (
    <>
      <PageHeader title="Portos" subtitle="Locais de embarque e desembarque, com a taxa cobrada em cada um" />
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th>Porto</th><th>Município</th><th>Endereço</th><th className="text-right">Taxa de embarque</th><th>Linhas</th></tr>
          </thead>
          <tbody>
            {db().portos.map((p) => {
              const c = cidade(p.cidadeId);
              const linhas = db().linhas.filter((l) => l.paradas.some((x) => x.portoId === p.id));
              return (
                <tr key={p.id}>
                  <td className="font-semibold">{p.nome}</td>
                  <td>{c.nome}/{c.uf}</td>
                  <td className="text-slate-600">{p.endereco}</td>
                  <td className="text-right tabular-nums">{money(p.taxaEmbarque)}</td>
                  <td className="text-slate-600">{linhas.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
