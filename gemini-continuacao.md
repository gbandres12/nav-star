# NavStar — Continuação dos trabalhos (Gemini + subagentes)

> **De:** Claude (arquiteto). **Para:** Gemini/Antigravity (orquestrador) e seus subagentes.
> **Data:** 23/09/2026, depois do deploy de produção.
> Este arquivo é o **ponto de partida da próxima rodada**. Os detalhes técnicos continuam em
> [`backend-plan.md`](backend-plan.md) (especialmente a **§3.1 "Adições da operação"**) e em [`task-plan.md`](task-plan.md).
> Em caso de conflito, vale: este arquivo → `backend-plan.md` → `task-plan.md`.

---

## 1. Estado atual

### No ar
- **Produção (Vercel):** https://nav-star.vercel.app — projeto `gabriellimaandres-2217s-projects/nav-star`, deploy feito pela CLI
  (`npx vercel deploy --prod`) a partir da pasta local, **sem Git conectado**.
- **Domínio `sistema.saotome.com`:** já é alias do projeto, mas **o DNS ainda não aponta para a Vercel** (não resolve). O usuário precisa criar o
  registro no provedor do domínio (CNAME `sistema` → `cname.vercel-dns.com`). Não é tarefa dos agentes.
- **Variáveis na Vercel (Production):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
  `PAGAMENTO_SIMULADO` **não** está definida em produção (de propósito).
- **Arquivo `.vercelignore`** criado: não sobe `.env*`, `.agents`, `.claude` nem os `.md` de planejamento.

### O que funciona em produção hoje
- Site público completo: busca, compra (com ou sem escolher poltrona), assento livre (linha Manaus ↔ Maués), festivais
  (`/festivais`), pedido com PIX simulado, bilhete, rastreio. Testado: compra criada e pedido exibido.
- `/admin` redireciona para `/login` (proxy do Gemini).

### ⚠️ Riscos do que está no ar (resolver na ordem das Ondas abaixo)
1. **Os dados ainda estão em memória** (`src/lib/store.ts`). Na Vercel cada instância serverless tem a sua cópia: um pedido pode
   "sumir" se a próxima requisição cair em outra instância, e tudo zera a cada deploy ou cold start. **Não divulgar o site para clientes
   antes de concluir a Onda 2.**
2. **O botão "Simular pagamento aprovado" está público** em `/pedido/[codigo]`. Qualquer pessoa marca um pedido como pago.
   Na Onda 2, ele só pode aparecer com `PAGAMENTO_SIMULADO=true` (nunca em produção).
3. **Login × dados em memória:** `src/lib/sessao.ts` agora prioriza o usuário do Supabase Auth. O `id` desse usuário (uuid) **não existe**
   em `db().usuarios`. Por isso, com login real, falham caixa (`abrirCaixa` → "Operador não identificado"), venda de balcão, cancelamento e
   embarque (tudo que chama `usuario(op.id)` no store). Só se resolve de verdade ao portar para o Supabase (Onda 2).
4. **Não se sabe se já existe usuário ADMIN no Supabase Auth.** Sem ele ninguém entra no `/admin` publicado. O `.env.local` não tem
   `SUPABASE_SECRET_KEY` (valor vazio), então não foi possível conferir daqui.
5. **Nada está versionado no Git** desde o commit inicial `aaf2d5d`. Há dois agentes editando a mesma pasta.

---

## 2. Equipe de subagentes (Antigravity `define_subagent`)

Mantenha os dois que já existem e crie mais dois. Cada entrega passa pelo `qa_auditor` antes de ser marcada como feita.

| Subagente | Já existe? | Responsável por | Não faz |
|---|---|---|---|
| **Orquestrador** (você) | sim | Ordem das ondas, registro nos planos, commits/branches (se o usuário autorizar), deploy de preview | Não pula a auditoria |
| `db_architect` | sim | Migrações SQL, RLS, RPCs, `pg_cron`, pgTAP, `db:types` | Não mexe em telas |
| `data_porter` | **criar** | Portar cada tela/action de `store.ts` para `src/lib/data/*` + RPCs, mantendo a interface visual | Não cria regra de negócio nova; se o store e o banco divergirem, registra em Pendências |
| `qa_auditor` | sim | Definição de pronto, testes manuais por perfil, regressão visual, conferência com o plano | Não implementa features |
| `release_manager` | **criar** | Deploys de *preview* na Vercel, checagem pós-deploy (smoke test das rotas), variáveis de ambiente | **Nunca** faz deploy de produção sem aprovação do usuário naquela conversa |

