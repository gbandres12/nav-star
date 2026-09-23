import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { UsuarioForm } from "@/components/admin/usuario-form";
import { PageHeader } from "@/components/ui";
import { garantirAcesso } from "@/lib/sessao";
import { usuario as buscarUsuario, agencias as buscarAgencias, linhas as buscarLinhas } from "@/lib/data";

export const metadata = { title: "Editar Usuário | NavStar" };

export default async function EditarUsuario({ params }: { params: Promise<{ id: string }> }) {
  await garantirAcesso("/admin/usuarios");
  const { id } = await params;
  const [u, listaAgencias, listaLinhas] = await Promise.all([
    buscarUsuario(id),
    buscarAgencias(),
    buscarLinhas(),
  ]);

  if (!u) notFound();

  return (
    <>
      <Link
        href="/admin/usuarios"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-rio-700"
      >
        <ChevronLeft size={16} /> Voltar para Usuários
      </Link>
      <PageHeader
        title={`Editar: ${u.nome}`}
        subtitle={`Perfil: ${u.papel} • E-mail: ${u.email}`}
      />
      <div className="card p-6">
        <UsuarioForm
          u={u}
          agencias={listaAgencias.map(({ id, nome }) => ({ id, nome }))}
          linhas={listaLinhas.map(({ id, nome }) => ({ id, nome }))}
        />
      </div>
    </>
  );
}
