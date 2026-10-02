import { redirect } from "next/navigation";
import { ViagensAoVivo } from "@/components/agencia/viagens-ao-vivo";
import { lotacoes, viagensDoPortal } from "@/lib/agencia/dados";
import { agenciaAtual } from "@/lib/agencia/sessao";

export const metadata = { title: "Viagens" };

export default async function PainelViagens() {
  const ag = await agenciaAtual();
  if (!ag) redirect("/agencia");
  const viagens = await viagensDoPortal(ag.empresaId);
  const inicial = await lotacoes(ag.empresaId, viagens.map((v) => v.id));
  return (
    <>
      <h1 className="mb-1 text-xl font-black text-rio-950">Viagens abertas</h1>
      <p className="mb-5 text-sm text-slate-500">Vagas por trecho, ao vivo. Escolha uma viagem para emitir bilhetes.</p>
      <ViagensAoVivo viagens={viagens} inicial={inicial} />
    </>
  );
}
