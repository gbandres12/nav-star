import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { FormVenda } from "@/components/agencia/form-venda";
import { conveniosDoPortal, lotacoes, viagemDoPortal } from "@/lib/agencia/dados";
import { agenciaAtual } from "@/lib/agencia/sessao";
import { longDay, time } from "@/lib/format";

export const metadata = { title: "Vender passagem" };

export default async function VenderPassagem({ params }: PageProps<"/agencia/painel/vender/[id]">) {
  const ag = await agenciaAtual();
  if (!ag) redirect("/agencia");
  const { id } = await params;
  const viagem = await viagemDoPortal(ag.empresaId, id);
  if (!viagem) notFound();
  const [lot, convenios] = await Promise.all([lotacoes(ag.empresaId, [id]), conveniosDoPortal(ag.empresaId)]);
  const inicial = lot[id] ?? [];
  return (
    <>
      <Link href="/agencia/painel" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Viagens
      </Link>
      <h1 className="text-xl font-black text-rio-950">{viagem.linha}</h1>
      <p className="mb-5 text-sm text-slate-500">{longDay(viagem.partida)} · saída {time(viagem.partida)} · {viagem.embarcacao}</p>
      <FormVenda viagem={viagem} inicial={inicial} convenios={convenios} embarques={viagem.embarques} hoje={new Date().toISOString().slice(0, 10)} />
    </>
  );
}
