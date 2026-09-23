"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Anchor,
  BarChart3,
  CalendarRange,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  Route,
  ScanLine,
  Ship,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { Logo } from "../ui";

const GRUPOS = [
  {
    t: null,
    itens: [
      { href: "/admin", l: "Painel", i: LayoutDashboard },
      { href: "/admin/vender", l: "Vender passagens", i: ShoppingCart },
      { href: "/admin/embarque", l: "Embarque (QR)", i: ScanLine },
    ],
  },
  {
    t: "Operação",
    itens: [
      { href: "/admin/viagens", l: "Viagens", i: CalendarRange },
      { href: "/admin/pedidos", l: "Pedidos e passagens", i: Receipt },
      { href: "/admin/encomendas", l: "Encomendas", i: Package },
    ],
  },
  {
    t: "Cadastros",
    itens: [
      { href: "/admin/linhas", l: "Linhas e tarifas", i: Route },
      { href: "/admin/embarcacoes", l: "Embarcações", i: Ship },
      { href: "/admin/portos", l: "Portos", i: Anchor },
    ],
  },
  {
    t: "Gestão",
    itens: [
      { href: "/admin/financeiro", l: "Financeiro", i: BarChart3 },
      { href: "/admin/usuarios", l: "Usuários e agências", i: Users },
    ],
  },
];

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ativo = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const nav = (
    <nav className="space-y-6">
      {GRUPOS.map((g, gi) => (
        <div key={gi}>
          {g.t && <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.14em] text-rio-300/70 uppercase">{g.t}</p>}
          <ul className="space-y-0.5">
            {g.itens.map(({ href, l, i: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${ativo(href) ? "bg-white text-rio-900 shadow" : "text-rio-100 hover:bg-white/10"}`}
                >
                  <Icon size={18} className={ativo(href) ? "text-rio-600" : "text-rio-300"} />
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile */}
      <div className="no-print sticky top-0 z-40 flex h-14 items-center justify-between bg-rio-950 px-4 lg:hidden">
        <Link href="/admin"><Logo light /></Link>
        <button onClick={() => setOpen(!open)} className="text-white" aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && <div className="no-print fixed inset-0 top-14 z-30 overflow-y-auto bg-rio-950 p-4 lg:hidden">{nav}</div>}

      {/* Desktop */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-rio-950 px-4 py-6 lg:flex">
        <Link href="/admin" className="mb-8 px-2">
          <Logo light />
        </Link>
        {nav}
        <div className="mt-auto pt-6">
          <Link href="/" className="block rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-medium text-rio-200 hover:bg-white/5">
            Ver site de vendas ↗
          </Link>
        </div>
      </aside>
    </>
  );
}
