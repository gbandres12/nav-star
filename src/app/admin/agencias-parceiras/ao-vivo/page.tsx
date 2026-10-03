import { PainelAgenciasAoVivo } from "@/components/admin/painel-agencias-ao-vivo";
import { PageHeader } from "@/components/ui";
import { painelAoVivo } from "@/lib/data/agencias-parceiras";
import { garantirAcesso } from "@/lib/sessao";

export const metadata = { title: "Agências ao vivo" };

export default async function AgenciasAoVivo() {
  await garantirAcesso("/admin/agencias-parceiras");
  const inicial = await painelAoVivo();
  return (
    <>
      <PageHeader title="Agências ao vivo" subtitle="Vendas, cadastros e alertas das agências parceiras, atualizados sozinhos." />
      <PainelAgenciasAoVivo inicial={inicial} />
    </>
  );
}
