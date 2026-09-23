import type { PapelUsuario } from "./types";

// Quem acessa cada área do painel. Usado pela sidebar (esconde itens) e pelas páginas/ações (bloqueia).
// Na Fase A o banco repete estas regras nas policies de RLS — esta tabela não é a única barreira.
const TODOS: PapelUsuario[] = ["ADMIN", "GERENTE", "VENDEDOR", "CONFERENTE"];
const GESTAO: PapelUsuario[] = ["ADMIN", "GERENTE"];

export const ACESSO: [prefixo: string, papeis: PapelUsuario[]][] = [
  ["/admin/configuracoes", ["ADMIN"]],
  ["/admin/usuarios", ["ADMIN"]],
  ["/admin/relatorios", GESTAO],
  ["/admin/financeiro", GESTAO],
  ["/admin/convenios", GESTAO],
  ["/admin/festivais", GESTAO],
  ["/admin/agencias", GESTAO],
  ["/admin/linhas", GESTAO],
  ["/admin/trechos", GESTAO],
  ["/admin/portos", GESTAO],
  ["/admin/embarcacoes", GESTAO],
  ["/admin/comodos", GESTAO],
  ["/admin/tripulantes", GESTAO],
  ["/admin/cancelamentos", ["ADMIN", "GERENTE", "VENDEDOR"]],
  ["/admin/caixa", ["ADMIN", "GERENTE", "VENDEDOR"]],
  ["/admin/vender", ["ADMIN", "GERENTE", "VENDEDOR"]],
  ["/admin/pedidos", ["ADMIN", "GERENTE", "VENDEDOR"]],
  ["/admin/embarque", ["ADMIN", "GERENTE", "CONFERENTE"]],
  ["/admin/encomendas", TODOS],
  ["/admin/viagens", TODOS],
  ["/admin/mapa", TODOS],
  ["/admin", TODOS],
];

export function podeAcessar(papel: PapelUsuario, rota: string) {
  const regra = ACESSO.find(([p]) => rota === p || rota.startsWith(p + "/"));
  return !regra || regra[1].includes(papel);
}