Prompt sugerido para `data_porter`:
> "Você migra o NavStar de dados em memória para Supabase. Para cada função do `src/lib/store.ts` usada pela tela indicada, crie ou use a
> função equivalente em `src/lib/data/*.ts` (async, mesmo nome e mesmo tipo de retorno de `src/lib/types.ts`), chamando RPC para qualquer
> escrita. Troque os imports da tela. Não altere layout nem textos. Preserve as mensagens de erro do store. Ao terminar cada tela, liste as
> funções portadas e peça auditoria ao `qa_auditor`."

Prompt sugerido para `release_manager`:
> "Você cuida de deploys do NavStar na Vercel (CLI já logada). Use `npx vercel deploy` (preview) e depois rode `curl` nas rotas públicas e em
> `/admin` (esperado: 307 para `/login`). Nunca rode `vercel deploy --prod`, `vercel env rm` nem altere domínios sem a frase explícita do
> usuário autorizando. Nunca imprima valores de variáveis de ambiente."

---

## 3. Regras para todos

1. Leia `AGENTS.md` (Next 16: `proxy.ts`, `PageProps`, params como Promise) e as skills `.agents/skills/supabase*`.
2. **Coordenação com o Claude:** antes de editar `src/lib/store.ts`, `src/lib/types.ts`, `src/lib/seed.ts`, `src/lib/admin-actions.ts`,
   `src/lib/relatorios.ts` ou `src/components/**`, confira no topo do `task-plan.md` se há aviso 🚧 do Claude. Se houver, não edite.
3. **Git:** peça ao usuário para autorizar um commit do estado atual **antes da Onda 1**. Depois, uma branch por onda
   (`gemini/onda-1-operacao-db`, …) e um commit por item.
4. **Definição de pronto** (sem exceção):
   ```bash
   npm run db:types && npm run db:test && npx next typegen && npx tsc --noEmit && npx eslint src && npm run build
   ```
   mais o teste manual do item, com o perfil indicado.
5. Registre cada item no **Registro de execução** do `backend-plan.md`: data, item, arquivos, checks, observações.
6. **Proibido sem aprovação explícita do usuário:** deploy de produção, mudar domínio/DNS, apagar dados do Supabase remoto, rodar
   `scripts/seed.ts` contra o banco remoto, instalar SDK de gateway/e-mail/WhatsApp, colocar chaves secretas em código ou em arquivo versionado.

---

## 4. Plano de trabalho

### Onda 0 — Destravar (orquestrador, antes de tudo)
- [ ] **0.1** Pedir ao usuário: (a) autorização para o commit do estado atual; (b) confirmação de que existe um usuário ADMIN no Supabase Auth.
      Se não existir, orientar: Supabase → Authentication → Add user (e-mail/senha) e, pelo `db_architect`, inserir a linha em `perfis`
      com `papel = 'ADMIN'` e a `empresa_id` da São Tomé. **Não crie a conta pelo navegador.**
- [ ] **0.2** Pedir ao usuário para colocar a `SUPABASE_SECRET_KEY` no `.env.local` local (hoje vazia). O script de seed e os testes precisam dela.

### Onda 1 — Banco da operação (`db_architect`, auditado pelo `qa_auditor`)
Especificação completa: **`backend-plan.md` §3.1**. Uma migração nova `20260923000010_operacao.sql` (nunca edite as já aplicadas):
- [ ] **1.1** Enum `FATURADO`; tabelas `comodos`, `tripulantes` (+ enum `funcao_tripulante`), `viagem_tripulantes`, `convenios`,
      `caixa_movimentos`, `cancelamentos`, `configuracoes_bilhete`, `festivais`, `festival_viagens`.
- [ ] **1.2** Colunas novas: `empresas` (regras de valores e WhatsApps), `assentos.comodo_id`, `embarcacoes` (`ano`, `comprimento_m`,
      `observacao`, **`assento_livre`**), `viagens` (`motivo_cancelamento`, `avulsa`), `passagens` (`convenio_id`, `acrescimo`,
      `impressoes`), `pedidos.numero`, `caixa_sessoes` (`valor_contado`, `observacao`).
- [ ] **1.3** Ajustar o check de `passagens.assento_id` nulo: permitido para `COLO` **ou** embarcação de assento livre.
- [ ] **1.4** RLS de todas as tabelas novas conforme a matriz da B3 (festivais publicados: leitura anon; o resto: sem anon).
- [ ] **1.5** RPCs da §3.1: `cancelar_passagens`, `abrir_caixa`/`movimentar_caixa`/`fechar_caixa`/`resumo_caixa`,
      `alterar_status_viagem`, `alternar_vendas_viagem`, `definir_tripulacao`, `trocar_embarcacao` (3 casos: numerado↔numerado,
      →livre, livre→numerado), `criar_viagem_avulsa`, `gerar_viagens`, `salvar_mapa_assentos`, `salvar_linha`/`salvar_tarifas`/
      `salvar_horarios`, `registrar_impressao`, `vincular_viagem_festival`, `opcoes_festival(slug)` (pública).
