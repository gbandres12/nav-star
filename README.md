# NavStar — gestão e venda online de passagens de lancha

Plataforma da **São Tomé Expresso**: e-commerce de passagens, venda no balcão, embarque por QR Code,
encomendas e gestão financeira, pensada para crescer com novas embarcações.

## Rodar localmente

```bash
npm install
npm run dev
```

- Site de vendas: http://localhost:3000
- Área da empresa: http://localhost:3000/admin

> **Fase atual: protótipo visual.** Os dados vivem em memória (`src/lib/seed.ts`) e são recriados a cada
> reinício do servidor. O pagamento PIX é simulado pelo botão "Simular pagamento aprovado".

## O que já funciona

| Área | Telas |
|---|---|
| **Site (cliente)** | Home com busca · horários por trecho e data · mapa de poltronas · dados dos passageiros com meia/gratuidade · pagamento PIX com reserva de 30 min · bilhetes com QR Code · rastreio de encomenda |
| **Operação** | Painel (vendas do mês, gráfico diário, próximas viagens, lotação) · Vender passagens no balcão (dinheiro/PIX/cartão) · Validação de embarque por QR · Viagens com mapa de ocupação por trecho e manifesto imprimível · Pedidos com busca por código/nome/CPF |
| **Encomendas** | Cadastro com remetente/destinatário/peso/frete · etiqueta imprimível com QR · avanço de status (recebida → embarcada → em trânsito → disponível → entregue) · rastreio público |
| **Cadastros** | Linhas com paradas, matriz de preços por trecho e programação semanal · Embarcações com mapa de poltronas · Portos com taxa de embarque |
| **Gestão** | Financeiro por canal, forma de pagamento, linha e vendedor · comissões de agências · usuários, perfis e restrição por linha |

## Bilhete (cartão de embarque)

Segue o modelo impresso da São Tomé Expresso, para bobina térmica de **80 mm** (`src/components/bilhete-termico.tsx`).
A página `/bilhete/[código]` mostra só os bilhetes, um por página de 80 × 230 mm, prontos para a impressora térmica
ou para "Salvar como PDF". Na venda de balcão paga na hora, a impressão abre sozinha.
Em relação ao modelo em papel, entrou um **QR Code**, que é o que o conferente lê no embarque.

## Regras de negócio principais

- **Linha → paradas em ordem → tarifa por par origem/destino.** Ex.: Manaus(0) → Itacoatiara(1) → Parintins(2) → Juruti(3) → Óbidos(4) → Santarém(5).
- **Ocupação por segmento.** Uma passagem Manaus→Parintins ocupa os segmentos 0 e 1. A mesma poltrona pode ser
  vendida de Parintins em diante. No banco, a tabela `OcupacaoAssento` tem chave única
  `(viagem, assento, segmento)`, e isso impede venda duplicada mesmo com dois vendedores ao mesmo tempo.
- **Reserva do site:** o pedido fica `AGUARDANDO_PAGAMENTO` por 30 min. Se o pagamento não vier, expira e libera as poltronas.
- **Viagens geradas pela programação semanal** (`HorarioLinha`): ex.: Manaus→Santarém seg e sex 03:00.
- **Descontos:** criança, idoso e estudante pagam 50%; PCD tem gratuidade. A taxa de embarque depende do porto de embarque.

## Estrutura

```
prisma/schema.prisma      ← desenho completo do banco (PostgreSQL)
docs/banco-de-dados.md    ← diagrama e explicação das tabelas
src/lib/types.ts          ← tipos espelhando o schema
src/lib/seed.ts           ← dados de exemplo (rota Manaus ↔ Santarém)
src/lib/store.ts          ← consultas e regras (ocupação, busca, pedidos, embarque)
src/lib/actions.ts        ← server actions (compra, pagamento, embarque, encomendas)
src/app/(site)/           ← e-commerce público
src/app/admin/            ← painel da empresa
src/components/           ← mapa de poltronas, fluxo de compra, bilhete, etc.
```

## Próximas fases

1. **Banco real:** subir o PostgreSQL (Supabase/Neon) e trocar `store.ts` por Prisma, mantendo as mesmas funções.
2. **Login e perfis** (Admin, Gerente, Vendedor, Conferente) e restrição por linha.
3. **Gateway de pagamento** (Mercado Pago ou Asaas): PIX real com webhook confirmando o pedido; depois, cartão.
4. **Envio do bilhete por WhatsApp/e-mail.**
5. **Formulários de cadastro** (nova embarcação com editor de mapa, nova linha, tarifas, usuários).
6. **Caixa do balcão** (abertura/fechamento) e relatórios exportáveis.
7. **BP-e** (Bilhete de Passagem eletrônico) via emissor fiscal (Focus NFe, PlugNotas…). Validar com o contador.
8. **App de embarque offline (PWA)** para portos sem internet.
