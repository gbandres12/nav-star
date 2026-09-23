import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ActionForm, Campo } from "@/components/admin/action-form";
import { PageHeader } from "@/components/ui";
import { viagemAvulsaAction } from "@/lib/admin-actions";
import { localDayKey } from "@/lib/format";
import { garantirAcesso } from "@/lib/sessao";
import { db } from "@/lib/store";

export const metadata = { title: "Viagem avulsa" };

export default async function NovaViagem() {
  await garantirAcesso("/admin/linhas");
  const amanha = localDayKey(new Date(new Date().getTime() + 86_400_000));
  return (
    <>
      <Link href="/admin/viagens" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"><ChevronLeft size={16} /> Viagens</Link>
      <PageHeader title="Viagem avulsa" subtitle="Saída fora da programação semanal: feriado, fretamento, viagem extra" />
      <div className="card max-w-2xl p-6">
        <ActionForm action={viagemAvulsaAction} submit="Criar viagem">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Linha" className="sm:col-span-2">
              <select name="linhaId" required className="input">
                {db().linhas.filter((l) => l.ativa).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Embarcação" className="sm:col-span-2">
              <select name="embarcacaoId" required className="input">
                {db().embarcacoes.filter((e) => e.status === "ATIVA").map((e) => <option key={e.id} value={e.id}>{e.nome} · {e.assentoLivre ? `assento livre, ${e.capacidadePassageiros}` : e.assentos.length} lugares</option>)}
              </select>
            </Campo>
            <Campo label="Data da saída"><input name="dia" type="date" required min={amanha} defaultValue={amanha} className="input" /></Campo>
            <Campo label="Hora da saída (Manaus)"><input name="hora" type="time" required defaultValue="06:00" className="input" /></Campo>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
