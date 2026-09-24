# NavStar — Continuação dos trabalhos (Gemini + subagentes)

> **De:** Claude (arquiteto). **Para:** Gemini/Antigravity (orquestrador) e seus subagentes.
> **Data:** 23/09/2026, depois do deploy de produção.
> Este arquivo é o **ponto de partida da próxima rodada**. Os detalhes técnicos continuam em
> [`backend-plan.md`](backend-plan.md) (especialmente a **§3.1 "Adições da operação"**) e em [`task-plan.md`](task-plan.md).
> Em caso de conflito, vale: este arquivo → `backend-plan.md` → `task-plan.md`.

---

## 000. Atualização (Claude, 24/09) — acesso e domínio

- **Domínio oficial:** https://sistema.saotomeexpresso.com (já no projeto da Vercel, DNS ok). Use-o em links e no Supabase.
- **Links de acesso corrigidos:** convites e reenvios (`src/lib/data/usuarios.ts`) agora usam `properties.hashed_token` e apontam para
  `/auth/confirm?token_hash=…&type=invite|recovery&next=/primeiro-acesso` (`src/lib/site.ts#linkDeAcesso`). Validado ponta a ponta em produção:
  o link abre a sessão, leva ao primeiro acesso e libera o `/admin`. Antes usavam `action_link` (PKCE, só funcionava no mesmo navegador
  e dependia das Redirect URLs).
- **Endereço do site:** `origemDoSite()` usa `NEXT_PUBLIC_SITE_URL` ou o domínio da requisição — nada mais cai em `localhost` em produção.
- **Primeiro acesso sem link** agora mostra orientação em vez do formulário ("Auth session missing").
- **Pendente (usuário, no painel do Supabase):** Site URL = domínio oficial, Redirect URLs com `https://sistema.saotomeexpresso.com/**`, e o
  template de e-mail "Reset Password" com `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/primeiro-acesso`
  (idem "Invite user" com `type=invite`). Sem isso, o "Esqueci a senha" por e-mail continua frágil.

## 00. Atualização (Claude, 23/09 23:10) — mais recente

- **Carga inicial de produção feita** (`scripts/carga-inicial-producao.ts`): empresa, 6 cidades, 6 portos, São Tomé Expresso (128 poltronas),
  linhas Manaus ↔ Santarém com preços e horários, 26 viagens, e o ADMIN `gabrielandres052@gmail.com` (perfil criado; aguardando primeiro acesso).
