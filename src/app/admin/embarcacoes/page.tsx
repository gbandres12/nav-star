import { Plus } from "lucide-react";
import { SeatMap } from "@/components/seat-map";
import { Badge, PageHeader } from "@/components/ui";
import { db } from "@/lib/store";

export const metadata = { title: "Embarcações" };

export default function Embarcacoes() {
  return (
    <>
      <PageHeader
        title="Embarcações"
        subtitle="Frota da empresa e o mapa de poltronas de cada lancha"
        actions={<button className="btn-primary" disabled title="Disponível na fase com banco de dados"><Plus size={16} /> Nova embarcação</button>}
      />
      <div className="space-y-6">
        {db().embarcacoes.map((e) => (
          <section key={e.id} className="card p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold">{e.nome}</h2>
                  <Badge status={e.status} />
                </div>
                <p className="text-sm text-slate-500">{e.tipo === "LANCHA" ? "Lancha" : e.tipo} · Inscrição Capitania {e.inscricaoCapitania}</p>
              </div>
              <dl className="flex gap-6 text-sm">
                <div><dt className="text-slate-500">Passageiros</dt><dd className="text-lg font-bold">{e.capacidadePassageiros}</dd></div>
                <div><dt className="text-slate-500">Carga</dt><dd className="text-lg font-bold">{(e.capacidadeCargaKg / 1000).toLocaleString("pt-BR")} t</dd></div>
                <div><dt className="text-slate-500">Preferenciais</dt><dd className="text-lg font-bold">{e.assentos.filter((a) => a.tipo === "ESPECIAL").length}</dd></div>
              </dl>
            </div>
            <SeatMap assentos={e.assentos} colunas={e.colunasMapa} ocupados={[]} />
          </section>
        ))}
      </div>
    </>
  );
}
