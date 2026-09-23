export const TZ = "America/Manaus";
const OFFSET_H = 4; // Manaus = UTC-4, sem horário de verão

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (v: number) => brl.format(v);

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...opts });
const fDate = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
const fShort = fmt({ day: "2-digit", month: "2-digit" });
const fTime = fmt({ hour: "2-digit", minute: "2-digit" });
const fWeek = fmt({ weekday: "short" });
const fWeekLong = fmt({ weekday: "long", day: "2-digit", month: "long" });

export const date = (iso: string | Date) => fDate.format(new Date(iso));
export const dateShort = (iso: string | Date) => fShort.format(new Date(iso));
export const time = (iso: string | Date) => fTime.format(new Date(iso));
export const dateTime = (iso: string | Date) => `${date(iso)} ${time(iso)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const weekday = (iso: string | Date) => cap(fWeek.format(new Date(iso)).replace(".", ""));
export const longDay = (iso: string | Date) => cap(fWeekLong.format(new Date(iso)));

export function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** "YYYY-MM-DD" do dia em Manaus */
const fKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
export function localDayKey(d: Date | string) {
  return fKey.format(new Date(d));
}

/** Cria um Date a partir de data/hora local de Manaus */
export function manausDate(y: number, m: number, d: number, h = 0, min = 0) {
  return new Date(Date.UTC(y, m, d, h + OFFSET_H, min));
}

export function addMinutes(iso: string | Date, min: number) {
  return new Date(new Date(iso).getTime() + min * 60_000);
}

export const addDays = (iso: string | Date, d: number) => addMinutes(iso, d * 1440);

export const LABEL: Record<string, string> = {
  PROGRAMADA: "Programada",
  EMBARQUE: "Embarque",
  EM_CURSO: "Em curso",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
  REEMBOLSADO: "Reembolsado",
  RESERVADA: "Reservada",
  EMITIDA: "Emitida",
  EMBARCADA: "Embarcada",
  NAO_COMPARECEU: "Não compareceu",
  RECEBIDA: "Recebida",
  EM_TRANSITO: "Em trânsito",
  DISPONIVEL_RETIRADA: "Disponível p/ retirada",
  ENTREGUE: "Entregue",
  DEVOLVIDA: "Devolvida",
  SITE: "Site",
  BALCAO: "Balcão",
  AGENCIA: "Agência",
  WHATSAPP: "WhatsApp",
  PIX: "PIX",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  DINHEIRO: "Dinheiro",
  INTEIRA: "Inteira",
  CRIANCA: "Criança (meia)",
  IDOSO: "Idoso",
  ESTUDANTE: "Estudante",
  PCD: "PCD",
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  VENDEDOR: "Vendedor",
  CONFERENTE: "Conferente",
  ATIVA: "Ativa",
  MANUTENCAO: "Em manutenção",
  INATIVA: "Inativa",
  REMETENTE: "Remetente",
  DESTINATARIO: "Destinatário",
  FATURADO: "Faturado (convênio)",
  APROVADO: "Aprovado",
  PENDENTE: "Pendente",
  ESTORNADO: "Estornado",
  RECUSADO: "Recusado",
  COMANDANTE: "Comandante",
  IMEDIATO: "Imediato",
  MAQUINISTA: "Maquinista",
  MARINHEIRO: "Marinheiro",
  TAIFEIRO: "Taifeiro",
  COMISSARIO: "Comissário(a)",
  SANGRIA: "Sangria",
  SUPRIMENTO: "Suprimento",
  NAVEGANDO: "Navegando",
  ATRACADA: "Atracada",
};

export const label = (k: string) => LABEL[k] ?? k;

export const onlyDigits = (s: string) => s.replace(/\D/g, "");
