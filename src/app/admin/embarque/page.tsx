import { EmbarqueForm } from "@/components/admin/embarque-form";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/store";

export const metadata = { title: "Embarque" };

export default function Embarque() {
  // Sugere um bilhete válido da próxima viagem para testar
  const agora = new Date();
  const prox = db().viagens.find((v) => new Date(v.partida) > agora);
  const exemplo = prox && db().passagens.find((p) => p.viagemId === prox.id && p.status === "EMITIDA")?.qrToken;

  return (
    <>
      <PageHeader title="Validação de embarque" subtitle="Leia o QR Code do bilhete no portão. Cada bilhete só pode ser usado uma vez." />
      <EmbarqueForm exemplo={exemplo} />
    </>
  );
}
