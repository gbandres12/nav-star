import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Sidebar } from "@/components/admin/sidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Gestão", template: "%s · Gestão São Tomé" } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="no-print hidden h-16 items-center justify-end gap-3 border-b border-slate-200 bg-white px-8 lg:flex">
          <Link href="/admin/vender" className="btn bg-emerald-500 text-white hover:bg-emerald-600">
            <ShoppingCart size={16} /> Vender passagens
          </Link>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-rio-100 text-sm font-bold text-rio-700">AD</span>
            <div className="text-sm leading-tight">
              <p className="font-semibold text-slate-800">Administrador</p>
              <p className="text-xs text-slate-500">São Tomé Expresso</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
