import { updateTag } from "next/cache";

/** Cadastros que quase não mudam (cidades, portos, linhas, embarcações): ficam em cache entre requisições */
export const TAG_CATALOGO = "catalogo";
/** Rede de segurança: mesmo sem invalidação, o cache do catálogo expira sozinho */
export const SEGUNDOS_CATALOGO = 300;

/** Chamar nas server actions que alteram cadastros: quem salvou já vê o dado novo na próxima leitura */
export function invalidarCatalogo() {
  updateTag(TAG_CATALOGO);
}
