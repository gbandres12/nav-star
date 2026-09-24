// "PIX copia e cola" (BR Code estático, padrão EMV do Banco Central) com valor e identificador do pedido.
// Manual de Padrões para Iniciação do Pix, anexo "BR Code". Sem dependências: roda no servidor e no navegador.

export type TipoChavePix = "CPF" | "CNPJ" | "EMAIL" | "TELEFONE" | "ALEATORIA";

export type RecebedorPix = { tipo: TipoChavePix; chave: string; nome: string; cidade: string };

export const TIPOS_CHAVE_PIX: { valor: TipoChavePix; rotulo: string; exemplo: string }[] = [
  { valor: "CNPJ", rotulo: "CNPJ", exemplo: "06.326.986/0001-70" },
  { valor: "CPF", rotulo: "CPF", exemplo: "123.456.789-09" },
  { valor: "TELEFONE", rotulo: "Celular", exemplo: "(92) 99127-4661" },
  { valor: "EMAIL", rotulo: "E-mail", exemplo: "financeiro@empresa.com.br" },
  { valor: "ALEATORIA", rotulo: "Chave aleatória", exemplo: "123e4567-e89b-12d3-a456-426614174000" },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Nome e cidade: só letras, números e espaço, sem acento, em maiúsculas (o que todos os bancos leem) */
const textoPix = (s: string, max: number) => semAcento(s).toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

/** Chave no formato que o PIX exige, ou erro legível */
export function normalizarChave(tipo: TipoChavePix, chave: string): { ok: true; chave: string } | { ok: false; erro: string } {
  const digitos = chave.replace(/\D/g, "");
  switch (tipo) {
    case "CPF":
      return digitos.length === 11 ? { ok: true, chave: digitos } : { ok: false, erro: "CPF precisa ter 11 dígitos." };
    case "CNPJ":
      return digitos.length === 14 ? { ok: true, chave: digitos } : { ok: false, erro: "CNPJ precisa ter 14 dígitos." };
    case "TELEFONE": {
      const nacional = digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
      return nacional.length === 10 || nacional.length === 11
        ? { ok: true, chave: `+55${nacional}` }
        : { ok: false, erro: "Celular precisa ter DDD + número, ex.: (92) 99127-4661." };
    }
    case "EMAIL": {
      const e = chave.trim().toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 77 ? { ok: true, chave: e } : { ok: false, erro: "E-mail inválido." };
    }
    case "ALEATORIA": {
      const a = chave.trim().toLowerCase();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a)
        ? { ok: true, chave: a }
        : { ok: false, erro: "Chave aleatória inválida (formato 123e4567-e89b-12d3-a456-426614174000)." };
    }
  }
}

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, "0")}${valor}`;

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no campo 63 */
export function crc16(s: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(s)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Monta o código. `txid` identifica o pedido no extrato do banco (até 25 letras/números);
 * `valor` fixa a quantia para o cliente não digitar errado.
 */
export function brCodePix(r: RecebedorPix, opcoes: { valor?: number; txid?: string } = {}) {
  const chave = normalizarChave(r.tipo, r.chave);
  if (!chave.ok) throw new Error(chave.erro);
  const txid = (opcoes.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const corpo = [
    campo("00", "01"),
    campo("26", campo("00", "br.gov.bcb.pix") + campo("01", chave.chave)),
    campo("52", "0000"),
    campo("53", "986"),
    opcoes.valor && opcoes.valor > 0 ? campo("54", opcoes.valor.toFixed(2)) : "",
    campo("58", "BR"),
    campo("59", textoPix(r.nome, 25) || "RECEBEDOR"),
    campo("60", textoPix(r.cidade, 15) || "BRASIL"),
    campo("62", campo("05", txid)),
    "6304",
  ].join("");
  return corpo + crc16(corpo);
}
