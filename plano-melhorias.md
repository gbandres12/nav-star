# NavStar — Plano de melhorias (Claude + ChatGPT)

> **Arquiteto:** Claude. **Executores:** Claude e ChatGPT, em paralelo, cada um no seu pedaço. O Antigravity (Gemini) continua no
> [`gemini-continuacao.md`](gemini-continuacao.md) (RPCs da operação e porte do balcão para o Supabase).
> **Data:** 24/09/2026 (revisado com as respostas do usuário). **Produção:** https://sistema.saotomeexpresso.com (Vercel) + Supabase `eoeoconepbwrjxjsymug`.

## Pedidos do usuário que este plano cobre
1. **Filtros** (site e painel).
2. **Configurar o valor de cada passagem.**
3. **Programação real:** a lancha sai de **Manaus segunda às 03:00** e volta saindo de **Santarém quarta às 03:00**.
4. **Calendário no site:** a pessoa vê as datas disponíveis no mês.
5. **Taxa de embarque por cidade**, com valor específico por rota quando necessário.
6. **Controle financeiro:** contas a pagar e a receber.

## Decisões do usuário (24/09)
- **Descontos:** idoso e criança têm desconto **em todas as rotas**; a **alíquota (%) é editável no sistema** e pode mudar depois.
  Estudante e PCD continuam configuráveis do mesmo jeito.
- **Taxas da maquininha:** ficam **em aberto** e são **editadas dentro do sistema** (prazo e percentual por forma de pagamento).
  Enquanto não forem preenchidas, o sistema não inventa valor: mostra "taxa não configurada".
- **Contas financeiras:** a empresa tem **Caixa físico** (dinheiro) e **Caixa digital** (PIX e cartões).

## Divisão

| # | Entrega | Dono | Depende de |
|---|---|---|---|
| **C0** | Corrigir a programação em produção (seg 03:00 / qua 03:00) | **Claude** | aprovação do usuário |
| **C1** | Tabela de preços configurável (rota × trecho × tipo de passageiro, com vigência) | **Claude** | — |
| **C2** | Taxa de embarque por cidade + exceção por rota | **Claude** | C1 (mesma regra de preço) |
| **G1** | Calendário de datas disponíveis no site | **ChatGPT** | — (usa o contrato da §4) |
| **G2** | Filtros no site e no painel | **ChatGPT** | — |
| **G3** | Financeiro: contas a pagar e a receber, fluxo de caixa | **ChatGPT** | — |

Por que assim: C0–C2 mexem no **cálculo do preço**, que é usado na venda (`criar_pedido_*`), na busca e no bilhete. Um dono só
evita duas versões da regra. G1–G3 são módulos novos ou de leitura, com arquivos próprios, e podem andar em paralelo sem conflito.

---

## 1. Contexto obrigatório para o ChatGPT (leia antes de codar)

- **Stack:** Next.js **16** (App Router; `middleware` virou `proxy.ts`; `params`/`searchParams` são Promises; tipos `PageProps<"/rota">`),
  React 19, Tailwind v4, Supabase (Postgres + Auth + RLS). Leia `AGENTS.md` e `node_modules/next/dist/docs/` antes de usar APIs do Next.
- **Camadas:** página → server action → `src/lib/data/*.ts` → Supabase (tabela com RLS ou RPC). **Não use `src/lib/store.ts`**: é o
  protótipo em memória e está sendo aposentado. Tudo que você criar grava e lê no Supabase.
- **Convenção de cidade:** no app a cidade é identificada pelo **slug** (`manaus`); no banco, pelo **uuid**. Leia com join
  `cidade:cidades(slug)` e grave convertendo com `uuidCidade()` (`src/lib/data/catalogo.ts`). Esse descuido já derrubou o site uma vez.
- **Permissões por tela:** `src/lib/permissoes.ts` (`ACESSO`) + `garantirAcesso(rota)` nas páginas e `exigirPapel(...)` nas actions
  (`src/lib/sessao.ts`). Financeiro = ADMIN e GERENTE.
- **UI:** pt-BR; classes do projeto (`card`, `input`, `label`, `btn-primary`, `btn-ghost`, `table-base`), paleta `rio-*`/`sol-*`/`rubro-*`,
  ícones `lucide-react`, `<Badge>`, `<Stat>`, `<PageHeader>`, `ActionForm`/`Campo`/`Checkbox` (`src/components/admin/action-form.tsx`).
  Tudo precisa funcionar em 375 px.
