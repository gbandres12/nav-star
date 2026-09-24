import Link from "next/link";
import { ActionForm, Campo, Checkbox } from "@/components/admin/action-form";
import { PageHeader } from "@/components/ui";
import { salvarBilheteAction, salvarEmpresaAction, salvarPixAction, salvarValoresAction } from "@/lib/precos-actions";
import { QR } from "@/components/qr";
import { configPix, type ConfigPix } from "@/lib/data/pix";
import { brCodePix, TIPOS_CHAVE_PIX } from "@/lib/pix";
import { historicoDescontos } from "@/lib/data/precos";
import { getConfig } from "@/lib/data/utils";
import { dateTime, label } from "@/lib/format";
import { garantirAcesso } from "@/lib/sessao";
import type { Configuracao, TipoPassageiro } from "@/lib/types";

export const metadata = { title: "Configurações" };

const ABAS = [
  ["empresa", "Empresa"],
  ["valores", "Valores e regras"],
  ["bilhete", "Bilhete"],
  ["pagamento", "Pagamento (PIX)"],
] as const;

export default async function Configuracoes({ searchParams }: PageProps<"/admin/configuracoes">) {
  await garantirAcesso("/admin/configuracoes");
  const sp = await searchParams;
  const aba = ABAS.find(([k]) => k === sp.aba)?.[0] ?? "empresa";
  const cfg = await getConfig();
  return (
    <>
      <PageHeader title="Configurações" subtitle="Dados da empresa, descontos e regras de cancelamento, e o modelo do bilhete impresso" />
      <div className="mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
        {ABAS.map(([k, l]) => (
          <Link key={k} href={`/admin/configuracoes?aba=${k}`} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap ${aba === k ? "bg-white text-rio-800 shadow" : "text-slate-500 hover:text-slate-800"}`}>{l}</Link>
        ))}
      </div>
      {aba === "empresa" && <Empresa e={cfg.empresa} />}
      {aba === "valores" && <Valores v={cfg.valores} historico={await historicoDescontos()} />}
      {aba === "bilhete" && <Bilhete b={cfg.bilhete} />}
      {aba === "pagamento" && <Pagamento pix={await configPix()} />}
    </>
  );
}

function Empresa({ e }: { e: Configuracao["empresa"] }) {
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

type Hist = Awaited<ReturnType<typeof historicoDescontos>>;

function Valores({ v, historico }: { v: Configuracao["valores"]; historico: Hist }) {
  const tipos: TipoPassageiro[] = ["INTEIRA", "CRIANCA", "IDOSO", "ESTUDANTE", "PCD"];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,48rem)_1fr]">
      <div className="card p-6">
        <ActionForm action={salvarValoresAction}>
          <h2 className="mb-1 font-bold">Descontos por tipo de passageiro</h2>
          <p className="mb-3 text-sm text-slate-500">Valem para todas as rotas e só para vendas novas. 100% = gratuidade.</p>
          <div className="grid gap-3 sm:grid-cols-5">
            {tipos.map((t) => (
              <Campo key={t} label={`${label(t)} (%)`}>
                <input name={`desc-${t}`} type="number" min={0} max={100} step="0.5" defaultValue={Math.round((v.descontos[t] ?? 0) * 1000) / 10} className="input" />
              </Campo>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Os preços da inteira ficam em <Link href="/admin/trechos" className="font-semibold text-rio-700 hover:underline">Trechos e preços</Link>.
          </p>

          <h2 className="mt-6 mb-3 font-bold">Cancelamento</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Sem multa até (horas antes da saída)"><input name="horasCancelamentoSemMulta" type="number" min={0} defaultValue={v.horasCancelamentoSemMulta} className="input" /></Campo>
            <Campo label="Multa depois desse prazo (%)"><input name="multaCancelamentoPct" type="number" min={0} max={100} step="0.5" defaultValue={v.multaCancelamentoPct} className="input" /></Campo>
          </div>

          <h2 className="mt-6 mb-3 font-bold">Plataforma</h2>
          <Campo label="Porcentagem do sistema (%)" dica="Usada no relatório “Porcentagem do sistema”." className="max-w-xs">
            <input name="taxaSistemaPct" type="number" min={0} max={30} step="0.1" defaultValue={v.taxaSistemaPct} className="input" />
          </Campo>
        </ActionForm>
      </div>
      <div className="card h-fit overflow-x-auto">
        <h2 className="p-5 font-bold">Histórico de descontos</h2>
        {historico.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-500">Nenhuma alteração registrada.</p>
        ) : (
          <table className="table-base">
            <thead><tr><th>Quando</th><th>Tipo</th><th>De → para</th><th>Quem</th></tr></thead>
            <tbody>
              {historico.map((h, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap">{dateTime(h.alterado_em)}</td>
                  <td>{label(h.tipo)}</td>
                  <td className="whitespace-nowrap tabular-nums">{h.percentual_anterior ?? "—"}% → {h.percentual_novo}%</td>
                  <td>{h.perfis?.nome ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Bilhete({ b }: { b: Configuracao["bilhete"] }) {
  return (
    <div className="card max-w-3xl p-6">
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
          Reimpressões feitas pelo balcão saem marcadas como “2ª VIA”. O QR Code é o que o conferente lê no embarque: desligue só se o embarque for conferido por lista.
        </p>
      </ActionForm>
    </div>
  );
}

function Pagamento({ pix }: { pix: ConfigPix }) {
  const r = pix.recebedor;
  const teste = r ? brCodePix(r, { valor: 1, txid: "TESTE" }) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,40rem)_1fr]">
      <div className="card p-6">
        <h2 className="mb-1 font-bold">Chave PIX que recebe as vendas do site</h2>
        <p className="mb-4 text-sm text-slate-500">
          O site gera, para cada pedido, um QR Code com o valor exato e o código do pedido. O cliente paga, avisa pelo WhatsApp e a
          equipe confirma em <Link href="/admin/pedidos?status=AGUARDANDO_PAGAMENTO" className="font-semibold text-rio-700 hover:underline">Pedidos</Link>.
        </p>
        <ActionForm action={salvarPixAction} submit="Salvar dados do PIX">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Tipo de chave">
              <select name="pixTipo" defaultValue={r?.tipo ?? "CNPJ"} className="input">
                {TIPOS_CHAVE_PIX.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
              </select>
            </Campo>
            <Campo label="Chave PIX" dica="Ex.: 06.326.986/0001-70, (92) 99127-4661 ou e-mail">
              <input name="pixChave" required defaultValue={r?.chave} className="input" />
            </Campo>
            <Campo label="Nome do recebedor" dica="Como aparece no banco. Até 25 letras, sem acento.">
              <input name="pixNome" required maxLength={60} defaultValue={r?.nome} className="input" placeholder="SAO TOME EXPRESSO" />
            </Campo>
            <Campo label="Cidade do recebedor" dica="Até 15 letras.">
              <input name="pixCidade" required maxLength={40} defaultValue={r?.cidade} className="input" placeholder="MANAUS" />
            </Campo>
            <Campo label="Tempo para conferir (horas)" dica="Depois do “Já paguei”, as poltronas ficam seguras por este tempo (até 1 h antes da saída).">
              <input name="horasConfirmacao" type="number" min={1} max={48} defaultValue={pix.horasConfirmacao} className="input" />
            </Campo>
            <div className="text-sm text-slate-500 sm:pt-7">
              Tempo para pagar: <strong>{pix.minutosReserva} min</strong> — altere na aba{" "}
              <Link href="/admin/configuracoes?aba=empresa" className="font-semibold text-rio-700 hover:underline">Empresa</Link>.
            </div>
          </div>
        </ActionForm>
      </div>
      <div className="card h-fit p-6 text-center">
        {teste ? (
          <>
            <h2 className="font-bold">Teste antes de abrir as vendas</h2>
            <p className="mt-1 text-sm text-slate-500">Pague R$ 1,00 com este QR e confira se caiu na conta certa, com o nome certo.</p>
            <div className="mx-auto mt-4 w-fit rounded-2xl border border-slate-200 p-3"><QR value={teste} size={180} /></div>
            <p className="mt-3 font-mono text-[10px] break-all text-slate-500">{teste}</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Sem chave cadastrada, o site reserva as poltronas e orienta o cliente a pagar pelo WhatsApp.
          </p>
        )}
      </div>
    </div>
  );
}
