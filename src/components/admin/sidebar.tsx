"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType } from "react";
import {
  Anchor,
  ArrowLeftRight,
  BadgePercent,
  BarChart3,
  Bed,
  Building2,
  CalendarRange,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  Globe,
  HandCoins,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  Menu,
  Package,
  PartyPopper,
  Percent,
  Receipt,
  ReceiptText,
  Route,
  ScanLine,
  Settings,
  Ship,
  ShoppingCart,
  Store,
  Ticket,
  User,
  UserRound,
  Users,
  Vault,
  Wallet,
  X,
  XCircle,
  LogOut,
} from "lucide-react";
import { Logo } from "../ui";
import { podeAcessar } from "@/lib/permissoes";
import { RELATORIOS } from "@/lib/relatorios-lista";
import type { PapelUsuario } from "@/lib/types";
import { logoutAction } from "@/app/login/actions";

type Item = { href: string; l: string; i: ComponentType<{ size?: number; className?: string }> };
type Grupo = { t: string; i: Item["i"]; itens: Item[] } | { t: null; itens: Item[] };

const ICONE_RELATORIO: Record<string, Item["i"]> = {
  geral: Globe,
  fiscal: ReceiptText,
  "por-viagem": Anchor,
  "por-porto": Ticket,
  "por-usuario": User,
  "por-convenio": BadgePercent,
  individual: UserRound,
  caixas: Vault,
  "taxa-embarque": Building2,
  "porcentagem-sistema": Percent,
  "por-cidade": BarChart3,
  "por-horario": Clock,
  cancelamentos: XCircle,
  encomendas: Package,
};

const GRUPOS: Grupo[] = [
  {
    t: null,
    itens: [
      { href: "/admin", l: "Painel", i: LayoutDashboard },
      { href: "/admin/vender", l: "Vender passagens", i: ShoppingCart },
      { href: "/admin/embarque", l: "Embarque (QR)", i: ScanLine },
    ],
  },
  {
    t: "Comercial",
    i: Wallet,
    itens: [
      { href: "/admin/pedidos", l: "Pedidos e passagens", i: Receipt },
      { href: "/admin/caixa", l: "Caixa", i: Vault },
      { href: "/admin/cancelamentos", l: "Cancelamentos", i: XCircle },
      { href: "/admin/festivais", l: "Festivais", i: PartyPopper },
      { href: "/admin/convenios", l: "Convênios", i: BadgePercent },
      { href: "/admin/agencias", l: "Agências", i: Store },
    ],
  },
  {
    t: "Operação",
    i: CalendarRange,
    itens: [
      { href: "/admin/viagens", l: "Viagens", i: CalendarRange },
      { href: "/admin/mapa", l: "Mapa de embarcações", i: MapIcon },
      { href: "/admin/encomendas", l: "Encomendas", i: Package },
    ],
  },
  {
    t: "Embarcações",
    i: Ship,
    itens: [
      { href: "/admin/embarcacoes", l: "Embarcações", i: Ship },
      { href: "/admin/comodos", l: "Cômodos", i: Bed },
      { href: "/admin/tripulantes", l: "Tripulantes", i: Users },
    ],
  },
  {
    t: "Rotas",
    i: Route,
    itens: [
      { href: "/admin/linhas", l: "Linhas", i: ArrowLeftRight },
      { href: "/admin/trechos", l: "Trechos e preços", i: HandCoins },
      { href: "/admin/portos", l: "Portos", i: MapPin },
    ],
  },
  {
    t: "Relatórios",
    i: FileSpreadsheet,
    itens: RELATORIOS.map((r) => ({ href: `/admin/relatorios/${r.slug}`, l: r.titulo, i: ICONE_RELATORIO[r.slug] })),
  },
  {
    t: "Gestão",
    i: Settings,
    itens: [
      { href: "/admin/financeiro", l: "Financeiro", i: BarChart3 },
      { href: "/admin/usuarios", l: "Usuários", i: Users },
      { href: "/admin/configuracoes", l: "Configurações", i: Settings },
    ],
  },
];

export function Sidebar({ papel }: { papel: PapelUsuario }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ativo = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => podeAcessar(papel, i.href)) })).filter((g) => g.itens.length);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const aberto = (t: string, itens: Item[]) => abertos[t] ?? itens.some((i) => ativo(i.href));

  const link = ({ href, l, i: Icon }: Item, sub = false) => (
    <li key={href}>
      <Link
        href={href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-xl px-3 ${sub ? "py-2" : "py-2.5"} text-sm font-medium transition ${ativo(href) ? "bg-white text-rio-900 shadow" : sub ? "text-rio-200 hover:bg-white/10 hover:text-white" : "text-rio-100 hover:bg-white/10"}`}
      >
        <Icon size={sub ? 16 : 18} className={ativo(href) ? "text-rio-600" : "text-rio-300"} />
        {l}
      </Link>
    </li>
  );

  const nav = (
    <nav className="space-y-1">
      {grupos.map((g, gi) =>
        g.t === null ? (
          <ul key={gi} className="mb-3 space-y-0.5">{g.itens.map((i) => link(i))}</ul>
        ) : (
          <div key={g.t}>
            <button
              type="button"
              onClick={() => setAbertos({ ...abertos, [g.t]: !aberto(g.t, g.itens) })}
              aria-expanded={aberto(g.t, g.itens)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <g.i size={18} className="text-rio-300" />
              <span className="flex-1 text-left">{g.t}</span>
              <ChevronDown size={16} className={`text-rio-300 transition ${aberto(g.t, g.itens) ? "rotate-180" : ""}`} />
            </button>
            {aberto(g.t, g.itens) && (
              <ul className="mt-0.5 mb-2 space-y-0.5 rounded-xl bg-black/15 p-1.5">{g.itens.map((i) => link(i, true))}</ul>
            )}
          </div>
        ),
      )}
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
      {open && (
        <div className="no-print fixed inset-0 top-14 z-30 flex flex-col justify-between overflow-y-auto bg-rio-950 p-4 lg:hidden">
          {nav}
          <div className="mt-6 border-t border-white/10 pt-4 space-y-2">
            <Link href="/" className="block rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-medium text-rio-200 hover:bg-white/5">
              Ver site de vendas ↗
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/10 transition"
              >
                <LogOut size={14} /> Sair do sistema
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Desktop */}
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-rio-950 px-4 py-6 lg:flex">
        <Link href="/admin" className="mb-8 px-2">
          <Logo light />
        </Link>
        {nav}
        <div className="mt-auto space-y-2 pt-6">
          <Link href="/" className="block rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-medium text-rio-200 hover:bg-white/5">
            Ver site de vendas ↗
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/10 transition"
            >
              <LogOut size={14} /> Sair do sistema
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