- **Migrações:** um arquivo novo por entrega em `supabase/migrations/`, **re-executável** (`if not exists`, `drop policy if exists`),
  RLS em toda tabela, funções `security definer set search_path = ''` com `grant execute` explícito. **Faixas de numeração** para não
  colidir: Antigravity `…0011–0019`, Claude `…0020–0029`, **ChatGPT `…0030–0039`**.
- **Teste de migração:** antes de entregar, aplique a cadeia inteira num Postgres descartável (Docker `postgres:15-alpine`, com stubs de
  `auth.uid()` e dos papéis `anon`/`authenticated`) e rode a sua migração **duas vezes**. O usuário aplica no SQL Editor; erro lá custa caro.
- **Definição de pronto:** `npx tsc --noEmit && npx eslint <arquivos que você mexeu> && npm run build` sem erro, mais o teste manual do item.
- **Proibido:** deploy de produção, escrever no banco de produção, instalar dependência nova, apagar/alterar arquivos de outro dono
  (tabela da §5) sem combinar. Entregue em **branch própria** (`chatgpt/g1-calendario`, …) e registre no fim deste arquivo.

---

## 2. Tarefas do Claude

### C0 — Programação real em produção ✅ *feito em 24/09 (aprovado pelo usuário)*
- `horarios_linha`: Manaus → Santarém **segunda 03:00**; Santarém → Manaus **quarta 03:00**. Desativar sexta 03:00 e sábado 06:00.
- Viagens futuras já geradas de sexta/sábado **sem passagem vendida**: cancelar (status `CANCELADA`, vendas fechadas). As de quarta às
  06:00 passam para 03:00 se não tiverem vendas; se tiverem, avisar o usuário antes.
- Corrigir `src/lib/seed.ts` e `scripts/carga-inicial-producao.ts` para a mesma programação.

### C1 — Tabela de preços configurável
**Modelo:** hoje o preço é um valor por par origem → destino (`tarifas_trecho`) e os descontos por tipo são globais
(`descontos_tipo_passageiro`). Passa a ser:
- **Alíquotas globais editáveis** (decisão do usuário): em `/admin/configuracoes?aba=valores`, um campo de % para cada tipo
  (criança, idoso, estudante, PCD), gravando em `descontos_tipo_passageiro`, com **histórico** (quem alterou, quando, valor anterior) e
  aviso de que a mudança vale para vendas novas. Valem para **todas as rotas**.
- `tarifas_trecho` continua sendo o **preço base** (inteira) de cada trecho.
- **Nova** `precos_tipo_trecho (tarifa_id, tipo_passageiro, modo: PERCENTUAL|VALOR_FIXO, valor, vigencia_inicio, vigencia_fim)`: permite
  dizer "criança Manaus→Parintins = R$ 180,00" ou "estudante nesta rota = 40%". Sem linha específica, vale o desconto global do tipo.
