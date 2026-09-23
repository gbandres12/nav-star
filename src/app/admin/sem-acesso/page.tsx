import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { label } from "@/lib/format";
import { operadorAtual } from "@/lib/sessao";

export const metadata = { title: "Sem acesso" };

export default async function SemAcesso() {
  const op = await operadorAtual();
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <ShieldAlert className="mx-auto text-amber-500" size={40} />
      <h1 className="mt-4 text-xl font-bold">Acesso restrito</h1>
      <p className="mt-2 text-sm text-slate-600">
        O perfil <strong>{label(op.papel)}</strong> não tem permissão para esta área. Fale com o administrador se precisar de acesso.
      </p>
      <Link href="/admin" className="btn-primary mt-6">Voltar ao painel</Link>
    </div>
  );
}