- [ ] **1.6** Atualizar `criar_pedido_site`/`criar_pedido_balcao`: poltrona opcional (escolha automática igual a `alocarAssentos`),
      assento livre com `select … for update` na viagem, preço = `tarifaViagem` (reajuste de festival) + cômodo − maior desconto
      (tipo × convênio), convênio faturado → `FATURADO`, caixa aberto obrigatório para DINHEIRO.
- [ ] **1.7** Relatórios: uma RPC `relatorio(slug, filtros jsonb)` que devolve `{destaques, colunas, linhas, total}` no formato de
      `src/lib/relatorios.ts`, **ou** uma view `security_invoker` por relatório. Os 14 slugs estão em `src/lib/relatorios-lista.ts`.
- [ ] **1.8** pgTAP novo: venda concorrente sem poltrona nunca repete assento; assento livre não passa da lotação; multa de cancelamento
      por prazo; caixa (esperado × contado); preço de festival; troca de embarcação nos 3 casos; RLS das tabelas novas.
- [ ] **1.9** `scripts/seed.ts`: incluir os dados novos do `src/lib/seed.ts` (cômodos, tripulantes, convênios, caixas, cancelamentos,
      festivais, linha de Maués). **Só no banco local.**

### Onda 2 — Trocar o protótipo pelo banco (`data_porter`, uma área por vez, auditada pelo `qa_auditor`)
Ordem obrigatória (do mais exposto ao cliente para o mais interno). Em cada área: portar leituras, portar actions, apagar o uso de `db()`.
- [ ] **2.1 Site público:** home, `/viagens`, `/viagens/[id]`, `/pedido/[codigo]`, `/bilhete/[codigo]`, `/rastreio`, `/festivais/**`.
      Aqui também: **esconder "Simular pagamento aprovado" quando `PAGAMENTO_SIMULADO !== "true"`** e decidir a pendência P5
      (link do pedido com os 4 últimos dígitos do telefone).
- [ ] **2.2 Login e sessão:** concluir a B8. `operadorAtual()` passa a devolver só o usuário do Supabase. Em produção, **remover o
      seletor "Operando como"** (`src/components/admin/operador-switch.tsx`) e o cookie `navstar_operador`; manter só com
      `NODE_ENV === "development"` se ajudar nos testes. Logout na sidebar. `garantirAcesso`/`exigirPapel` continuam como estão.
- [ ] **2.3 Balcão:** `/admin/vender/**`, `/admin/caixa/**`, `/admin/pedidos/**` (cancelamento e 2ª via), `/admin/embarque`.
- [ ] **2.4 Operação:** `/admin/viagens/**` (status, tripulação, troca de embarcação, avulsa, gerar viagens), `/admin/mapa`, `/admin/encomendas/**`.
- [ ] **2.5 Cadastros:** embarcações (+ editor de mapa e assento livre), cômodos, tripulantes, linhas, trechos, portos/cidades,
      convênios, agências, festivais, configurações.
- [ ] **2.6 Usuários:** criação por convite (`auth.admin.inviteUserByEmail`) numa server action de ADMIN usando `src/lib/supabase/admin.ts`.
- [ ] **2.7 Gestão:** painel, financeiro, relatórios + CSV (`/admin/relatorios/[tipo]/csv`).
- [ ] **2.8 Limpeza:** apagar `db()`, o banco em memória do `store.ts` e o uso de `src/lib/seed.ts` fora do script. `npx eslint src` sem
      nenhum import de `@/lib/store` em páginas.

*Aceite da Onda 2:* o `qa_auditor` faz o roteiro abaixo em um **deploy de preview**, com servidor reiniciado entre os passos:
comprar pelo site (com e sem poltrona, e em Maués) → pagar simulado → como VENDEDOR abrir caixa, vender em dinheiro, cancelar um
passageiro, fechar caixa → como CONFERENTE validar o QR → como GERENTE concluir a viagem e abrir 3 relatórios → exportar CSV.
Tudo precisa persistir.

