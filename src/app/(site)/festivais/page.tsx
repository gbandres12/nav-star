import { FestivalCard } from "@/components/site/festival-card";
import { Empty } from "@/components/ui";
import { cidade as getCidade } from "@/lib/data/catalogo";
import { festivaisNoSite } from "@/lib/data/festivais";
import { opcoesFestival } from "@/lib/data/utils";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Festivais", description: "Viagens especiais de lancha para os festivais da Amazônia" };

export default async function Festivais() {
  const lista = await festivaisNoSite();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Festivais</h1>
      <p className="mt-1 text-slate-600">Saídas extras e volta garantida para as festas da região.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {lista.length === 0 && <Empty>Nenhum festival com vendas abertas no momento.</Empty>}
        {await Promise.all(lista.map(async (f) => {
          const { ida, volta } = await opcoesFestival(f);
          const menor = Math.min(...[...ida, ...volta].map((o) => o.valor));
          const fCidade = await getCidade(f.cidadeId);
          return <FestivalCard key={f.id} f={f} cidade={fCidade?.nome || ""} aPartirDe={Number.isFinite(menor) ? money(menor) : undefined} />;
        }))}
      </div>
    </div>
  );
}
