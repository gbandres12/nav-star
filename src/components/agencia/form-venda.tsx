"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { precosPortalAction, venderPassagemAction } from "@/lib/agencia/portal";
import type { ConvenioPortal, PrecoCategoria, Trecho, ViagemPortal } from "@/lib/agencia/dados";
import { label, money } from "@/lib/format";
import { Campo } from "@/components/admin/action-form";
import { BarrasLotacao } from "./barras-lotacao";
import { useLotacaoAoVivo } from "./use-lotacao";

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** `embarques`: ordens das paradas em que ainda dá para embarcar; `hoje`: AAAA-MM-DD (calculados no servidor) */
export function FormVenda({ viagem, inicial, convenios, embarques: ordensEmbarque, hoje }: { viagem: ViagemPortal; inicial: Trecho[]; convenios: ConvenioPortal[]; embarques: number[]; hoje: string }) {
  const ultima = viagem.paradas[viagem.paradas.length - 1].ordem;
  const embarques = viagem.paradas.filter((p) => ordensEmbarque.includes(p.ordem));
  const lotacao = useLotacaoAoVivo([viagem.id], { [viagem.id]: inicial });
  const trechos = lotacao[viagem.id] ?? inicial;

  const [origem, setOrigem] = useState(embarques[0]?.ordem ?? 0);
  const [destino, setDestino] = useState(ultima);
  const [tipo, setTipo] = useState("INTEIRA");
  const [convenioId, setConvenioId] = useState("");
  const [edicao, setEdicao] = useState<{ k: string; v: string }>();
  const [precos, setPrecos] = useState<{ chave: string; lista: PrecoCategoria[] }>();
  const [estado, acao, enviando] = useActionState(venderPassagemAction, undefined);

  const chave = `${origem}-${destino}-${convenioId}`;
  useEffect(() => {
    let vivo = true;
    precosPortalAction(viagem.id, origem, destino, convenioId || undefined).then((lista) => vivo && setPrecos({ chave, lista: lista ?? [] }));
    return () => {
      vivo = false;
    };
  }, [viagem.id, origem, destino, convenioId, chave]);

  const carregando = precos?.chave !== chave;
  const lista = carregando ? [] : precos.lista;
  const preco = lista.find((p) => p.tipo === tipo) ?? lista.find((p) => p.tipo === "INTEIRA") ?? lista[0];
  const kValor = `${chave}:${preco?.tipo}`;
  const valorTxt = edicao?.k === kValor ? edicao.v : preco ? preco.tabela.toFixed(2) : "";
  const valor = Number(valorTxt.replace(",", "."));
  const abaixoDoPiso = !!preco && Number.isFinite(valor) && valor < preco.piso;
  const vagas = Math.min(...trechos.filter((t) => t.ordemOrigem >= origem && t.ordemOrigem < destino).map((t) => t.livres), Infinity);
  const semVaga = vagas === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <form
        className="card space-y-5 p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const dados = new FormData(e.currentTarget);
          startTransition(() => acao(dados));
        }}
      >
        <input type="hidden" name="viagemId" value={viagem.id} />
        <input type="hidden" name="tipo" value={preco?.tipo ?? ""} />
        <input type="hidden" name="convenio" value={convenioId} />

        <fieldset className="space-y-3">
          <legend className="font-bold text-slate-900">1. Trecho e valor</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Embarque">
              <select
                name="origem"
                className="input"
                value={origem}
                onChange={(e) => {
                  const o = Number(e.target.value);
                  setOrigem(o);
                  if (destino <= o) setDestino(ultima);
                }}
              >
                {embarques.map((p) => <option key={p.ordem} value={p.ordem}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Desembarque">
              <select name="destino" className="input" value={destino} onChange={(e) => setDestino(Number(e.target.value))}>
                {viagem.paradas.filter((p) => p.ordem > origem).map((p) => <option key={p.ordem} value={p.ordem}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Categoria">
              <select className="input" value={preco?.tipo ?? ""} onChange={(e) => setTipo(e.target.value)} disabled={!lista.length}>
                {lista.map((p) => <option key={p.tipo} value={p.tipo}>{label(p.tipo)}</option>)}
              </select>
            </Campo>
          </div>

          {convenios.length > 0 && (
            <Campo label="Convênio (opcional)" dica={convenioId ? "O passageiro precisa comprovar o convênio no embarque." : undefined} className="max-w-md">
              <select className="input" value={convenioId} onChange={(e) => setConvenioId(e.target.value)}>
                <option value="">Sem convênio</option>
                {convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.desconto > 0 ? ` · até −${c.desconto}%` : ""}</option>)}
              </select>
            </Campo>
          )}

          {carregando ? (
            <p className="text-sm text-slate-500">Carregando valores…</p>
          ) : !preco ? (
            <p className="text-sm font-medium text-red-700">Este trecho não tem tarifa cadastrada.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo label="Valor cobrado (R$)">
                <input
                  name="valor"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={preco.piso}
                  required
                  className={`input ${abaixoDoPiso ? "border-red-400" : ""}`}
                  value={valorTxt}
                  onChange={(e) => setEdicao({ k: kValor, v: e.target.value })}
                />
              </Campo>
              <div className="text-sm sm:col-span-2">
                <p className="text-slate-600">Tabela da empresa: <b>{money(preco.tabela)}</b> · mínimo permitido: <b>{money(preco.piso)}</b></p>
                {preco.taxa > 0 ? (
                  <p className="text-slate-600">Mais taxa de embarque: <b>{money(preco.taxa)}</b></p>
                ) : (
                  <p className="text-slate-500">Sem taxa de embarque neste trecho para esta categoria.</p>
                )}
                {abaixoDoPiso ? (
                  <p role="alert" className="mt-1 flex items-center gap-1 font-medium text-red-700"><TriangleAlert size={14} /> O valor não pode ficar abaixo de {money(preco.piso)}.</p>
                ) : Number.isFinite(valor) ? (
                  <p className="mt-1 text-slate-500">Passageiro paga <b>{money(arredondar(valor + preco.taxa))}</b> · repasse à empresa <b>{money(arredondar(preco.piso + preco.taxa))}</b> · sua margem <b>{money(arredondar(valor - preco.piso))}</b></p>
                ) : null}
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-bold text-slate-900">2. Passageiro</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nome completo"><input name="nome" required minLength={2} autoComplete="off" className="input" /></Campo>
            <Campo label="Documento (CPF ou RG)"><input name="documento" required minLength={3} autoComplete="off" className="input" /></Campo>
            <Campo label="Data de nascimento"><input name="nascimento" type="date" required min="1900-01-01" max={hoje} className="input" /></Campo>
            <Campo label="Telefone"><input name="telefone" type="tel" autoComplete="off" className="input" /></Campo>
            <Campo label="E-mail" dica="Informe telefone ou e-mail"><input name="email" type="email" autoComplete="off" className="input" /></Campo>
            <Campo label="Endereço (opcional)"><input name="endereco" autoComplete="off" className="input" /></Campo>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="marketing" className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-rio-700" />
            O passageiro aceita receber ofertas e novidades da empresa.
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={enviando || carregando || !preco || abaixoDoPiso || semVaga}>
            {enviando && <Loader2 size={16} className="animate-spin" />}
            Emitir bilhete
          </button>
          {semVaga && <p className="text-sm font-medium text-red-700">Sem vagas neste trecho.</p>}
          {estado?.erro && <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-700"><TriangleAlert size={15} /> {estado.erro}</p>}
        </div>
      </form>

      <aside className="card h-fit p-5">
        <h2 className="mb-3 font-bold text-slate-900">Vagas ao vivo</h2>
        <BarrasLotacao trechos={trechos} paradas={viagem.paradas} destaque={{ de: origem, ate: destino }} />
        <p className="mt-3 text-xs text-slate-400">Atualiza sozinho a cada 15 segundos. A vaga só é garantida quando o bilhete é emitido.</p>
      </aside>
    </div>
  );
}