### Onda 3 — Produção (`release_manager`, **cada passo com aprovação do usuário**)
- [ ] **3.1** Conectar o repositório GitHub `gbandres12/nav-star` ao projeto da Vercel (deploy automático por branch). Hoje é só pela CLI.
- [ ] **3.2** `PAGAMENTO_SIMULADO` ausente/`false` em Production; presente só em Preview.
- [ ] **3.3** Região das funções da Vercel `gru1` (São Paulo), perto do Supabase.
- [ ] **3.4** `sitemap.ts`, `robots.ts` (bloquear `/admin`, `/bilhete`, `/pedido`) e metadados do site.
- [ ] **3.5** Páginas de Política de Privacidade e Termos (texto final revisado pelo usuário).
- [ ] **3.6** Monitoramento de erros (ferramenta a definir com o usuário) e alerta de falha nos jobs do `pg_cron`.
- [ ] **3.7** Deploy de produção **somente** com a frase de aprovação do usuário. Depois, smoke test e registro.

### Onda 4 — Funcionalidades que ainda faltam (depois da Onda 2)
| Item | Dono | Situação |
|---|---|---|
| Remarcação de passagem (B.2) | `db_architect` + `data_porter` | ⛔ aguarda regra do usuário (taxa, prazo, troca de trecho) |
| Envio do link do pedido por WhatsApp no balcão (`wa.me`, B.5) | `data_porter` | pronto para fazer |
| Encomendas em lote na viagem, retirada com pagamento do frete, devolução (B.6) | ambos | pronto para fazer |
| Refeições a bordo (venda + relatório) | — | ⛔ aguarda o usuário confirmar se vendem refeição |
| Foto da embarcação e logo da empresa no Storage | ambos | pronto para fazer |
| Painel com comparativo mensal e ranking de trechos (F.4) | `data_porter` | pronto para fazer |
| Gateway de pagamento real, estorno, cartão (Fase D) | — | ⛔ aguarda escolha do gateway |
| Avisos por e-mail/WhatsApp e "Minhas passagens" (Fase E) | — | ⛔ aguarda escolha dos provedores |
| Embarque offline / PWA com câmera (Fase G) | `data_porter` | depois da Onda 2 |
| BP-e (Fase H) | — | ⛔ aguarda contador e emissor |

---

## 5. Onde está cada regra (referência rápida para o `data_porter`)

| Regra | Função no protótipo |
|---|---|
| Preço final | `store.precoPassagem` + `store.tarifaViagem` (festival) |
| Escolha automática de poltrona | `store.alocarAssentos` |
| Lotação (numerado e livre) | `store.lugaresLivres`, `passageirosPorSegmento`, `capacidade`, `ocupacaoViagem` |
| Venda | `store.criarPedido` (convênio, faturado, caixa, agência, linhas permitidas) |
| Cancelamento e multa | `store.calcularCancelamento`, `cancelarPassagens` |
| Caixa | `store.abrirCaixa`, `movimentarCaixa`, `fecharCaixa`, `resumoCaixa` |
| Viagem | `alterarStatusViagem`, `alternarVendas`, `definirTripulacao`, `trocarEmbarcacao`, `criarViagemAvulsa`, `gerarViagens` |
| Mapa da frota | `store.posicaoFrota` |
| Cadastros | `salvarPorto`, `salvarCidade`, `salvarEmbarcacao`, `salvarMapaAssentos`, `salvarComodo`, `salvarTripulante`, `salvarLinha`, `salvarTarifas`, `salvarHorarios`, `salvarConvenio`, `salvarAgencia`, `salvarUsuario`, `salvarConfig`, `salvarFestival`, `vincularViagemFestival` |
| Festivais no site | `festivaisNoSite`, `opcoesFestival` |
| Relatórios | `src/lib/relatorios.ts` (`gerarRelatorio`, `paraCsv`) |
| Permissões por tela | `src/lib/permissoes.ts` (`ACESSO`, `podeAcessar`) |
| Bilhete (2ª via, 58/80 mm, assento livre) | `src/components/bilhete-termico.tsx` + `config().bilhete` |

## 6. Perguntas abertas para o usuário (o orquestrador pergunta, ninguém decide sozinho)
1. Existe usuário ADMIN no Supabase? Pode colocar a `SUPABASE_SECRET_KEY` no `.env.local`?
2. Autoriza o commit do estado atual e o uso de branches por onda?
3. Remarcação: taxa, prazo e se pode trocar de trecho (P1).
4. Vendem refeição a bordo?
5. Link público do pedido: exigir os 4 últimos dígitos do telefone (P5)?
6. Gateway de pagamento e provedores de e-mail/WhatsApp (P2, P3).
7. Configurar o DNS de `sistema.saotome.com` (CNAME `sistema` → `cname.vercel-dns.com`).
