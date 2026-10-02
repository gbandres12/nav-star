import { redirect } from "next/navigation";
import { AcessoAgencia } from "@/components/agencia/acesso-agencia";
import { empresaDoPortal } from "@/lib/agencia/banco";
import { agenciaAtual } from "@/lib/agencia/sessao";

export default async function PortalAgencia({ searchParams }: PageProps<"/agencia">) {
  if (await agenciaAtual()) redirect("/agencia/painel");
  const { empresa: param } = await searchParams;
  const empresa = await empresaDoPortal(typeof param === "string" ? param : null);

  if (!empresa) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900">Link inválido</h1>
        <p className="mt-2 text-sm text-slate-500">Use o link de acesso enviado pela empresa.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-black tracking-tight text-rio-950">Agências parceiras</h1>
      <p className="mb-5 text-sm text-slate-500">Venda passagens da {empresa.nome} pelo portal. Entre ou cadastre sua agência.</p>
      <AcessoAgencia empresaId={empresa.id} />
    </div>
  );
}
