import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { RecuperarForm } from "./recuperar-form";

export const metadata = {
  title: "Recuperar Senha | São Tomé Expresso",
  description: "Recupere seu acesso ao Painel de Operações da São Tomé Expresso.",
};

export default function RecuperarSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex justify-center">
            <Logo />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-rio-950">
            Recuperar Senha
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Digite seu e-mail funcional para receber o link de redefinição de acesso.
          </p>
        </div>

        <div className="card shadow-xl border border-slate-200/80 bg-white p-8">
          <Suspense fallback={<div className="h-48 animate-pulse bg-slate-100 rounded-xl" />}>
            <RecuperarForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
