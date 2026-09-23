"use client";

import { useState, useTransition } from "react";
import { KeyRound, Check, Copy, MessageCircle, Loader2 } from "lucide-react";
import { reenviarConviteAction } from "@/lib/admin-actions";

export function ReenviarConviteBtn({
  usuarioId,
  nome,
  telefone,
}: {
  usuarioId: string;
  nome: string;
  telefone?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleGerar = () => {
    setErro(null);
    startTransition(async () => {
      const res = await reenviarConviteAction(usuarioId);
      if (res?.ok && res.linkAtivacao) {
        setLink(res.linkAtivacao);
      } else {
        setErro(res?.erro || "Não foi possível gerar o link de acesso.");
      }
    });
  };

  const handleCopiar = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const getWhatsAppLink = () => {
    if (!link) return "#";
    const limpo = (telefone || "").replace(/\D/g, "");
    const ddi = limpo.length <= 11 ? `55${limpo}` : limpo;
    const msg = encodeURIComponent(
      `Olá, ${nome}! Aqui está seu link de acesso e redefinição ao sistema da São Tomé Expresso:\n\n${link}`
    );
    return limpo ? `https://wa.me/${ddi}?text=${msg}` : `https://wa.me/?text=${msg}`;
  };

  if (link) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleCopiar}
          title="Copiar link gerado"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          {copiado ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          {copiado ? "Copiado!" : "Copiar"}
        </button>
        <a
          href={getWhatsAppLink()}
          target="_blank"
          rel="noreferrer"
          title="Enviar no WhatsApp"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition"
        >
          <MessageCircle size={13} />
          WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleGerar}
        title="Gerar novo link de primeiro acesso / recuperação"
        className="inline-flex items-center gap-1 text-xs text-rio-700 hover:text-rio-900 font-medium hover:underline disabled:opacity-50"
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
        Gerar Link
      </button>
      {erro && <span className="text-[11px] text-red-600" title={erro}>Erro</span>}
    </div>
  );
}
