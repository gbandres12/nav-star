"use client";

import { ActionForm, Campo, Checkbox } from "@/components/admin/action-form";
import { salvarPisosAction } from "@/lib/agencias-parceiras-actions";
import { label } from "@/lib/format";

export function PisosAgenciaForm({ viagemId, categorias, pisos }: { viagemId: string; categorias: readonly string[]; pisos: Record<string, number> }) {
  return (
    <ActionForm action={salvarPisosAction} submit="Salvar pisos">
      <input type="hidden" name="viagemId" value={viagemId} />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categorias.map((c) => (
          <Campo key={c} label={`${label(c)} (%)`}>
            <input name={`piso_${c}`} type="number" min={0} max={100} step="0.01" required defaultValue={pisos[c] ?? 100} className="input" />
          </Campo>
        ))}
      </div>
      <div className="mt-3"><Checkbox name="aplicarFuturas" label="Aplicar também às próximas viagens desta linha" /></div>
    </ActionForm>
  );
}
