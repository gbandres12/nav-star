"use client";

import { trocarOperador } from "@/lib/admin-actions";

/** Provisório até o login (Fase A): simula o usuário logado para testar cada perfil */
export function OperadorSwitch({ atual, usuarios }: { atual: string; usuarios: { id: string; nome: string; papel: string }[] }) {
  return (
    <form action={trocarOperador}>
      <label className="sr-only" htmlFor="operador">Operando como</label>
      <select
        id="operador"
        name="usuarioId"
        defaultValue={atual}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-slate-200 bg-white py-1.5 pr-8 pl-2 text-xs font-medium text-slate-600"
        title="Operando como (simulação de login)"
      >
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>{u.nome} · {u.papel}</option>
        ))}
      </select>
    </form>
  );
}
