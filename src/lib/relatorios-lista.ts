// Catálogo dos relatórios (compartilhado entre a sidebar, o índice e a página de cada relatório)
export const RELATORIOS = [
  { slug: "geral", titulo: "Geral", descricao: "Resumo do período: vendas, taxas, comissões, reembolsos e líquido, dia a dia" },
  { slug: "fiscal", titulo: "Fiscal", descricao: "Base para o contador: receita de passagens, gratuidades, taxas repassadas e fretes" },
  { slug: "por-viagem", titulo: "Por viagem", descricao: "Cada saída com passageiros, lotação, no-shows, receita e encomendas" },
  { slug: "por-porto", titulo: "Por porto", descricao: "Embarques, receita e taxa de embarque por porto de origem" },
  { slug: "por-usuario", titulo: "Por usuário", descricao: "Vendas de cada vendedor, balcão e agência, por forma de pagamento" },
  { slug: "por-convenio", titulo: "Por convênio", descricao: "Passagens de convênio, descontos concedidos e valores a faturar" },
  { slug: "individual", titulo: "Individual", descricao: "Histórico de viagens de um passageiro, pelo nome ou documento" },
  { slug: "caixas", titulo: "Caixas fechados", descricao: "Fechamentos do balcão: esperado × contado e diferenças" },
  { slug: "taxa-embarque", titulo: "Taxa de embarque", descricao: "Valores de taxa arrecadados por porto, para repasse" },
  { slug: "porcentagem-sistema", titulo: "Porcentagem do sistema", descricao: "Percentual da plataforma sobre as passagens vendidas" },
  { slug: "por-cidade", titulo: "Por cidade", descricao: "Passageiros e receita por cidade de embarque e de desembarque" },
  { slug: "por-horario", titulo: "Por horário", descricao: "Ocupação e receita por dia da semana e horário de saída" },
  { slug: "cancelamentos", titulo: "Cancelamentos", descricao: "Passagens canceladas, motivos, multas retidas e reembolsos" },
  { slug: "encomendas", titulo: "Encomendas", descricao: "Volumes, peso e frete por destino, pagos e a receber" },
] as const;

export type SlugRelatorio = (typeof RELATORIOS)[number]["slug"];
