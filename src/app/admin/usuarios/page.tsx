import Link from "next/link";
import { Plus, UserCheck, Clock, Sparkles } from "lucide-react";
import { PERMISSOES } from "@/components/admin/usuario-form";
import { Badge, PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { usuarios as buscarUsuarios, agencias as buscarAgencias, linhas as buscarLinhas } from "@/lib/data";
import { dateTime, label } from "@/lib/format";
import { ReenviarConviteBtn } from "@/components/admin/reenviar-convite-btn";

export const metadata = { title: "Usuários e Operadores | NavStar" };

export default async function Usuarios() {
  await garantirAcesso("/admin/usuarios");
  const [listaUsuarios, listaAgencias, listaLinhas] = await Promise.all([
    buscarUsuarios(),
    buscarAgencias(),
    buscarLinhas(),
  ]);

  const mapLinhas = new Map(listaLinhas.map((l) => [l.id, l.nome]));
  const mapAgencias = new Map(listaAgencias.map((a) => [a.id, a.nome]));

  return (
    <>
      <PageHeader
        title="Usuários e Operadores"
        subtitle="Gerencie quem acessa o painel de operações, permissões e status do onboarding"
        actions={
          <Link href="/admin/usuarios/novo" className="btn-primary flex items-center gap-1.5">
            <Plus size={16} /> Novo Operador
          </Link>
        }
      />

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contato / E-mail</th>
              <th>Perfil</th>
              <th>Agência</th>
              <th>Linhas autorizadas</th>
              <th>Onboarding</th>
              <th>Último acesso</th>
              <th>Status</th>
              <th>Acesso</th>
            </tr>
          </thead>
          <tbody>
            {listaUsuarios.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link
                    href={`/admin/usuarios/${u.id}`}
                    className="font-semibold whitespace-nowrap text-rio-700 hover:underline"
                  >
                    {u.nome}
                  </Link>
                </td>
                <td>
                  <div className="text-sm">
                    <p className="text-slate-800">{u.email}</p>
                    {u.telefone && <p className="text-xs text-slate-500">{u.telefone}</p>}
                  </div>
                </td>
                <td title={PERMISSOES[u.papel]} className="whitespace-nowrap font-medium text-slate-700">
                  {label(u.papel)}
                </td>
                <td>{u.agenciaId ? mapAgencias.get(u.agenciaId) ?? "—" : "Matriz (Direto)"}</td>
                <td className="text-xs text-slate-600 max-w-[200px] truncate">
                  {u.linhasPermitidas.length
                    ? u.linhasPermitidas.map((l) => mapLinhas.get(l) || l).join(", ")
                    : "Todas as linhas"}
                </td>
                <td>
                  {u.onboardingConcluido ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <UserCheck size={12} /> Concluído
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200" title={`Passo atual: ${u.onboardingPasso || 0}`}>
                      <Clock size={12} /> Pendente
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap text-xs text-slate-600">
                  {u.ultimoAcesso ? dateTime(u.ultimoAcesso) : "Nunca acessou"}
                </td>
                <td>
                  <Badge status={u.ativo ? "ATIVA" : "INATIVA"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                </td>
                <td>
                  <ReenviarConviteBtn usuarioId={u.id} nome={u.nome} telefone={u.telefone} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            Trilhas de Onboarding por Perfil
          </h2>
          <p className="text-xs text-slate-600 mb-4">
            Cada operador recebe um checklist de boas-vindas customizado para sua rotina na São Tomé Expresso:
          </p>
          <ul className="space-y-3 text-sm">
            <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="font-semibold text-rio-800">Vendedor / Agência:</span>
              <p className="text-xs text-slate-600 mt-0.5">Abertura de caixa diário, emissão rápida no balcão (em menos de 1 min), recebimento PIX e despacho de encomendas.</p>
            </li>
            <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="font-semibold text-rio-800">Conferente de Cais:</span>
              <p className="text-xs text-slate-600 mt-0.5">Instalação de atalho no celular, validação de bilhetes por QR Code na rampa e conferência de manifesto de embarque.</p>
            </li>
            <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="font-semibold text-rio-800">Gerente / Administrador:</span>
              <p className="text-xs text-slate-600 mt-0.5">Gestão de escalas de tripulantes, trocas de embarcação, conferência de sangrias e relatórios financeiros.</p>
            </li>
          </ul>
        </div>

        <div className="card p-6">
          <h2 className="mb-3 font-bold text-slate-900">Perfis de Acesso & Segurança</h2>
          <ul className="grid gap-4 text-sm">
            {Object.entries(PERMISSOES).map(([k, v]) => (
              <li key={k} className="border-b border-slate-100 pb-2 last:border-none">
                <p className="font-semibold text-slate-800">{label(k)}</p>
                <p className="text-xs text-slate-500">{v}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
