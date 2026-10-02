import { Suspense } from "react";
import Image from "next/image";
import { Logo } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Login de Operadores | NavStar - São Tomé Expresso",
  description: "Painel de controle e operação da frota de lanchas São Tomé Expresso.",
};

export default function LoginPage() {
  return (
    <main className="relative isolate grid min-h-screen bg-slate-50 lg:grid-cols-2">
      {/* Celular: a foto cobre a tela toda, atrás do formulário. Computador: ocupa a metade esquerda. */}
      <section className="absolute inset-0 -z-10 overflow-hidden lg:relative lg:z-auto">
        <Image
          src="/login-barco.webp"
          alt="Lancha São Tomé Expresso navegando"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-rio-950/40 lg:bg-gradient-to-t lg:from-rio-950/80 lg:via-rio-950/20 lg:to-transparent" />
        <div className="absolute right-0 bottom-0 left-0 hidden p-10 text-white lg:block">
          <p className="text-3xl font-black tracking-tight">Navegando com segurança.</p>
          <p className="mt-2 max-w-md text-sm text-white/80">
            Gestão da frota e das operações da São Tomé Expresso em um só lugar.
          </p>
        </div>
      </section>
      <div className="flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white/85 p-5 backdrop-blur-sm sm:p-6 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="text-center">
          <div className="inline-flex justify-center">
            <Logo />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-rio-950">
            Painel de Operações
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Faça login com suas credenciais para acessar o sistema.
          </p>
        </div>

        <div className="card shadow-xl border border-slate-200/80 bg-white p-8">
          <Suspense fallback={<div className="h-48 animate-pulse bg-slate-100 rounded-xl" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
      </div>
    </main>
  );
}
