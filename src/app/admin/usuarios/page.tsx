import { Plus } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";
import { cidade, db, linha } from "@/lib/store";
import { dateTime, label } from "@/lib/format";

export const metadata = { title: "Usuários e agências" };

const PERMISSOES: Record<string, string> = {
  ADMIN: "Acesso total, incluindo usuários e configurações",
  GERENTE: "Operação, cadastros e financeiro",
  VENDEDOR: "Venda no balcão, pedidos e encomendas",
  CONFERENTE: "Embarque (QR) e movimentação de encomendas",
};

export default function Usuarios() {
  const { usuarios, agencias } = db();
  return (
    <>
      <PageHeader
        title="Usuários e agências"
        subtitle="Quem acessa o sistema e o que cada um pode fazer"
        actions={<button className="btn-primary" disabled title="Disponível na fase com banco de dados"><Plus size={16} /> Novo usuário</button>}
      />
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Agência</th><th>Linhas permitidas</th><th>Último acesso</th><th>Status</th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold whitespace-nowrap">{u.nome}</td>
                <td className="text-slate-600">{u.email}</td>
                <td title={PERMISSOES[u.papel]}>{label(u.papel)}</td>
                <td>{agencias.find((a) => a.id === u.agenciaId)?.nome ?? "—"}</td>
                <td className="text-slate-600">{u.linhasPermitidas.length ? u.linhasPermitidas.map((l) => linha(l).nome).join(", ") : "Todas"}</td>
                <td className="whitespace-nowrap text-slate-600">{u.ultimoAcesso ? dateTime(u.ultimoAcesso) : "—"}</td>
                <td><Badge status={u.ativo ? "ATIVA" : "INATIVA"}>{u.ativo ? "Ativo" : "Inativo"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-4 font-bold">Perfis de acesso</h2>
          <ul className="space-y-3 text-sm">
            {Object.entries(PERMISSOES).map(([k, v]) => (
              <li key={k}>
                <p className="font-semibold">{label(k)}</p>
                <p className="text-slate-500">{v}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="card overflow-x-auto">
          <h2 className="p-6 pb-3 font-bold">Agências parceiras</h2>
          <table className="table-base">
            <thead><tr><th>Agência</th><th>Cidade</th><th>Comissão</th><th>Status</th></tr></thead>
            <tbody>
              {agencias.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold">{a.nome}</td>
                  <td>{cidade(a.cidadeId).nome}</td>
                  <td>{a.comissaoPercentual}%</td>
                  <td><Badge status={a.ativa ? "ATIVA" : "INATIVA"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
