import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EncomendaForm } from "@/components/admin/encomenda-form";
import { PageHeader } from "@/components/ui";
import { dateShort, time, weekday } from "@/lib/format";
import { cidadesAtendidas, viagensAdmin, linhas } from "@/lib/data";

export const metadata = { title: "Nova encomenda" };

export default async function NovaEncomenda() {
  const c = await cidadesAtendidas();
  const proximasViagens = await viagensAdmin({ aba: "proximas" });
  const allLinhas = await linhas();

  const viagens = proximasViagens
    .slice(0, 10)
    .map((v) => {
      const l = allLinhas.find(x => x.id === v.linhaId);
      return { 
        id: v.id, 
        label: `${weekday(v.partida)} ${dateShort(v.partida)} ${time(v.partida)} · ${l?.nome || "Linha"}` 
      };
    });

  return (
    <>
      <Link href="/admin/encomendas" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Encomendas
      </Link>
      <PageHeader title="Nova encomenda" subtitle="Registre a carga recebida no porto. O código de rastreio é gerado automaticamente." />
      <EncomendaForm cidades={c} viagens={viagens} />
    </>
  );
}
