"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Loader2, MessageCircle, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { QR } from "./qr";
import { informarPagamentoAction, simularPagamento } from "@/lib/actions";

function useContagem(expiraEm: string) {
  const router = useRouter();
  const [restante, setRestante] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.floor((new Date(expiraEm).getTime() - Date.now()) / 1000));
      setRestante(s);
      if (s === 0) router.refresh();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiraEm, router]);
  if (restante === null) return "…";
  const h = Math.floor(restante / 3600);
  const m = Math.floor((restante % 3600) / 60);
  const s = String(restante % 60).padStart(2, "0");
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${s}`;
}

/** QR e copia e cola do PIX, com o aviso "Já paguei" que leva o comprovante ao WhatsApp da empresa */
export function PixPayment({
  codigo,
  copiaCola,
  expiraEm,
  total,
  whatsapp,
  simulado,
}: {
  codigo: string;
  copiaCola: string;
  expiraEm: string;
  total: string;
  whatsapp: string;
  simulado?: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [erro, setErro] = useState<string>();
  const [pending, start] = useTransition();
  const tempo = useContagem(expiraEm);
  const mensagem = `Olá! Paguei o pedido ${codigo} (${total}) por PIX. Segue o comprovante.`;

  function jaPaguei() {
    // Abre o WhatsApp já no clique (navegadores bloqueiam janelas abertas depois de um await)
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener");
    start(async () => {
      const r = await informarPagamentoAction(codigo);
      if (r.erro) setErro(r.erro);
      router.refresh();
    });
  }

  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <p className="text-sm font-semibold text-slate-500">Pague com PIX</p>
      <p className="mt-1 text-3xl font-extrabold text-rio-900">{total}</p>
      <div className="mx-auto mt-5 w-fit rounded-2xl border border-slate-200 p-3">
        <QR value={copiaCola} size={200} />
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-amber-700">
        <Timer size={16} /> Poltronas reservadas por {tempo}
      </p>
      <button
        type="button"
        className="btn-ghost mt-4 w-full"
        onClick={() => {
          navigator.clipboard.writeText(copiaCola);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copiado!" : "Copiar código PIX (copia e cola)"}
      </button>
      <ol className="mt-5 space-y-1 text-left text-sm text-slate-600">
        <li>1. Abra o app do seu banco e escolha PIX</li>
        <li>2. Escaneie o QR Code ou cole o código — o valor já vem preenchido</li>
        <li>3. Depois de pagar, toque em <strong>Já paguei</strong> e envie o comprovante</li>
      </ol>
      <button type="button" disabled={pending} onClick={jaPaguei} className="btn-sol mt-5 w-full">
        {pending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />} Já paguei — enviar comprovante
      </button>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
      <p className="mt-3 text-xs text-slate-500">
        Conferimos o pagamento e emitimos os bilhetes nesta página. Guarde o link ou o código <span className="font-mono font-semibold">{codigo}</span>.
      </p>

      {simulado && (
        <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-xs text-amber-800">Ambiente de teste local.</p>
          <button type="button" disabled={pending} onClick={() => start(() => simularPagamento(codigo))} className="btn-primary w-full">
            Simular pagamento aprovado
          </button>
        </div>
      )}
    </div>
  );
}

/** Depois do "Já paguei": aguardando a conferência da equipe */
export function PagamentoEmConferencia({ codigo, expiraEm, whatsapp }: { codigo: string; expiraEm: string; whatsapp: string }) {
  const tempo = useContagem(expiraEm);
  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <Loader2 className="mx-auto animate-spin text-rio-600" size={36} />
      <h2 className="mt-3 text-lg font-bold">Pagamento em conferência</h2>
      <p className="mt-1 text-sm text-slate-600">
        Recebemos seu aviso. Assim que a equipe conferir o PIX, os bilhetes aparecem aqui. Suas poltronas ficam reservadas por mais {tempo}.
      </p>
      <a className="btn-ghost mt-5" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Enviei o comprovante do pedido ${codigo}.`)}`}>
        <MessageCircle size={16} /> Reenviar comprovante no WhatsApp
      </a>
    </div>
  );
}
