import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { OperadorSwitch } from "@/components/admin/operador-switch";
import { Sidebar } from "@/components/admin/sidebar";
import { label } from "@/lib/format";
import { podeAcessar } from "@/lib/permissoes";
import { operadorAtual } from "@/lib/sessao";
import { db, EMPRESA } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Gestão", template: "%s · Gestão São Tomé" } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const op = await operadorAtual();
  const iniciais = op.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const usuarios = db().usuarios.filter((u) => u.ativo).map((u) => ({ id: u.id, nome: u.nome, papel: label(u.papel) }));
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar papel={op.papel} />
      <div className="min-w-0 flex-1">
        <header className="no-print flex flex-wrap items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-2 lg:h-16 lg:px-8 lg:py-0">
          <OperadorSwitch atual={op.id} usuarios={usuarios} />
          {podeAcessar(op.papel, "/admin/vender") && (
            <Link href="/admin/vender" className="btn hidden bg-emerald-500 text-white hover:bg-emerald-600 lg:inline-flex">
              <ShoppingCart size={16} /> Vender passagens
            </Link>
          )}
          <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 lg:flex">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-rio-100 text-sm font-bold text-rio-700">{iniciais}</span>
            <div className="text-sm leading-tight">
              <p className="font-semibold text-slate-800">{op.nome}</p>
              <p className="text-xs text-slate-500">{label(op.papel)} · {EMPRESA.nome}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
