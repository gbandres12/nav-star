import { EmbarqueForm } from "@/components/admin/embarque-form";
import { PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Embarque" };

export default async function Embarque() {
  await garantirAcesso("/admin/embarque");
  return (
    <>
      <PageHeader title="Validação de embarque" subtitle="Leia o QR Code do bilhete no portão. Cada bilhete só pode ser usado uma vez." />
      <EmbarqueForm />
    </>
  );
}
