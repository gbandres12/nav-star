# NavStar — Tarefas do ChatGPT no Supabase de produção

> **De:** Claude (arquiteto). **Para:** ChatGPT, com acesso ao Supabase do usuário.
> **Data:** 24/09/2026. **Projeto:** `eoeoconepbwrjxjsymug` (produção, com dados reais da São Tomé Expresso).
> O usuário **autorizou** o ChatGPT a executar no banco de produção **somente as tarefas S1–S4 abaixo**. Isso substitui, só para
> estas tarefas, a proibição da §1 do `plano-melhorias.md`. Qualquer outra escrita no banco continua proibida.

## Regras
- Faça **uma tarefa por vez**, na ordem. Antes de cada uma, rode a **checagem "antes"**; depois, a **checagem "depois"**.
  Se o resultado de uma checagem for diferente do esperado, **pare** e mostre ao usuário. Não improvise correção.
- Use `apply_migration` (ou equivalente) só para arquivos de `supabase/migrations/`, com o **conteúdo exato do arquivo**, sem editar.
  Use `execute_sql` só para as consultas escritas aqui.
- **Não** rode `supabase db reset`, `db push`, `drop` de tabela, `delete` nem `truncate`. **Não** aplique outras migrações
  (as `…0011–0019` ainda não existem; `…0001–0010` e `…0030` já estão no banco).
- **Não** mexa em chaves, senhas nem variáveis de ambiente. A troca da `SUPABASE_SECRET_KEY` é tarefa do usuário.
- Ao terminar, preencha o **Registro** no fim deste arquivo com o resultado de cada checagem.

---

## S1 — Aplicar a migração `20260923000020_descontos_editaveis.sql`
Cria o histórico de alterações dos descontos (idoso, criança etc.) e libera o ADMIN para editar o percentual pelo painel.
É re-executável.

**Antes** (esperado: `false`):
```sql
select to_regclass('public.descontos_historico') is not null as ja_existe;
```
**Executar:** aplicar o arquivo `supabase/migrations/20260923000020_descontos_editaveis.sql` com o nome `descontos_editaveis`.

**Depois** (esperado: `true`, `1`, `1`):
```sql
select to_regclass('public.descontos_historico') is not null as tabela,
  (select count(*) from pg_trigger where tgname = 'trg_descontos_historico') as gatilho,
  (select count(*) from pg_policies where policyname = 'descontos_tipo_passageiro_update_admin') as permissao;
```

## S2 — Desativar o horário de quarta duplicado (Santarém → Manaus)
A linha Santarém → Manaus tem **dois** horários ativos de quarta 03:00. Na próxima geração de viagens isso cria viagens em dobro.
Desative o mais novo, criado às 01:44 (não apague).

**Antes** (esperado: 2 linhas, ids `0734375c-…` e `3b3de93a-…`):
```sql
select h.id, h.dia_semana, h.hora_saida, h.ativo, h.created_at
from public.horarios_linha h join public.linhas l on l.id = h.linha_id
where l.nome = 'Santarém → Manaus' and h.dia_semana = 3 and h.ativo;
```
**Executar:**
```sql
update public.horarios_linha set ativo = false
where id = '3b3de93a-28df-5d43-afe2-220fdde2441c' and ativo;
```
**Depois** (esperado: 1 linha, id `0734375c-43cd-5799-92bc-7cd86b8cff12`; e zero viagens futuras duplicadas):
```sql
select h.id from public.horarios_linha h join public.linhas l on l.id = h.linha_id
where l.nome = 'Santarém → Manaus' and h.dia_semana = 3 and h.ativo;

select l.nome, v.partida, count(*) from public.viagens v join public.linhas l on l.id = v.linha_id
where v.partida > now() and v.status <> 'CANCELADA' group by 1, 2 having count(*) > 1;
```