- **Vigência** na tarifa base (`tarifas_trecho.vigencia_inicio/fim` + histórico): reajuste agendado ("a partir de 01/11 Manaus→Santarém
  R$ 540") sem mexer em passagens já vendidas.
- Uma função única `private.preco_passagem(viagem, origem, destino, tipo, convenio, comodo)` usada por `buscar_viagens`,
  `criar_pedido_site`, `criar_pedido_balcao` e pelo calendário (G1). Inclui festival (reajuste %) e cômodo.

**Telas (portar para o Supabase):** `/admin/trechos` (matriz de preços com abas por tipo de passageiro e campo de vigência),
`/admin/linhas/**` (paradas e horários), `/admin/portos`, `/admin/configuracoes?aba=valores` (descontos globais). Hoje essas telas gravam
no protótipo em memória — em produção não têm efeito.

### C2 — Taxa de embarque por cidade, com exceção por rota
- **Padrão por cidade:** `cidades.taxa_embarque_padrao` (o porto herda se não tiver valor próprio; hoje a taxa fica no porto).
- **Exceção por rota:** nova `taxas_embarque_linha (linha_id, porto_id, valor, vigencia_inicio, vigencia_fim)`.
- Ordem de decisão: exceção da rota → taxa do porto → padrão da cidade → 0. Mesma função em busca, venda, bilhete e relatório
  "Taxa de embarque".
- Tela: aba "Taxas de embarque" em `/admin/portos` (por cidade) e em `/admin/linhas/[id]` (exceções da rota).

---

## 3. Tarefas do ChatGPT

### G1 — Calendário de datas disponíveis no site
**Objetivo:** ao escolher origem e destino, a pessoa vê o **mês inteiro** e sabe em que dias tem saída, a que horas, a partir de quanto e
se ainda há lugar.

- **Banco (migração `…0030_calendario.sql`):** RPC pública `calendario_viagens(origem_slug text, destino_slug text, mes date)` →
  linhas `{ dia date, viagem_id uuid, saida timestamptz, chegada timestamptz, valor numeric, taxa numeric, livres int, festival text }`
  para as viagens do mês com vendas abertas. Use a função de preço do C1 quando existir; até lá, a mesma lógica do `buscar_viagens`
  (leia o corpo dela no Supabase e reaproveite). `grant execute … to anon, authenticated`. Sem dado pessoal.
- **Dados:** `src/lib/data/calendario.ts#calendarioViagens(origem, destino, "AAAA-MM")`.
- **Componente:** `src/components/site/calendario-viagens.tsx` — grade do mês (dom→sáb), navegação ◀ mês ▶, cada dia com saída mostra
  horário, "a partir de R$ X" e lugares (verde; âmbar < 15; "Esgotado" em vermelho); dia sem saída fica neutro; hoje destacado; dias
  passados desabilitados. Clicar no dia lista as saídas daquele dia com botão **Comprar** (`/viagens/{id}?o=…&d=…`).
  Em telas < 640 px vira **lista das datas disponíveis** do mês (não uma grade espremida).
- **Onde aparece:** em `/viagens` (acima da lista de resultados, sincronizado com `?mes=AAAA-MM` e `?data=`) e na home, um bloco
  "Próximas datas" para as rotas principais (Manaus → Santarém e Santarém → Manaus), com link para o calendário completo.
- **Aceite:** com a programação do C0, o calendário de outubro mostra só as segundas (Manaus → Santarém) ou só as quartas
  (Santarém → Manaus), às 03:00; viagem cancelada não aparece; esgotada aparece como esgotada; trocar o mês não recarrega a página inteira.

### G2 — Filtros
**Site (`/viagens`):** faixa de horário (madrugada/manhã/tarde/noite), "só com lugares", ordenar por data ou preço, embarcação. Tudo em
query string (link compartilhável). Mantém o formulário de origem/destino/data.

**Painel** (padrão visual de `src/app/admin/pedidos/page.tsx`: card de filtros + tabela + paginação, estado na URL):
- `/admin/pedidos`: período (de/até), linha, viagem, canal, status, forma de pagamento, tipo de passageiro, vendedor, busca por
  código/nome/CPF.
- `/admin/viagens`: mês, linha, embarcação, status, "com vendas abertas".
- `/admin/encomendas`: período, origem, destino, status, pagador, frete pago/a receber.
- Botão **Limpar filtros** e contador "N resultados". Exportar CSV reaproveitando o padrão de `/admin/relatorios/[tipo]/csv`.
- Filtre **no banco** (consulta com `eq/gte/lte/ilike` + `range` para paginar), não em memória.

### G3 — Financeiro: contas a pagar e a receber
**Banco (migração `…0031_financeiro.sql`)**, todas com `empresa_id`, RLS só para ADMIN/GERENTE da empresa:
- `fin_categorias (id, nome, tipo RECEITA|DESPESA, pai_id, ativa)` — seed de categorias típicas: Combustível, Manutenção, Salários,
  Alimentação a bordo, Taxas portuárias, Comissões de agências, Impostos, Aluguel, Receita de passagens, Receita de fretes, Convênios.
- `fin_contas (id, nome, tipo FISICO|DIGITAL, saldo_inicial, ativa)` — onde o dinheiro está. **Criar já as duas contas da empresa:
  "Caixa físico" (FISICO) e "Caixa digital" (DIGITAL).** Dinheiro entra no físico; PIX e cartões entram no digital.
- `fin_formas_recebimento (forma CREDITO|DEBITO|PIX|DINHEIRO|FATURADO, conta_id, prazo_dias int null, taxa_percentual numeric null,
  taxa_fixa numeric null, atualizado_por, atualizado_em)` — **taxas da maquininha editáveis no sistema.** Começam **vazias (null)**.
  Com valor vazio: o previsto usa prazo 0 e taxa 0 **e a tela mostra o selo "taxa não configurada"** nas vendas afetadas e no fluxo.
  Guardar histórico de alterações (a taxa vigente na data da venda é a que vale para aquela venda).
- `fin_pessoas (id, nome, documento, tipo FORNECEDOR|CLIENTE|AMBOS, contato)`.
- `fin_lancamentos (id, tipo PAGAR|RECEBER, descricao, categoria_id, pessoa_id, conta_id, valor, vencimento date, competencia date,
  status ABERTO|PAGO|CANCELADO, pago_em, valor_pago, juros, desconto, forma, documento, anexo_url, parcela int, total_parcelas int,
  recorrencia_id, origem MANUAL|PEDIDO|ENCOMENDA|CONVENIO|AGENCIA|TAXA_PORTO, origem_id, observacao, created_by, created_at)`.
  "Atrasado" é **calculado** (`status = ABERTO and vencimento < hoje`), não gravado.
- `fin_recorrencias (id, frequencia MENSAL|SEMANAL|ANUAL, dia, inicio, fim)` + job `pg_cron` diário que gera os lançamentos do próximo mês.
- RPCs: `fin_baixar(lancamento_id, valor_pago, pago_em, conta_id, juros, desconto)` (baixa total ou parcial: a parcial gera um novo
  lançamento com o saldo), `fin_estornar_baixa`, `fin_parcelar(...)`, `fin_fluxo_caixa(de, ate, agrupamento)`.

**Integração com a operação** (lançamentos automáticos, marcados com `origem`, sem duplicar se rodar de novo):
- **A receber:** convênios faturados (pedidos `FATURADO` do mês, agrupados por convênio, vencimento configurável); vendas no cartão
  com o **prazo e a taxa cadastrados em `fin_formas_recebimento`** (valor líquido = bruto − taxa; a taxa vira despesa
  "Taxas de cartão"). Sem cadastro, entra sem taxa e com o selo "taxa não configurada".
- **A pagar:** comissão de cada agência no fechamento do mês; repasse das taxas de embarque por porto (valor do relatório "Taxa de
  embarque").
- Receitas à vista entram como **realizadas** no fluxo de caixa a partir dos pedidos pagos, sem virar lançamento manual:
  **dinheiro → Caixa físico**, **PIX → Caixa digital**.
- **Caixa do balcão × Caixa físico:** o fechamento de cada sessão de caixa do balcão (valor contado) e as sangrias viram movimentos do
  Caixa físico; diferença de caixa vira lançamento na categoria "Diferença de caixa". (Depende das RPCs de caixa do Antigravity;
  se ainda não existirem, deixe a integração preparada e registre em Pendências.)

**Telas** (sob `/admin/financeiro`, sem quebrar o painel que já existe em `/admin/financeiro`):
- `/admin/financeiro/contas`: abas **A pagar** / **A receber**; filtros (status, período de vencimento, categoria, pessoa, conta);
  totais no topo (vence hoje, próximos 7 dias, atrasado, pago no mês); ações baixar, editar, duplicar, cancelar.
- `/admin/financeiro/contas/novo` e `/[id]`: formulário com parcelamento e recorrência; anexo do boleto/nota no Supabase Storage
  (bucket privado `financeiro`, leitura por URL assinada).
- `/admin/financeiro/fluxo`: previsto × realizado por dia/semana/mês, saldo por conta, gráfico com `BarChart` de
  `src/components/admin/charts.tsx`.
- `/admin/financeiro/cadastros`: categorias, contas e pessoas.
- `/admin/financeiro/formas-de-recebimento`: tabela editável com prazo (dias) e taxa (%) + taxa fixa (R$) de crédito, débito e PIX,
  conta de destino de cada forma, e o histórico de alterações. Só ADMIN edita; GERENTE vê.
- Sidebar (grupo **Gestão**): "Contas a pagar/receber" e "Fluxo de caixa". Relatório CSV de lançamentos.
- **Aceite:** lançar uma conta de combustível parcelada em 3x, baixar a 1ª com juros pelo Caixa físico, ver o fluxo do mês refletir;
  gerar os a receber do convênio faturado e o a pagar da comissão da agência sem duplicar ao repetir; com a taxa de crédito vazia, o
  previsto mostra o selo "taxa não configurada"; ao preencher 3,5% e D+30, o previsto passa a mostrar o líquido na data certa.

---

## 4. Contrato entre as frentes (para ninguém esperar o outro)
- **Preço:** enquanto o C1 não chega, G1 usa o mesmo cálculo do `buscar_viagens`. Quando o C1 entregar
  `private.preco_passagem(...)`, o Claude troca `buscar_viagens` e `calendario_viagens` para usá-la (o Claude mexe no corpo da RPC do
  calendário; o ChatGPT não precisa voltar nela).
- **Programação:** G1 não cria nem altera viagens; só lê. A programação é do C0.
- **Financeiro × vendas:** G3 **lê** pedidos, pagamentos, agências e convênios; nunca altera essas tabelas.

## 5. Quem mexe em quê (não edite arquivo de outro dono)

| Área | Dono |
|---|---|
| `supabase/migrations/…0011–0019`, RPCs da operação, `src/lib/data/{caixa,cancelamentos,mapa,relatorios}.ts` | Antigravity |
| `supabase/migrations/…0020–0029`, `buscar_viagens`, `criar_pedido_*`, `src/lib/data/{catalogo,viagens,pedidos}.ts`, telas `/admin/{trechos,linhas,portos,configuracoes}` | Claude |
| `supabase/migrations/…0030–0039`, `src/lib/data/{calendario,financeiro*}.ts`, `src/components/site/calendario-*`, `/admin/financeiro/**` (subpáginas novas), filtros em `/viagens`, `/admin/{pedidos,viagens,encomendas}` | ChatGPT |
| `src/lib/permissoes.ts`, `src/components/admin/sidebar.tsx` | compartilhado: só **acrescentar** linhas, nunca reorganizar |

## 6. Ordem sugerida
1. **C0** (hoje, com aprovação) — o site está vendendo saídas de sexta e sábado que não existem.
2. Em paralelo: **C1 → C2** (Claude) · **G1 → G2 → G3** (ChatGPT).
3. Cada entrega: branch própria → build ok → deploy de **preview** → o usuário confere → produção só com o "pode subir" do usuário.

## Registro de execução

| Data | Item | Dono | Branch / arquivos | Checks | Observações |
|---|---|---|---|---|---|
| 24/09/2026 | G1 — calendário de datas disponíveis | ChatGPT | `chatgpt/g1-calendario`; migração `20260923000030_calendario.sql`, `src/lib/data/calendario.ts`, `src/components/site/calendario-viagens.tsx`, páginas `/viagens` e home | `npx tsc --noEmit`, ESLint do G1 e `npx next build --webpack` OK; projeto remoto `eoeoconepbwrjxjsymug` consultado em modo leitura | `npm run build` com Turbopack foi bloqueado pelo ambiente (`Operation not permitted`); PostgreSQL descartável não pôde iniciar porque o Docker daemon não está disponível. A RPC ainda não existe no projeto remoto: aplicar a migração e conferir o calendário antes do deploy. |
| 24/09 | C0 | Claude | `scripts/corrigir-programacao.ts`, `src/lib/seed.ts` | aplicado em produção; site conferido | Horários: MS seg 03:00, SM qua 03:00 (sex e sáb desativados). 14 viagens de sex/sáb canceladas e 6 de qua movidas de 06:00 para 03:00; nenhuma tinha passagem. O script é re-executável e mostra o que faria sem `--confirmar`. |
| 24/09 | C1 (parte 1) | Claude | `src/lib/data/precos.ts`, `src/lib/precos-actions.ts`, telas `/admin/{trechos,portos,configuracoes,linhas/**}`, `src/lib/data/utils.ts#getConfig`, migração `…0020_descontos_editaveis.sql` | tsc ok nos arquivos do Claude; build pendente (tree com G1 em andamento) | Telas de preços, portos/taxas, descontos, empresa, bilhete, linhas e programação passam a gravar no Supabase (antes gravavam no protótipo e não tinham efeito). `getConfig` deixou de ter dados falsos (WhatsApp/CNPJ inventados) e lê do banco. Horários desativados não aparecem mais. Falta: aplicar a `…0020` (descontos) e publicar. |
| 24/09 | Fotos dos festivais + festivais no Supabase | Claude | migração `…0021_festivais_fotos.sql` (tabela `festival_fotos` + bucket público `festivais`), `src/lib/data/festivais.ts`, `src/lib/festivais-actions.ts`, `src/components/admin/fotos-festival.tsx`, telas `/admin/festivais/**`, `/festivais/[slug]`, `festival-card`, `(site)/layout.tsx`, `next.config.ts` | tsc, eslint e `npm run build` ok; site conferido local | O painel de festivais deixa o protótipo: cadastro, viagens e fotos gravam no banco. Upload direto do navegador ao Storage (redução para 1920 px). "Criar viagem extra" fica fora até existir `gerar/criar viagem` no banco. **Segurança:** `sessao.ts` não assume mais o ADMIN do protótipo sem login em produção. `…0021` aplicada em 24/09. |
| 24/09 | Segurança: RPCs internas fechadas | Claude (aplicada pelo usuário) | migração `…0022_fechar_rpcs_internas.sql` | conferido: anon só executa as 6 RPCs do site; `confirmar_pagamento` só `service_role`; busca do site ok | 9 RPCs estavam executáveis por PUBLIC (o revoke da 0003 veio antes delas). **Toda RPC nova precisa de `revoke execute ... from public` explícito.** |
| 24/09 | Fotos da lancha no site | Claude | `src/assets/lancha/*`, `(site)/page.tsx` (topo + seção "Conheça a lancha"), `(site)/opengraph-image.jpg`, `layout.tsx#metadataBase` | build ok; conferido em 1366 px e 375 px | Prévia de link (WhatsApp) com a foto da lancha. |
| 24/09 | PIX manual + pedidos e balcão no Supabase | Claude | migração `…0023_pix_manual.sql`, `src/lib/pix.ts` (BR Code, CRC conferido com o exemplo do BCB), `data/pix.ts`, `data/pedidos.ts#pedidoCompleto`, `/pedido/[codigo]`, `/bilhete/[codigo]`, `bilhete-termico`, `/admin/pedidos/**`, `/admin/vender/**`, aba Pagamento em `/admin/configuracoes`, `booking-flow` | tsc, eslint e build ok | Página do pedido usava a tabela `pedidos` (visitante não lê → 404 depois da compra); agora usa `pedido_publico`. Cliente paga, toca "Já paguei" (reserva estendida por `horas_confirmacao_pix`) e ADMIN/GERENTE confirma em Pedidos. Balcão com PIX mostra o QR antes de emitir. Cancelamento é do pedido inteiro. Falta aplicar a `…0023`. |
| 24/09 | Lotação com criança de colo | Claude | migração `…0024_lotacao_colo.sql` (`private.criar_pedido`), `booking-flow` (opção "Criança de colo") | casos testados em transação desfeita: adulto+colo ok (taxa só do adulto), só colo recusado, lotação estourada recusada, trecho sem sobreposição ok | Regra do usuário: colo não ocupa poltrona mas conta na lotação. Vendas da mesma viagem passam a ser serializadas (FOR UPDATE). Aplicação definitiva pendente de confirmação. |
| | | | | | |

## Pendências com o usuário
1. ~~C0~~ feito.
2. **Volta de quarta 03:00:** confirmar se faz as mesmas paradas (Óbidos, Juruti, Parintins, Itacoatiara) e com os mesmos tempos.

---

## Mensagem para colar no ChatGPT

> Você vai trabalhar no projeto NavStar (Next.js 16 + Supabase), na pasta `nav-star`. Leia primeiro `AGENTS.md` e depois
> `plano-melhorias.md` inteiro — a seção 1 tem as regras obrigatórias e a seção 5 diz quais arquivos são seus.
> Suas tarefas são **G1 (calendário no site), G2 (filtros) e G3 (financeiro com contas a pagar e a receber)**, nessa ordem.
> Outros dois agentes (Claude e Antigravity) trabalham no mesmo projeto: não edite arquivos que não são seus e use migrações só na faixa
> `…0030–0039`. Trabalhe em branch própria (`chatgpt/g1-calendario`, `chatgpt/g2-filtros`, `chatgpt/g3-financeiro`), teste cada migração
> num Postgres descartável rodando-a duas vezes, e só entregue com `npx tsc --noEmit`, `eslint` e `npm run build` sem erro.
> Não faça deploy de produção nem escreva no banco de produção. Ao terminar cada tarefa, preencha a tabela "Registro de execução" do
> plano e liste o que o usuário precisa aplicar (SQL) ou conferir.
