import { EmbarqueForm } from "@/components/admin/embarque-form";
import { Empty, PageHeader } from "@/components/ui";
import { viagensParaEmbarque } from "@/lib/data/viagens-gestao";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Embarque" };

export default async function Embarque() {
  await garantirAcesso("/admin/embarque");
  const viagens = await viagensParaEmbarque();
  const preferida = viagens.find((v) => v.status === "EMBARQUE") ?? viagens.find((v) => v.status === "EM_CURSO") ?? viagens[0];
  return (
    <>
      <PageHeader title="Validação de embarque" subtitle="Escolha a viagem deste portão e leia o QR do bilhete. Cada bilhete só vale para essa saída." />
      {viagens.length === 0 ? (
        <Empty>Não há viagem em andamento ou nos próximos dias para validar embarque.</Empty>
      ) : (
        <EmbarqueForm viagens={viagens} viagemInicial={preferida?.id ?? ""} />
      )}
    </>
  );
}
