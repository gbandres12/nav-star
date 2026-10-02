-- Data de nascimento (opcional) do passageiro nas vendas do site e do balcão.
-- A coluna passagens.nascimento já existia, mas private.criar_pedido nunca a preenchia.
-- Mesmo método das migrações anteriores: reescreve a função em uso e falha, sem gravar nada, se ela não estiver na versão esperada.
do $migracao$
declare
  v_def text;
  v_novo text;
begin
  v_def := pg_get_functiondef('private.criar_pedido(jsonb, public.canal_venda, uuid, uuid, boolean)'::regprocedure);
  v_novo := v_def;

  -- 1. variável
  v_novo := replace(v_novo, E'  v_p_telefone text;\n', E'  v_p_telefone text;\n  v_p_nascimento date;\n');

  -- 2. leitura e validação do campo, logo após o telefone do passageiro
  v_novo := replace(v_novo,
    E'    v_p_telefone := nullif(trim(coalesce(v_p->>''telefone'', '''')), '''');\n',
    E'    v_p_telefone := nullif(trim(coalesce(v_p->>''telefone'', '''')), '''');\n'
    || E'    begin\n'
    || E'      v_p_nascimento := nullif(trim(coalesce(v_p->>''nascimento'', '''')), '''')::date;\n'
    || E'    exception when others then\n'
    || E'      raise exception using errcode = ''P0001'', message = ''Data de nascimento inválida.'';\n'
    || E'    end;\n'
    || E'    if v_p_nascimento is not null and (v_p_nascimento > current_date or v_p_nascimento < date ''1900-01-01'') then\n'
    || E'      raise exception using errcode = ''P0001'', message = ''Data de nascimento inválida.'';\n'
    || E'    end if;\n');

  -- 3. item do passageiro
  v_novo := replace(v_novo, '''telefone'', v_p_telefone,', '''telefone'', v_p_telefone,' || E'\n      ''nascimento'', v_p_nascimento,');

  -- 4. gravação em passagens (colunas e valores na mesma posição)
  v_novo := replace(v_novo, 'nome, documento, telefone, tipo, valor,', 'nome, documento, nascimento, telefone, tipo, valor,');
  v_novo := replace(v_novo, 'v_item_jsonb->>''telefone'',', 'nullif(v_item_jsonb->>''nascimento'', '''')::timestamptz,' || E'\n        v_item_jsonb->>''telefone'',');

  -- cada trecho precisa ter entrado, e a função não pode já ter o campo
  if position('v_p_nascimento date;' in v_def) > 0
     or position('v_p_nascimento date;' in v_novo) = 0
     or position('nullif(trim(coalesce(v_p->>''nascimento''' in v_novo) = 0
     or position('''nascimento'', v_p_nascimento,' in v_novo) = 0
     or position('nome, documento, nascimento, telefone, tipo, valor,' in v_novo) = 0
     or position('nullif(v_item_jsonb->>''nascimento''' in v_novo) = 0 then
    raise exception 'criar_pedido não está na versão esperada; ajuste a migração (nada foi alterado).';
  end if;

  execute v_novo;
end
$migracao$;
