import Link from "next/link";
import { KeyRound, TriangleAlert } from "lucide-react";
import { Logo } from "@/components/ui";
import { confirmarAcessoAction } from "./actions";

export const metadata = { title: "Acesso ao painel", robots: { index: false } };

export default async function Acesso({ searchParams }: PageProps<"/acesso">) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const tokenHash = s("token_hash");
  const tipo = s("type");
  const recuperacao = tipo === "recovery";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center"><div className="inline-flex justify-center"><Logo /></div></div>
        <div className="card border border-slate-200/80 bg-white p-8 text-center shadow-xl">
          {s("erro") || !tokenHash ? (
            <>
              <TriangleAlert className="mx-auto text-amber-500" size={40} />
              <h1 className="mt-3 text-xl font-bold text-rio-950">Este link já foi usado ou venceu</h1>
              <p className="mt-2 text-sm text-slate-600">
                Cada link de acesso vale uma vez só. Peça ao administrador um link novo (Usuários → Reenviar convite)
                ou, se você já criou sua senha, entre normalmente.
              </p>
              <Link href="/login" className="btn-primary mt-6 w-full">Ir para o login</Link>
            </>
          ) : (
            <>
              <KeyRound className="mx-auto text-rio-600" size={40} />
              <h1 className="mt-3 text-xl font-bold text-rio-950">{recuperacao ? "Redefinir sua senha" : "Ativar seu acesso"}</h1>
              <p className="mt-2 text-sm text-slate-600">
                Toque em continuar para {recuperacao ? "criar uma senha nova" : "criar sua senha e entrar no painel"}.
              </p>
              <form action={confirmarAcessoAction} className="mt-6">
                <input type="hidden" name="token_hash" value={tokenHash} />
                <input type="hidden" name="type" value={tipo} />
                <input type="hidden" name="next" value={s("next") || "/primeiro-acesso"} />
                <button className="btn-primary w-full py-3 text-base">Continuar</button>
              </form>
              <p className="mt-4 text-xs text-slate-500">Use este link só uma vez e não repasse para outras pessoas.</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
