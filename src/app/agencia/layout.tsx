import type { ReactNode } from "react";
import { Logo } from "@/components/ui";

export const metadata = {
  title: "Portal de agências",
  robots: { index: false, follow: false },
};

// Página própria, fora do /admin e do site: não carrega sidebar, nem sessão do Supabase Auth
export default function AgenciaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <span className="text-sm font-semibold text-slate-500">Portal de agências</span>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
