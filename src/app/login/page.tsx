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
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <section className="relative hidden overflow-hidden lg:block">
        <Image
          src="/login-barco.webp"
          alt="Lancha São Tomé Expresso navegando"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-rio-950/80 via-rio-950/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-10 text-white">
          <p className="text-3xl font-black tracking-tight">Navegando com segurança.</p>
          <p className="mt-2 max-w-md text-sm text-white/80">
            Gestão da frota e das operações da São Tomé Expresso em um só lugar.
          </p>
        </div>
      </section>
      <div className="flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
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
