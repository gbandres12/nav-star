import { QR } from "./qr";
import { addMinutes, date, dateTime, duration, label, money, time } from "@/lib/format";
import { cidade, EMPRESA, embarcacao, horarioParada, linha, porto, viagem } from "@/lib/store";
import type { Passagem, Pedido } from "@/lib/types";

// "03:00" → "03h00", como no modelo impresso
const hora = (d: Date) => time(d).replace(":", "h");

/**
 * Cartão de embarque no layout do modelo da São Tomé Expresso.
 * Largura de bobina térmica de 80 mm; na tela aparece como um "cupom".
 */
export function BilheteTermico({ passagem: p, pedido }: { passagem: Passagem; pedido: Pedido }) {
  const v = viagem(p.viagemId)!;
  const l = linha(v.linhaId);
  const portoO = porto(l.paradas[p.origemOrdem].portoId);
  const portoD = porto(l.paradas[p.destinoOrdem].portoId);
  const o = cidade(portoO.cidadeId);
  const d = cidade(portoD.cidadeId);
  const saida = horarioParada(v, p.origemOrdem);
  const chegada = horarioParada(v, p.destinoOrdem);
  const assento = embarcacao(v.embarcacaoId).assentos.find((a) => a.id === p.assentoId);
  const pagamento = pedido.pagamentos[0];

  return (
    <article className="bilhete mx-auto w-[80mm] bg-white px-[4mm] pt-[3mm] pb-[3mm] font-[Arial,Helvetica,sans-serif] text-black">
      {/* Cabeçalho */}
      <header className="overflow-hidden border border-rio-600 text-center">
        <div className="bg-white py-[2mm]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-emblema.png" alt="São Tomé Expresso" className="mx-auto h-[13mm] w-auto" />
        </div>
        <div className="bg-rio-700 px-2 py-[2mm] text-white">
          <p className="text-[13px] font-bold tracking-wide">CARTÃO DE EMBARQUE</p>
          <p className="mt-0.5 text-[9.5px] font-bold">Pedido #{pedido.numero}</p>
          <p className="text-[8.5px] font-bold">Emitido em {dateTime(pagamento.pagoEm ?? pedido.createdAt)}</p>
        </div>
      </header>

      <Rule />

      {/* Trecho */}
      <section className="py-[1mm] text-center">
        <p className="text-[32px] leading-none font-extrabold">{o.sigla}</p>
        <p className="mt-1 text-[9px] font-bold">{o.nome.toUpperCase()} / {o.uf}</p>
        <p className="my-0.5 text-[13px] leading-none">↓</p>
        <p className="text-[32px] leading-none font-extrabold">{d.sigla}</p>
        <p className="mt-1 text-[9px] font-bold">{d.nome.toUpperCase()} / {d.uf}</p>
      </section>

      <Rule />

      <section className="py-[1mm] text-center">
        <p className="text-[9px] font-bold">POLTRONA</p>
        <p className="mt-0.5 text-[30px] leading-none font-extrabold">{assento?.codigo ?? "—"}</p>
      </section>

      <Dashed />

      <section className="py-[1mm] text-center">
        <p className="text-[8.5px] font-bold">PASSAGEIRO</p>
        <p className="mt-1.5 text-[12px] leading-tight font-bold">{p.nome.toUpperCase()}</p>
        <p className="mt-0.5 text-[8px]">
          Doc. {p.documento}
          {p.tipo !== "INTEIRA" && ` · ${label(p.tipo).toUpperCase()}`}
        </p>
        <p className="mt-1 text-[6.5px] font-bold">{EMPRESA.razaoSocial.toUpperCase()}</p>
      </section>

      <Dashed />

      <Grid
        items={[
          ["DATA", date(saida)],
          ["HORA", hora(saida)],
          ["DURAÇÃO", duration((chegada.getTime() - saida.getTime()) / 60_000).replace(/h$/, "h00")],
        ]}
      />

      <Dashed />

      <Grid
        items={[
          ["TOTAL", money(p.valor + p.taxaEmbarque)],
          ["PASSAGEM", money(p.valor)],
          ["TARIFA", money(p.taxaEmbarque)],
        ]}
      />

      <Dashed />

      <Grid
        items={[
          ["PAGAMENTO", label(pagamento.metodo).replace("Cartão de ", "Cartão ").toUpperCase()],
          ["RESERVA", v.id.replace(/\D/g, "")],
          ["EMBARQUE", hora(addMinutes(saida, -60))],
        ]}
      />
      <Grid
        items={[
          ["EMBARQUE", "HIDROVIÁRIO"],
          ["", ""],
          ["TIPO", EMPRESA.tipoServico.toUpperCase()],
        ]}
      />

      <div className="mt-[1.5mm] border-t-[1.5px] border-black" />

      <section className="py-[1mm] text-center">
        <p className="text-[10.5px] font-bold">{portoO.nome.toUpperCase()}</p>
        <p className="mt-0.5 text-[13px] font-extrabold">{embarcacao(v.embarcacaoId).nome.toUpperCase()}</p>
      </section>

      {/* QR para validação no portão — não existe no modelo em papel, é o que liga o bilhete ao sistema */}
      <section className="flex flex-col items-center gap-0.5 pt-[0.5mm]">
        <QR value={p.qrToken} size={84} />
        <p className="font-mono text-[8px]">{p.qrToken}</p>
      </section>

      <footer className="mt-[1.5mm] space-y-[0.6mm] text-center text-[7.5px] leading-snug">
        <p className="text-[9px] font-bold">{EMPRESA.nome.toUpperCase()}</p>
        <p>CNPJ: {EMPRESA.cnpj}</p>
        <p>WhatsApp: {EMPRESA.whatsapps.map((w) => w.numero).join(" · ")}</p>
        <p>Para o embarque, apresente este bilhete impresso ou digital.</p>
        <p>Chegue com pelo menos 1 hora de antecedência ao local de embarque.</p>
        <p>Benefícios da viagem: {EMPRESA.beneficios.join(", ").replace(/, ([^,]*)$/, " e $1")}.</p>
      </footer>
    </article>
  );
}

function Rule() {
  return <div className="mt-[2mm] border-t-[1.5px] border-black" />;
}

function Dashed() {
  return <div className="my-[1mm] border-t-[1.5px] border-dashed border-black" />;
}

function Grid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-3 py-[0.5mm] text-center">
      {items.map(([k, val], i) => (
        <div key={i}>
          <p className="text-[7.5px] font-bold">{k}</p>
          <p className="mt-0.5 text-[10px] font-bold whitespace-nowrap">{val}</p>
        </div>
      ))}
    </div>
  );
}
