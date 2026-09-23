import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { PrimeiroAcessoForm } from "./primeiro-acesso-form";

export const metadata = {
  title: "Primeiro Acesso & Ativação de Conta | São Tomé Expresso",
  description: "Defina sua senha de acesso ao Painel de Operações da São Tomé Expresso.",
};

export default function PrimeiroAcessoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex justify-center">
            <Logo />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-rio-950">
            Boas-vindas à Equipe!
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Defina sua senha pessoal para ativar seu acesso ao Painel de Operações.
          </p>
        </div>

        <div className="card shadow-xl border border-slate-200/80 bg-white p-8">
          <Suspense fallback={<div className="h-48 animate-pulse bg-slate-100 rounded-xl" />}>
            <PrimeiroAcessoForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
