import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { UsuarioForm } from "@/components/admin/usuario-form";
import { PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { agencias as buscarAgencias, linhas as buscarLinhas } from "@/lib/data";

export const metadata = { title: "Novo Usuário | NavStar" };

export default async function NovoUsuario() {
  await garantirAcesso("/admin/usuarios");
  const [listaAgencias, listaLinhas] = await Promise.all([
    buscarAgencias(),
    buscarLinhas(),
  ]);

  return (
    <>
      <Link
        href="/admin/usuarios"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"
      >
        <ChevronLeft size={16} /> Voltar para Usuários
      </Link>
      <PageHeader
        title="Cadastrar Novo Operador"
        subtitle="Crie o acesso de colaboradores e agentes com geração de convite seguro e onboarding"
      />
      <div className="card p-6">
        <UsuarioForm
          agencias={listaAgencias.map(({ id, nome }) => ({ id, nome }))}
          linhas={listaLinhas.map(({ id, nome }) => ({ id, nome }))}
        />
      </div>
    </>
  );
}