- **Deploy de produção feito** (https://nav-star.vercel.app) com o código atual: site lendo do Supabase, busca e preços conferidos em produção.
- **Bug corrigido na camada de dados:** no app a cidade é o *slug* (`manaus`) e no banco é *uuid*. `mapPorto`/agências/festivais/encomendas
  devolviam o uuid e as buscas porto→cidade nunca batiam (home com erro 500, busca vazia). Agora as consultas trazem `cidade:cidades(slug)` e
  as gravações convertem com `uuidCidade()` (`src/lib/data/catalogo.ts`). **Mantenha essa convenção** em qualquer tela nova.
  `cidade()` também comparava slug com a coluna uuid (o Postgres recusa a consulta) — corrigido com `ehUuid()`.
- **Migração `…0010_operacao.sql` reescrita:** o usuário tentou aplicar e falhou (`column "numero" of relation "pedidos" already exists`).
  Agora é **re-executável** (if not exists / drop policy if exists) e contém **só a estrutura**. As 14 funções que estavam nela eram
  **provisórias e devolviam "ok" sem fazer nada** (ex.: `cancelar_passagens`) — foram removidas. `db_architect`: implementar as RPCs de verdade
  numa migração nova `…0011_operacao_rpcs.sql`, portando a regra do `store.ts`, com pgTAP. O original ficou salvo fora do repositório.
- **0010 validada em Postgres 15 descartável** (0001→0005, 0007, depois 0010 duas vezes): ok e re-executável. Corrigida também a policy de
  `caixa_movimentos`, que usava `caixa_sessoes.empresa_id` (coluna que não existe; a empresa vem de `perfis` via `usuario_id`).
- **Divergência a resolver (`db_architect`):** o arquivo local `…0004_rpc_publicas.sql` **não compila** no Postgres
  (`type t_passagem_item is record`, sintaxe do Oracle, perto da linha 59), mas as funções existem e funcionam no remoto — ou seja, o que
  foi aplicado via MCP não é o que está no repositório. Traga a versão do remoto para o arquivo (ou corrija), para `db reset` funcionar.
  E rode `npm run db:types`: o `database.types.ts` não lista `criar_pedido_site`, `pedido_publico`, `rastrear_encomenda`,
  `criar_pedido_balcao` nem `validar_embarque`, que existem no remoto.
- **Pendente do usuário:** Supabase → Authentication → URL Configuration (Site URL `https://nav-star.vercel.app` e
  `https://nav-star.vercel.app/**`). Sem isso, convites e recuperação de senha voltam para `localhost:3000` — o primeiro convite do ADMIN saiu
  assim e precisa ser gerado de novo (rodar o script de carga outra vez gera um link novo; é idempotente).
- **Segurança:** a `SUPABASE_SECRET_KEY` foi colada no chat. Depois que tudo estiver estável, gerar uma nova no Supabase e atualizar
  `.env.local` e Vercel (`vercel env`), com aprovação do usuário.

## 0. Atualização (Claude, 23/09 21:50) — leia antes de tudo

**O que o Antigravity já fez depois da primeira versão deste arquivo:** commit `753905c` (módulo de usuários no Supabase Auth,
convite com link, `/primeiro-acesso`, `/recuperar-senha`, `/auth/confirm`, onboarding, migração `…0007`), o site público já lendo
do Supabase, `scripts/seed.ts`, e a migração `…0010_operacao.sql` escrita. Trabalho **sem commit** em andamento: `src/lib/data/`
`caixa.ts`, `cancelamentos.ts`, `mapa.ts`, `relatorios.ts` e as telas correspondentes.

**Por que "não aparece nada" em produção:**
1. Os dois deploys de produção do Antigravity (≈ 19:55) **falharam no build** por tipos desatualizados (`festival_viagens` não existia em
   `database.types.ts`; `festivais.ts` importava `linha` de `./viagens`). O site no ar continua sendo o deploy anterior (protótipo em memória).
   → **Sempre rode `npm run build` antes de publicar** e publique primeiro em preview.
2. **O banco remoto está vazio:** nenhuma empresa, cidade, porto, linha, viagem ou perfil. Com o site já lendo do Supabase, um deploy
   agora mostraria o site sem viagens. E ninguém consegue criar usuário, porque a criação exige um ADMIN logado com `empresa_id`.
3. **A migração `…0010_operacao.sql` não foi aplicada no remoto** (`comodos`, `tripulantes`, `caixa_movimentos`, `festivais`,
   `embarcacoes.assento_livre`… não existem). A `…0007` foi aplicada.

**O que o Claude deixou pronto:**
- `scripts/carga-inicial-producao.ts`: carga **real** e idempotente de produção (empresa, 6 cidades, 6 portos, São Tomé Expresso com
  128 poltronas, linhas Manaus ↔ Santarém com paradas, preços e horários, viagens futuras) + **primeiro ADMIN por convite** (gera o link de
  primeiro acesso; não define senha). Sem `--confirmar` só mostra o que faria. Não cria pedidos, encomendas nem usuários de teste.
- Home do site não quebra mais com o banco vazio.

**Ordem para destravar (o orquestrador conduz, o usuário aprova):**
1. `db_architect`: aplicar `…0010_operacao.sql` no remoto (via MCP), depois `npm run db:types` e commit dos tipos.
2. Usuário coloca `SUPABASE_SECRET_KEY` no `.env.local` e autoriza a carga. Rodar:
   `npx tsx --env-file=.env.local scripts/carga-inicial-producao.ts --admin-email <email> --admin-nome "<nome>" --site https://nav-star.vercel.app --confirmar`
3. No Supabase → Authentication → URL Configuration: Site URL `https://nav-star.vercel.app` e `https://nav-star.vercel.app/**` nas Redirect URLs
   (sem isso o link de convite volta para `localhost`).
4. `release_manager`: `npm run build` local → `npx vercel deploy` (preview) → smoke test → só então produção, com aprovação.

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
