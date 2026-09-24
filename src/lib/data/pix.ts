import "server-only";
import { cache } from "react";
import { createAdminClient } from "../supabase/admin";
import { createClient } from "../supabase/server";
import { normalizarChave, type RecebedorPix, type TipoChavePix } from "../pix";

// Recebedor PIX da empresa (aba "Pagamento" das configurações). A leitura usa a chave do servidor porque o site
// (visitante sem login) precisa gerar o QR do pedido, e a tabela empresas não é pública.

export type ConfigPix = { recebedor: RecebedorPix | null; horasConfirmacao: number; minutosReserva: number };

type LinhaPix = {
  pix_tipo: TipoChavePix | null;
  pix_chave: string | null;
  pix_nome: string | null;
  pix_cidade: string | null;
  horas_confirmacao_pix: number | null;
  minutos_reserva_site: number | null;
};

export const configPix = cache(async (): Promise<ConfigPix> => {
  const { data } = await createAdminClient()
    .from("empresas")
    .select("pix_tipo, pix_chave, pix_nome, pix_cidade, horas_confirmacao_pix, minutos_reserva_site")
    .limit(1)
    .maybeSingle();
  const e = data as LinhaPix | null;
  const completo = e?.pix_tipo && e.pix_chave && e.pix_nome && e.pix_cidade;
  return {
    recebedor: completo ? { tipo: e.pix_tipo!, chave: e.pix_chave!, nome: e.pix_nome!, cidade: e.pix_cidade! } : null,
    horasConfirmacao: e?.horas_confirmacao_pix ?? 6,
    minutosReserva: e?.minutos_reserva_site ?? 30,
  };
});

export async function salvarConfigPix(d: {
  tipo: TipoChavePix;
  chave: string;
  nome: string;
  cidade: string;
  horasConfirmacao: number;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const chave = normalizarChave(d.tipo, d.chave);
  if (!chave.ok) return chave;
  if (d.nome.trim().length < 3) return { ok: false, erro: "Informe o nome do recebedor, como aparece no banco." };
  if (d.cidade.trim().length < 2) return { ok: false, erro: "Informe a cidade do recebedor." };
  if (!(d.horasConfirmacao >= 1 && d.horasConfirmacao <= 48)) return { ok: false, erro: "Tempo para conferir: de 1 a 48 horas." };

  // Grava com a sessão do usuário: a RLS só deixa o ADMIN alterar a empresa
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .update({
      pix_tipo: d.tipo,
      pix_chave: chave.chave,
      pix_nome: d.nome.trim(),
      pix_cidade: d.cidade.trim(),
      horas_confirmacao_pix: Math.round(d.horasConfirmacao),
    } as never)
    .not("id", "is", null)
    .select("id");
  if (error) return { ok: false, erro: `Não foi possível salvar: ${error.message}` };
  if (!data?.length) return { ok: false, erro: "Só o administrador pode alterar os dados de pagamento." };
  return { ok: true };
}
