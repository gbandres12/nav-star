import Link from "next/link";
import { redirect } from "next/navigation";
import { CancelarBilhete } from "@/components/agencia/cancelar-bilhete";
import { Badge } from "@/components/ui";
import { bilhetesDaAgencia } from "@/lib/agencia/dados";
import { agenciaAtual } from "@/lib/agencia/sessao";
import { dateTime, label, money } from "@/lib/format";

export const metadata = { title: "Meus bilhetes" };

export default async function MeusBilhetes() {
  const ag = await agenciaAtual();
  if (!ag) redirect("/agencia");
  const bilhetes = await bilhetesDaAgencia(ag.id);
  return (
    <>
      <h1 className="mb-1 text-xl font-black text-rio-950">Meus bilhetes</h1>
      <p className="mb-5 text-sm text-slate-500">Bilhetes emitidos pela agência. Dá para cancelar até o barco sair do embarque.</p>
      <div className="card overflow-x-auto">
        {bilhetes.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Nenhum bilhete emitido ainda.</p>
        ) : (
          <table className="table-base">
            <thead><tr><th>Bilhete</th><th>Passageiro</th><th>Viagem</th><th>Embarque</th><th className="text-right">Valor</th><th>Status</th><th /></tr></thead>
            <tbody>
              {bilhetes.map((b) => (
                <tr key={b.id}>
                  <td><Link href={`/agencia/painel/bilhetes/${b.id}`} className="font-mono text-xs font-bold text-rio-700 hover:underline">{b.numero}</Link></td>
                  <td className="whitespace-nowrap font-medium">{b.passageiro}<span className="block text-xs font-normal text-slate-500">{label(b.tipo)}</span></td>
                  <td className="whitespace-nowrap">{b.origem} → {b.destino}</td>
                  <td className="whitespace-nowrap tabular-nums">{dateTime(b.embarque)}</td>
                  <td className="text-right tabular-nums">{money(b.valorCobrado + b.taxa)}</td>
                  <td><Badge status={b.status} /></td>
                  <td className="text-right">{b.podeCancelar && <CancelarBilhete id={b.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
