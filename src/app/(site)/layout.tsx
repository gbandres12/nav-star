import Link from "next/link";
import { MessageCircle, PackageSearch, Ticket } from "lucide-react";
import { Logo } from "@/components/ui";
import { EMPRESA } from "@/lib/store";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium text-slate-700">
            <Link href="/viagens" className="hidden rounded-lg px-3 py-2 hover:bg-slate-100 sm:flex sm:items-center sm:gap-2">
              <Ticket size={16} /> Passagens
            </Link>
            <Link href="/rastreio" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100">
              <PackageSearch size={16} /> <span className="hidden sm:inline">Rastrear encomenda</span>
            </Link>
            <a href={`https://wa.me/${EMPRESA.whatsapp}`} className="ml-1 flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-white hover:bg-emerald-600">
              <MessageCircle size={16} /> <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-slate-600 sm:grid-cols-3">
          <div className="space-y-3">
            <Logo />
            <p>{EMPRESA.razaoSocial}<br />CNPJ {EMPRESA.cnpj}</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-slate-900">Atendimento (WhatsApp)</p>
            <ul className="space-y-1">
              {EMPRESA.whatsapps.map((w) => (
                <li key={w.link}>
                  <a href={`https://wa.me/${w.link}`} className="hover:text-rio-700">{w.cidade}: {w.numero}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 font-semibold text-slate-900">Links</p>
            <ul className="space-y-1">
              <li><Link href="/viagens" className="hover:text-rio-700">Comprar passagem</Link></li>
              <li><Link href="/rastreio" className="hover:text-rio-700">Rastrear encomenda</Link></li>
              <li><Link href="/admin" className="hover:text-rio-700">Área da empresa</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </>
  );
}