## S3 — Alinhar o repositório com o banco (só leitura no banco)
1. **Tipos:** gere os tipos TypeScript **do projeto remoto** (ferramenta `generate_typescript_types`) e grave em
   `src/lib/supabase/database.types.ts`. Confira que aparecem `criar_pedido_site`, `criar_pedido_balcao`, `pedido_publico`,
   `rastrear_encomenda`, `validar_embarque`, `calendario_viagens` e a tabela `descontos_historico`.
2. **`…0004_rpc_publicas.sql` não compila** (usa `type t_passagem_item is record`, sintaxe do Oracle, perto da linha 59), mas as
   funções existem no banco. Leia a definição real com
   `select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('buscar_viagens','criar_pedido_site','pedido_publico','rastrear_encomenda','assentos_ocupados');`
   e reescreva o arquivo com essas definições (mantendo os `grant execute` que já estão nele). **Não aplique** o arquivo no banco;
   é só para o repositório bater com produção.
3. Rode `npx tsc --noEmit`. Se os tipos novos quebrarem algum arquivo, **liste os erros ao usuário**; não corrija arquivos de
   outro dono (tabela da §5 do `plano-melhorias.md`).

## S4 — Revisão de segurança
Rode os avisos do Supabase (`get_advisors`, tipos `security` e `performance`) e cole o resultado no Registro, com o link de cada
aviso. **Não corrija nada**: o Claude avalia e decide.

---

## Configuração de login: feita pelo usuário no painel
O conector do Supabase não altera as configurações de Authentication. O **usuário** faz isto em
Supabase → Authentication:
1. **URL Configuration:** Site URL = `https://sistema.saotomeexpresso.com`; em Redirect URLs, adicionar
   `https://sistema.saotomeexpresso.com/**`.
2. **Emails → Invite user:** trocar o link do modelo por
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/primeiro-acesso`
3. **Emails → Reset Password:** trocar o link por
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/primeiro-acesso`
4. **API Keys:** gerar uma nova secret key, trocar em `.env.local` e na Vercel, e depois revogar a antiga.

---

## Registro

