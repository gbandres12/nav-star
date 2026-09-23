import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EncomendaForm } from "@/components/admin/encomenda-form";
import { PageHeader } from "@/components/ui";
import { cidadesAtendidas, db, linha } from "@/lib/store";
import { dateShort, time, weekday } from "@/lib/format";

export const metadata = { title: "Nova encomenda" };

export default function NovaEncomenda() {
  const agora = new Date();
  const viagens = db()
    .viagens.filter((v) => new Date(v.partida) > agora)
    .slice(0, 10)
    .map((v) => ({ id: v.id, label: `${weekday(v.partida)} ${dateShort(v.partida)} ${time(v.partida)} · ${linha(v.linhaId).nome}` }));

  return (
    <>
      <Link href="/admin/encomendas" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700">
        <ChevronLeft size={16} /> Encomendas
      </Link>
      <PageHeader title="Nova encomenda" subtitle="Registre a carga recebida no porto. O código de rastreio é gerado automaticamente." />
      <EncomendaForm cidades={cidadesAtendidas()} viagens={viagens} />
    </>
  );
}
