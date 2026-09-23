import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { db, embarcacao } from "@/lib/store";
import { date, label, localDayKey } from "@/lib/format";

export const metadata = { title: "Tripulantes" };

export default async function Tripulantes() {
  await garantirAcesso("/admin/tripulantes");
  const hoje = localDayKey(new Date());
  const em60 = localDayKey(new Date(new Date().getTime() + 60 * 86_400_000));
  const situacao = (v?: string) => (!v ? null : v < hoje ? "vencida" : v <= em60 ? "a vencer" : null);
  const alertas = db().tripulantes.filter((t) => t.ativo && situacao(t.validadeHabilitacao));
  return (
    <>
      <PageHeader
        title="Tripulantes"
        subtitle="Equipe embarcada, habilitações e lotação por embarcação"
        actions={<Link href="/admin/tripulantes/novo" className="btn-primary"><Plus size={16} /> Novo tripulante</Link>}
      />
      {alertas.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <p>
            Habilitação vencida ou vencendo em 60 dias:{" "}
            {alertas.map((t) => `${t.nome} (${date(t.validadeHabilitacao! + "T12:00:00Z")})`).join(", ")}.
          </p>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Nome</th><th>Função</th><th>Habilitação</th><th>Validade</th><th>Embarcação</th><th>Telefone</th><th>Status</th></tr></thead>
          <tbody>
            {db().tripulantes.map((t) => {
              const s = situacao(t.validadeHabilitacao);
              return (
                <tr key={t.id}>
                  <td><Link href={`/admin/tripulantes/${t.id}`} className="font-semibold text-rio-700 hover:underline">{t.nome}</Link></td>
                  <td>{label(t.funcao)}</td>
                  <td className="font-mono text-xs">{t.habilitacao}</td>
                  <td className="whitespace-nowrap">
                    {t.validadeHabilitacao ? date(t.validadeHabilitacao + "T12:00:00Z") : "—"}
                    {s && <span className={`ml-2 text-xs font-semibold ${s === "vencida" ? "text-red-700" : "text-amber-700"}`}>{s}</span>}
                  </td>
                  <td>{t.embarcacaoId ? embarcacao(t.embarcacaoId).nome : <span className="text-slate-400">reserva</span>}</td>
                  <td className="whitespace-nowrap">{t.telefone}</td>
                  <td><Badge status={t.ativo ? "ATIVA" : "INATIVA"}>{t.ativo ? "Ativo" : "Inativo"}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
