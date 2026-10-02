import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { MenuPainel } from "@/components/agencia/menu-painel";
import { sairAgenciaAction } from "@/lib/agencia/acoes";
import { agenciaAtual } from "@/lib/agencia/sessao";

export default async function PainelLayout({ children }: { children: ReactNode }) {
  const ag = await agenciaAtual();
  if (!ag) redirect("/agencia");
  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <p className="font-bold text-rio-950">{ag.nome}</p>
          <MenuPainel />
        </div>
        <form action={sairAgenciaAction}><button className="btn-ghost !px-3 !py-1.5 text-sm">Sair</button></form>
      </div>
      {children}
    </>
  );
}
