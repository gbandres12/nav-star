"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/agencia/painel", l: "Viagens", exato: true },
  { href: "/agencia/painel/bilhetes", l: "Meus bilhetes", exato: false },
];

export function MenuPainel() {
  const path = usePathname();
  return (
    <nav className="flex gap-1" aria-label="Portal da agência">
      {ABAS.map((a) => {
        const ativa = a.exato ? path === a.href || path.startsWith("/agencia/painel/vender") : path.startsWith(a.href);
        return (
          <Link key={a.href} href={a.href} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${ativa ? "bg-rio-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {a.l}
          </Link>
        );
      })}
    </nav>
  );
}