| Tarefa | Antes | Depois | Observações |
|---|---|---|---|
| S1 | `false` | `tabela=true`, `gatilho=1`, `permissao=1` | Aplicada a migração `20260923000020_descontos_editaveis.sql` com o nome `descontos_editaveis`. Ambas as checagens corresponderam ao esperado. |
| S2 | 2 horários ativos: `0734375c-43cd-5799-92bc-7cd86b8cff12` (00:56:11 UTC) e `3b3de93a-28df-5d43-afe2-220fdde2441c` (01:44:37 UTC); ambos quarta, 03:00 | 1 horário ativo: `0734375c-43cd-5799-92bc-7cd86b8cff12`; viagens futuras duplicadas: nenhuma (`[]`) | Desativado somente `3b3de93a-28df-5d43-afe2-220fdde2441c`; nenhuma linha apagada. |
| S3 | Tipos e definições lidas do projeto remoto `eoeoconepbwrjxjsymug` | Tipos gravados; RPCs atualizadas; `npx tsc --noEmit` saiu com código 0 e sem erros | Confirmados `criar_pedido_site`, `criar_pedido_balcao`, `pedido_publico`, `rastrear_encomenda`, `validar_embarque`, `calendario_viagens` e `descontos_historico` nos tipos gerados. `20260923000004_rpc_publicas.sql` recebeu as cinco definições reais (`assentos_ocupados`, `buscar_viagens`, `criar_pedido_site`, `pedido_publico`, `rastrear_encomenda`), preservando os grants. A declaração de tipo Oracle local foi substituída por tipo composto PostgreSQL idempotente. Arquivos: `src/lib/supabase/database.types.ts` e `supabase/migrations/20260923000004_rpc_publicas.sql`. |
| S4 | Avisos consultados em 24/09/2026 às 12:09 UTC | Segurança: 5 lints, 34 achados no total. Desempenho: 3 lints, 44 achados no total. | **Segurança:** `security_definer_view` ERROR (1): `public.empresa_publica`. [Aviso](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view). `extension_in_public` WARN (1): extensão `btree_gist` no schema `public`. [Aviso](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public). `anon_security_definer_function_executable` WARN (15): `alterar_status_viagem`, `alternar_vendas_viagem`, `assentos_ocupados`, `avancar_encomenda`, `buscar_viagens`, `calendario_viagens`, `cancelar_pedido`, `confirmar_pagamento`, `criar_encomenda`, `criar_pedido_balcao`, `criar_pedido_site`, `pedido_publico`, `rastrear_encomenda`, `resumo_financeiro`, `validar_embarque`. [Aviso](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). `authenticated_security_definer_function_executable` WARN (16): `alterar_status_viagem`, `alternar_vendas_viagem`, `assentos_ocupados`, `atualizar_onboarding`, `avancar_encomenda`, `buscar_viagens`, `calendario_viagens`, `cancelar_pedido`, `confirmar_pagamento`, `criar_encomenda`, `criar_pedido_balcao`, `criar_pedido_site`, `pedido_publico`, `rastrear_encomenda`, `resumo_financeiro`, `validar_embarque`. [Aviso](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). `auth_leaked_password_protection` WARN (1): proteção contra senhas vazadas desativada. [Aviso](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). **Desempenho:** `unindexed_foreign_keys` INFO (15): `assentos_comodo_id_fkey`, `caixa_movimentos_caixa_id_fkey`, `cancelamentos_empresa_id_fkey`, `cancelamentos_pedido_id_fkey`, `cancelamentos_usuario_id_fkey`, `comodos_embarcacao_id_fkey`, `comodos_empresa_id_fkey`, `convenios_empresa_id_fkey`, `descontos_historico_alterado_por_fkey`, `festivais_cidade_id_fkey`, `festivais_empresa_id_fkey`, `passagens_convenio_id_fkey`, `tripulantes_embarcacao_id_fkey`, `tripulantes_empresa_id_fkey`, `viagem_tripulantes_tripulante_id_fkey`. [Aviso](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). `unused_index` INFO (23): `idx_passagens_viagem_status`, `idx_pedidos_empresa_status`, `idx_viagens_empresa_status`, `idx_viagens_calendario_publico`, `idx_descontos_historico_tipo`, `idx_portos_cidade_id`, `idx_agencias_cidade_id`, `idx_perfis_agencia_id`, `idx_paradas_linha_porto_id`, `idx_tarifas_trecho_origem_parada_id`, `idx_tarifas_trecho_destino_parada_id`, `idx_caixa_sessoes_usuario_id`, `idx_pedidos_cliente_id`, `idx_pedidos_vendedor_id`, `idx_pedidos_expira_em`, `idx_passagens_assento_id`, `idx_passagens_documento`, `idx_passagens_validado_por_id`, `idx_pagamentos_caixa_id`, `idx_encomendas_origem_cidade_id`, `idx_encomendas_destino_cidade_id`, `idx_encomenda_eventos_encomenda_id`, `idx_encomenda_eventos_usuario_id`. [Aviso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). `multiple_permissive_policies` WARN (6 tabelas): `caixa_sessoes` (SELECT: `caixa_sessoes_select_gerente_admin`, `caixa_sessoes_select_vendedor`), `pagamentos` (SELECT: `pagamentos_select_gerente_admin`, `pagamentos_select_vendedor`), `passagens` (SELECT: `passagens_select_conferente`, `passagens_select_gerente_admin`, `passagens_select_vendedor`), `pedidos` (SELECT: `pedidos_select_gerente_admin`, `pedidos_select_vendedor`), `perfis` (SELECT: `perfis_select_empresa`, `perfis_select_proprio`; UPDATE: `perfis_update_admin`, `perfis_update_proprio_onboarding`). [Aviso](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies). Nenhuma recomendação de segurança ou desempenho foi aplicada. |
