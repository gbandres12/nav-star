import type { Configuracao, StatusEncomenda } from "./types";

/** Padrão real da São Tomé Expresso: vale enquanto a empresa não tiver cadastrado o valor no banco */
export const CONFIG_PADRAO: Configuracao = {
  empresa: {
    nome: "São Tomé Expresso",
    razaoSocial: "Brigido Locação e Transportes de Navegação LTDA",
    cnpj: "06.326.986/0001-70",
    whatsapps: [
      { cidade: "Manaus", numero: "(92) 99127-4661", link: "5592991274661" },
      { cidade: "Santarém", numero: "(93) 99197-5141", link: "5593991975141" },
    ],
    whatsapp: "5592991274661", // principal (botões do site)
    email: "contato@saotomeexpresso.com.br", // provisório
    tipoServico: "Expresso",
    beneficios: ["café", "almoço", "Wi-Fi grátis", "ambiente climatizado", "poltronas reclináveis"],
    minutosReservaSite: 30,
  },
  valores: {
    descontos: { INTEIRA: 0, CRIANCA: 0.5, COLO: 1, IDOSO: 0.5, ESTUDANTE: 0.5, PCD: 1 },
    isentosTaxa: { INTEIRA: false, CRIANCA: true, COLO: true, IDOSO: true, ESTUDANTE: false, PCD: true },
    multaCancelamentoPct: 10,
    horasCancelamentoSemMulta: 24,
    taxaSistemaPct: 3,
  },
  bilhete: {
    larguraMm: 80,
    titulo: "CARTÃO DE EMBARQUE",
    mostrarLogo: true,
    mostrarValores: true,
    mostrarQr: true,
    mostrarBeneficios: true,
    localEmbarque: "HIDROVIÁRIO",
    antecedenciaEmbarqueMin: 60,
    mensagens: [
      "Para o embarque, apresente este bilhete impresso ou digital.",
      "Chegue com pelo menos 1 hora de antecedência ao local de embarque.",
    ],
  },
};

export const FLUXO_ENCOMENDA: StatusEncomenda[] = ["RECEBIDA", "EMBARCADA", "EM_TRANSITO", "DISPONIVEL_RETIRADA", "ENTREGUE"];
