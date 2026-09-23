import Link from "next/link";
import { ActionForm, Campo, Checkbox } from "@/components/admin/action-form";
import { BilheteTermico } from "@/components/bilhete-termico";
import { PageHeader } from "@/components/ui";
import { salvarBilheteAction, salvarEmpresaAction, salvarValoresAction } from "@/lib/admin-actions";
import { label } from "@/lib/format";
import { garantirAcesso } from "@/lib/sessao";
import { config, db, passagensDoPedido } from "@/lib/store";
import type { TipoPassageiro } from "@/lib/types";

export const metadata = { title: "Configurações" };

const ABAS = [
  ["empresa", "Empresa"],
  ["valores", "Valores e regras"],
  ["bilhete", "Bilhete"],
] as const;

export default async function Configuracoes({ searchParams }: PageProps<"/admin/configuracoes">) {
  await garantirAcesso("/admin/configuracoes");
  const sp = await searchParams;
  const aba = ABAS.find(([k]) => k === sp.aba)?.[0] ?? "empresa";
  const cfg = config();
  return (
    <>
      <PageHeader title="Configurações" subtitle="Dados da empresa, regras de preço e cancelamento, e o modelo do bilhete impresso" />
      <div className="mb-6 flex w-fit gap-1 rounded-xl bg-slate-200/60 p-1">
        {ABAS.map(([k, l]) => (
          <Link key={k} href={`/admin/configuracoes?aba=${k}`} className={`rounded-lg px-4 py-2 text-sm font-semibold ${aba === k ? "bg-white text-rio-800 shadow" : "text-slate-500 hover:text-slate-800"}`}>{l}</Link>
        ))}
      </div>
      {aba === "empresa" && <Empresa />}
      {aba === "valores" && <Valores />}
      {aba === "bilhete" && <Bilhete />}
    </>
  );

  function Empresa() {
    const e = cfg.empresa;
    return (
      <div className="card max-w-3xl p-6">
        <ActionForm action={salvarEmpresaAction}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nome fantasia"><input name="nome" required defaultValue={e.nome} className="input" /></Campo>
            <Campo label="Tipo de serviço" dica="Aparece no bilhete (TIPO)"><input name="tipoServico" defaultValue={e.tipoServico} className="input" /></Campo>
            <Campo label="Razão social" className="sm:col-span-2"><input name="razaoSocial" required defaultValue={e.razaoSocial} className="input" /></Campo>
            <Campo label="CNPJ"><input name="cnpj" defaultValue={e.cnpj} className="input" /></Campo>
            <Campo label="E-mail"><input name="email" type="email" defaultValue={e.email} className="input" /></Campo>
            <Campo label="WhatsApp (um por linha: Cidade | número)" className="sm:col-span-2" dica="O primeiro é o principal, usado nos botões do site.">
              <textarea name="whatsapps" rows={3} defaultValue={e.whatsapps.map((w) => `${w.cidade} | ${w.numero}`).join("\n")} className="input font-mono text-xs" />
            </Campo>
            <Campo label="Benefícios a bordo (separados por vírgula)" className="sm:col-span-2"><input name="beneficios" defaultValue={e.beneficios.join(", ")} className="input" /></Campo>
            <Campo label="Reserva no site (minutos para pagar)"><input name="minutosReservaSite" type="number" min={5} max={240} defaultValue={e.minutosReservaSite} className="input" /></Campo>
          </div>
        </ActionForm>
      </div>
    );
  }

  function Valores() {
    const v = cfg.valores;
    const tipos: TipoPassageiro[] = ["INTEIRA", "CRIANCA", "IDOSO", "ESTUDANTE", "PCD"];
    return (
      <div className="card max-w-3xl p-6">
        <ActionForm action={salvarValoresAction}>
          <h2 className="mb-3 font-bold">Descontos por tipo de passageiro</h2>
          <div className="grid gap-3 sm:grid-cols-5">
            {tipos.map((t) => (
              <Campo key={t} label={`${label(t)} (%)`}>
                <input name={`desc-${t}`} type="number" min={0} max={100} step="1" defaultValue={Math.round(v.descontos[t] * 100)} className="input" />
              </Campo>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">100% = gratuidade. Os preços por trecho ficam em Rotas → Trechos e preços; o acréscimo de cada acomodação, em Embarcações → Cômodos.</p>

          <h2 className="mt-6 mb-3 font-bold">Cancelamento</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Sem multa até (horas antes da saída)"><input name="horasCancelamentoSemMulta" type="number" min={0} defaultValue={v.horasCancelamentoSemMulta} className="input" /></Campo>
            <Campo label="Multa depois desse prazo (%)"><input name="multaCancelamentoPct" type="number" min={0} max={100} step="0.5" defaultValue={v.multaCancelamentoPct} className="input" /></Campo>
          </div>

          <h2 className="mt-6 mb-3 font-bold">Plataforma</h2>
          <Campo label="Porcentagem do sistema (%)" dica="Percentual sobre as passagens vendidas, usado no relatório “Porcentagem do sistema”." className="max-w-xs">
            <input name="taxaSistemaPct" type="number" min={0} max={30} step="0.1" defaultValue={v.taxaSistemaPct} className="input" />
          </Campo>
        </ActionForm>
      </div>
    );
  }

  function Bilhete() {
    const b = cfg.bilhete;
    const exemplo = [...db().pedidos].reverse().find((p) => p.status === "PAGO");
    const pas = exemplo ? passagensDoPedido(exemplo.id).find((x) => x.status !== "CANCELADA") : undefined;
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="card p-6">
          <ActionForm action={salvarBilheteAction} submit="Salvar modelo">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Largura da bobina">
                <select name="larguraMm" defaultValue={String(b.larguraMm)} className="input">
                  <option value="80">80 mm (padrão)</option>
                  <option value="58">58 mm (impressora compacta)</option>
                </select>
              </Campo>
              <Campo label="Título"><input name="titulo" defaultValue={b.titulo} className="input" /></Campo>
              <Campo label="Local de embarque (campo EMBARQUE)"><input name="localEmbarque" defaultValue={b.localEmbarque} className="input" /></Campo>
              <Campo label="Horário de embarque: minutos antes da saída"><input name="antecedenciaEmbarqueMin" type="number" min={0} max={240} defaultValue={b.antecedenciaEmbarqueMin} className="input" /></Campo>
            </div>
            <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
              <legend className="label">Mostrar no bilhete</legend>
              <Checkbox name="mostrarLogo" label="Logo da empresa" defaultChecked={b.mostrarLogo} />
              <Checkbox name="mostrarValores" label="Valores (total, passagem, taxa)" defaultChecked={b.mostrarValores} />
              <Checkbox name="mostrarQr" label="QR Code de embarque" defaultChecked={b.mostrarQr} />
              <Checkbox name="mostrarBeneficios" label="Benefícios a bordo" defaultChecked={b.mostrarBeneficios} />
            </fieldset>
            <Campo label="Mensagens do rodapé (uma por linha, até 6)" className="mt-4">
              <textarea name="mensagens" rows={4} defaultValue={b.mensagens.join("\n")} className="input" />
            </Campo>
            <p className="mt-3 text-xs text-slate-500">
              Reimpressões feitas pelo balcão saem marcadas como “2ª VIA”, “3ª VIA”… O QR Code é o que o conferente lê no embarque: desligue só se o embarque for conferido por lista.
            </p>
          </ActionForm>
        </div>
        {exemplo && pas && (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-600">Prévia (pedido {exemplo.codigo})</p>
            <div className="shadow-lg ring-1 ring-slate-200"><BilheteTermico passagem={{ ...pas, impressoes: 0 }} pedido={exemplo} /></div>
          </div>
        )}
      </div>
    );
  }
}
