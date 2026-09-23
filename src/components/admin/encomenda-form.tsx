"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { novaEncomenda } from "@/lib/actions";
import type { Cidade } from "@/lib/types";

type Opcao = { id: string; label: string };

export function EncomendaForm({ cidades, viagens }: { cidades: Cidade[]; viagens: Opcao[] }) {
  const [state, action, pending] = useActionState(novaEncomenda, undefined);
  const f = (name: string, l: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={name}>{l}</label>
      <input id={name} name={name} className="input" {...props} />
    </div>
  );

  return (
    <form action={action} className="space-y-6">
      <section className="card p-6">
        <h2 className="mb-4 font-bold">Rota e viagem</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Origem</label>
            <select name="origemCidadeId" className="input" defaultValue="manaus">
              {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}/{c.uf}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Destino</label>
            <select name="destinoCidadeId" className="input" defaultValue="parintins">
              {cidades.map((c) => <option key={c.id} value={c.id}>{c.nome}/{c.uf}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Viagem (opcional)</label>
            <select name="viagemId" className="input" defaultValue="">
              <option value="">Definir no embarque</option>
              {viagens.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-4 font-bold">Remetente</h2>
          <div className="grid gap-4">
            {f("remetenteNome", "Nome", { required: true })}
            <div className="grid gap-4 sm:grid-cols-2">
              {f("remetenteDoc", "CPF / CNPJ", { required: true })}
              {f("remetenteTel", "Telefone", { required: true, inputMode: "tel" })}
            </div>
          </div>
        </section>
        <section className="card p-6">
          <h2 className="mb-4 font-bold">Destinatário</h2>
          <div className="grid gap-4">
            {f("destinatarioNome", "Nome", { required: true })}
            {f("destinatarioTel", "Telefone (recebe aviso de chegada)", { required: true, inputMode: "tel" })}
          </div>
        </section>
      </div>

      <section className="card p-6">
        <h2 className="mb-4 font-bold">Carga e frete</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">{f("descricao", "Descrição do conteúdo", { required: true, placeholder: "Ex.: 2 caixas de roupas" })}</div>
          {f("volumes", "Volumes", { type: "number", min: 1, defaultValue: 1 })}
          {f("pesoKg", "Peso (kg)", { type: "number", step: "0.1", min: 0, required: true })}
          {f("valorDeclarado", "Valor declarado (R$)", { type: "number", step: "0.01", min: 0 })}
          {f("frete", "Frete (R$)", { type: "number", step: "0.01", min: 0, required: true })}
          <div>
            <label className="label">Quem paga o frete</label>
            <select name="pagador" className="input">
              <option value="REMETENTE">Remetente (pago agora)</option>
              <option value="DESTINATARIO">Destinatário (na retirada)</option>
            </select>
          </div>
        </div>
      </section>

      {state?.erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.erro}</p>}
      <div className="flex justify-end">
        <button className="btn-primary px-6" disabled={pending}>
          {pending && <Loader2 size={16} className="animate-spin" />} Registrar e gerar etiqueta
        </button>
      </div>
    </form>
  );
}
