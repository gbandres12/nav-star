import { localDayKey, manausDate } from "./format";

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Lê ?mes=YYYY-MM (padrão: mês atual em Manaus) e devolve o intervalo */
export function periodoMes(mes?: string | string[]) {
  const atual = localDayKey(new Date()).slice(0, 7);
  const m = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : atual;
  const [y, mo] = m.split("-").map(Number);
  const inicio = manausDate(y, mo - 1, 1);
  const fim = manausDate(y, mo, 1);
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000);
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  return { mes: m, inicio, fim, dias, nome: `${MESES[mo - 1]} ${y}`, anterior: shift(-1), proximo: shift(1), atual: m === atual };
}
