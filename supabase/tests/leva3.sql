-- =============================================================================
-- Testes SQL da leva 3 — RLS das tabelas novas, seed_workspace_defaults /
-- handle_new_user e reset_workspace_data.
--
-- Rodar:   scripts/supabase/sbq.sh -f supabase/tests/leva3.sql
--
-- Tudo acontece dentro de UM bloco DO (uma única transação) que SEMPRE termina
-- com `raise exception 'LEVA3_RESULT {json}'`. O erro força ROLLBACK TOTAL:
-- nada é persistido — nem o espaço temporário, nem o usuário fictício em
-- auth.users, nem a alteração de profiles.onboarding_completo do dono real.
-- A API devolve HTTP 400 com a mensagem; sucesso = "ok": true no JSON
-- (todas as asserções booleanas verdadeiras).
-- =============================================================================
do $leva3$
declare
  r     jsonb := '{}'::jsonb;  -- asserções (todas devem ser true)
  info  jsonb := '{}'::jsonb;  -- contagens para diagnóstico
  n     bigint;
  t     text;
  okf   boolean;

  -- Impressão digital do seed criado pelo handle_new_user ORIGINAL (capturada
  -- antes da migração 27, num usuário fictício revertido). Garante que o seed
  -- extraído para seed_workspace_defaults é idêntico (nomes, ícones, cores,
  -- chaves, envelopes, metas e user_id).
  _golden constant text := '42a0ce7bb88f674257fcf25b418bd005';

  _owner     uuid;                         -- dono real (primeiro espaço)
  _stranger  uuid := gen_random_uuid();    -- não é membro de nada
  _editor    uuid := gen_random_uuid();    -- usuário fictício (auth.users), editor do espaço temporário
  _editor_ws uuid;
  _ws        uuid;                         -- espaço temporário do teste
  _acc uuid; _card uuid; _inv uuid; _cat_pai uuid; _cat_filha uuid; _rec uuid; _tx uuid;
  _invest uuid; _debt uuid; _wcat uuid; _wcat2 uuid; _witem uuid; _witem2 uuid;
  _onboarding_antes boolean;
  _outros_antes jsonb := '{}'::jsonb;
  _outros_depois jsonb := '{}'::jsonb;
  _prefs_antes bigint;

  _new_tables text[] := array['debts', 'debt_installments', 'wishlist_categories',
                              'wishlist_items', 'wishlist_price_history'];
  -- Tudo que o reset apaga (por workspace_id).
  _data_tables text[] := array['accounts', 'cards', 'invoices', 'transactions', 'recurrences',
                               'budgets', 'investments', 'investment_movements', 'debts',
                               'debt_installments', 'wishlist_categories', 'wishlist_items',
                               'wishlist_price_history', 'notifications', 'activity_log',
                               'transaction_reactions'];
begin
  -- Impressão digital (categorias + envelopes + metas) de um espaço; mesmo
  -- formato usado para calcular _golden. Função temporária, desfeita no rollback.
  create function pg_temp.leva3_fp(_w uuid, _u uuid) returns text
  language sql stable as $fp$
    select md5(
         coalesce((select string_agg(concat_ws('|', nome, contexto, tipo, icone, cor, sistema, coalesce(chave, '-'),
                                               categoria_pai_id is null, user_id = _u), ';'
                                     order by contexto, tipo, sistema, nome, chave)
                   from public.categories where workspace_id = _w), '')
      || '#' || coalesce((select string_agg(concat_ws('|', nome, percentual, ativo, saldo_provisionado_centavos,
                                                      user_id = _u), ';' order by nome)
                   from public.tax_provisions where workspace_id = _w), '')
      || '#' || coalesce((select string_agg(concat_ws('|', contexto, nome, valor_alvo_centavos, valor_atual_centavos,
                                                      preset, prazo is null, user_id = _u), ';' order by nome)
                   from public.goals where workspace_id = _w), ''));
  $fp$;

  select owner_id into strict _owner from public.workspaces order by created_at limit 1;
  select onboarding_completo into strict _onboarding_antes from public.profiles where id = _owner;

  -- ---------------------------------------------------------------------------
  -- 1) Estrutura
  -- ---------------------------------------------------------------------------
  r := r || jsonb_build_object(
    'rls_ligada_tabelas_novas',
      (select count(*) from pg_class c
        where c.relnamespace = 'public'::regnamespace and c.relname = any(_new_tables) and c.relrowsecurity) = 5,
    'triggers_updated_at',
      (select count(*) from pg_trigger
        where not tgisinternal and tgfoid = 'public.set_updated_at'::regproc
          and tgrelid in ('public.debts'::regclass, 'public.wishlist_items'::regclass)) = 2,
    'funcoes_security_definer',
      (select count(*) from pg_proc
        where pronamespace = 'public'::regnamespace and prosecdef
          and proname in ('seed_workspace_defaults', 'reset_workspace_data')
          and proconfig @> array['search_path=public']) = 2,
    'execute_reset_so_authenticated',
      has_function_privilege('authenticated', 'public.reset_workspace_data(uuid)', 'execute')
      and not has_function_privilege('anon', 'public.reset_workspace_data(uuid)', 'execute'),
    'execute_seed_revogado',
      not has_function_privilege('anon', 'public.seed_workspace_defaults(uuid, uuid)', 'execute')
      and not has_function_privilege('authenticated', 'public.seed_workspace_defaults(uuid, uuid)', 'execute')
  );

  -- ---------------------------------------------------------------------------
  -- 2) handle_new_user continua semeando igual (usuário fictício em auth.users)
  -- ---------------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  values (_editor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'leva3-teste-' || _editor || '@example.invalid', jsonb_build_object('nome', 'Teste Leva3'),
          '{}'::jsonb, now(), now());
  select id into strict _editor_ws from public.workspaces where owner_id = _editor;

  r := r || jsonb_build_object(
    'novo_usuario_perfil_e_espaco',
      exists(select 1 from public.profiles where id = _editor and active_workspace_id = _editor_ws and not onboarding_completo),
    'novo_usuario_membro_dono',
      exists(select 1 from public.workspace_members
              where workspace_id = _editor_ws and user_id = _editor and role = 'owner' and status = 'active'),
    'novo_usuario_prefs_padrao',
      exists(select 1 from public.notification_prefs where user_id = _editor and mei_alertas and wishlist_precos),
    'novo_usuario_mei_padrao',
      exists(select 1 from public.workspaces
              where id = _editor_ws and mei_ativo and mei_limite_anual_centavos = 8100000 and mei_abertura is null),
    'novo_usuario_seed_identico', pg_temp.leva3_fp(_editor_ws, _editor) = _golden
  );

  -- ---------------------------------------------------------------------------
  -- 3) Espaço temporário do dono real (+ o usuário fictício como editor)
  -- ---------------------------------------------------------------------------
  insert into public.workspaces (nome, owner_id) values ('[TESTE leva3] espaço temporário', _owner)
  returning id into _ws;
  insert into public.workspace_members (workspace_id, user_id, role, status) values
    (_ws, _owner, 'owner', 'active'),
    (_ws, _editor, 'editor', 'active');
  insert into public.workspace_invites (workspace_id, token, created_by)
  values (_ws, 'leva3-teste-' || _ws, _owner);

  -- Como o dono (RLS ativa): popula todas as tabelas que o reset apaga.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', _owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  update public.workspaces set mei_limite_anual_centavos = 5000000, mei_abertura = date '2026-03-01' where id = _ws;
  update public.profiles set onboarding_completo = true where id = _owner;

  insert into public.accounts (user_id, workspace_id, nome, contexto, tipo)
  values (_owner, _ws, '[TESTE] Conta', 'PESSOAL', 'conta_corrente') returning id into _acc;
  insert into public.cards (user_id, workspace_id, nome, contexto, dia_fechamento, dia_vencimento, account_pagamento_id)
  values (_owner, _ws, '[TESTE] Cartão', 'PESSOAL', 5, 12, _acc) returning id into _card;
  insert into public.invoices (user_id, workspace_id, card_id, mes_referencia, data_fechamento, data_vencimento, paga, paid_account_id)
  values (_owner, _ws, _card, '2026-11', '2026-11-05', '2026-11-12', true, _acc) returning id into _inv;
  insert into public.categories (user_id, workspace_id, nome, contexto, tipo)
  values (_owner, _ws, '[TESTE] Pai', 'PESSOAL', 'DESPESA') returning id into _cat_pai;
  insert into public.categories (user_id, workspace_id, nome, contexto, tipo, categoria_pai_id)
  values (_owner, _ws, '[TESTE] Filha', 'PESSOAL', 'DESPESA', _cat_pai) returning id into _cat_filha;
  insert into public.recurrences (user_id, workspace_id, contexto, template, frequencia, dia, proxima_data)
  values (_owner, _ws, 'PESSOAL', '{}'::jsonb, 'mensal', 10, '2026-12-10') returning id into _rec;
  insert into public.transactions (user_id, workspace_id, contexto, tipo, account_id, category_id, valor_centavos, data, recorrencia_id)
  values (_owner, _ws, 'PESSOAL', 'DESPESA', _acc, _cat_filha, 1000, '2026-11-20', _rec) returning id into _tx;
  insert into public.transactions (user_id, workspace_id, contexto, tipo, card_id, invoice_id, category_id, valor_centavos, data)
  values (_owner, _ws, 'PESSOAL', 'DESPESA', _card, _inv, _cat_filha, 2000, '2026-11-20');
  insert into public.transaction_reactions (transaction_id, user_id, workspace_id, emoji) values (_tx, _owner, _ws, 'like');
  insert into public.budgets (user_id, workspace_id, contexto, category_id, mes_referencia, limite_centavos)
  values (_owner, _ws, 'PESSOAL', _cat_filha, '2026-11', 50000);
  insert into public.goals (user_id, workspace_id, contexto, nome, valor_alvo_centavos)
  values (_owner, _ws, 'PESSOAL', '[TESTE] Meta', 100000);
  insert into public.tax_provisions (user_id, workspace_id, nome, percentual)
  values (_owner, _ws, '[TESTE] Envelope', 5);
  insert into public.investments (user_id, workspace_id, nome) values (_owner, _ws, '[TESTE] CDB') returning id into _invest;
  insert into public.investment_movements (user_id, workspace_id, investment_id, valor_centavos, account_id)
  values (_owner, _ws, _invest, 10000, _acc);
  insert into public.notifications (workspace_id, user_id, tipo, titulo, corpo)
  values (_ws, _owner, 'teste', '[TESTE]', '[TESTE]');
  insert into public.activity_log (workspace_id, user_id, entity, action, entity_id)
  values (_ws, _owner, 'transaction', 'create', _tx);

  -- Tabelas novas (defaults conferidos abaixo).
  insert into public.debts (user_id, workspace_id, credor, valor_original_centavos, valor_acordo_centavos, data_acordo)
  values (_owner, _ws, '[TESTE] Credor', 300000, 120000, '2026-11-01') returning id into _debt;
  insert into public.debt_installments (user_id, workspace_id, debt_id, numero, valor_centavos, vencimento) values
    (_owner, _ws, _debt, 1, 60000, '2026-12-10'),
    (_owner, _ws, _debt, 2, 60000, '2027-01-10');
  insert into public.wishlist_categories (user_id, workspace_id, nome) values (_owner, _ws, '[TESTE] Casa')
  returning id into _wcat;
  insert into public.wishlist_categories (user_id, workspace_id, nome) values (_owner, _ws, '[TESTE] Apagar')
  returning id into _wcat2;
  insert into public.wishlist_items (user_id, workspace_id, category_id, url, titulo,
                                     preco_atual_centavos, preco_inicial_centavos, preco_minimo_centavos)
  values (_owner, _ws, _wcat, 'https://example.com/p/1', '[TESTE] Produto', 9990, 9990, 9990)
  returning id into _witem;
  insert into public.wishlist_items (user_id, workspace_id, category_id, url, titulo)
  values (_owner, _ws, _wcat2, 'https://example.com/p/2', '[TESTE] Produto 2') returning id into _witem2;
  insert into public.wishlist_price_history (workspace_id, item_id, preco_centavos) values (_ws, _witem, 9990);

  r := r || jsonb_build_object(
    'dono_le_tabelas_novas',
      (select count(*) from public.debts where workspace_id = _ws) = 1
      and (select count(*) from public.debt_installments where workspace_id = _ws) = 2
      and (select count(*) from public.wishlist_categories where workspace_id = _ws) = 2
      and (select count(*) from public.wishlist_items where workspace_id = _ws) = 2
      and (select count(*) from public.wishlist_price_history where workspace_id = _ws) = 1,
    'defaults_dividas',
      exists(select 1 from public.debts where id = _debt and contexto = 'PESSOAL' and origem = 'Serasa Limpa Nome')
      and not exists(select 1 from public.debt_installments where debt_id = _debt and (pago or pago_em is not null)),
    'defaults_desejos',
      exists(select 1 from public.wishlist_items where id = _witem and monitorar and not comprado and comprado_em is null)
      and exists(select 1 from public.wishlist_price_history where item_id = _witem and verificado_em is not null)
  );

  -- unique(debt_id, numero)
  begin
    insert into public.debt_installments (user_id, workspace_id, debt_id, numero, valor_centavos, vencimento)
    values (_owner, _ws, _debt, 1, 1, '2027-02-10');
    r := r || '{"parcela_numero_unico": false}';
  exception when unique_violation then
    r := r || '{"parcela_numero_unico": true}';
  end;

  -- Excluir categoria de desejo → item fica sem categoria (on delete set null).
  delete from public.wishlist_categories where id = _wcat2;
  r := r || jsonb_build_object('categoria_desejo_set_null',
    exists(select 1 from public.wishlist_items where id = _witem2 and category_id is null));

  -- ---------------------------------------------------------------------------
  -- 4) anon: não lê nem escreve nas tabelas novas e não executa o reset
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  okf := true;
  foreach t in array _new_tables loop
    begin
      execute format('select count(*) from public.%I', t) into n;
    exception when insufficient_privilege then
      n := 0;  -- sem privilégio também é "0 linhas legíveis"
    end;
    info := info || jsonb_build_object('anon_le_' || t, n);
    okf := okf and n = 0;
  end loop;
  r := r || jsonb_build_object('anon_le_0_linhas', okf);

  begin
    insert into public.debts (user_id, workspace_id, credor, valor_acordo_centavos)
    values (_owner, _ws, '[TESTE] anon', 1);
    r := r || '{"anon_nao_insere": false}';
  exception when insufficient_privilege then
    r := r || '{"anon_nao_insere": true}';
  end;

  -- (a própria função também usa 42501 para "não é dono"; aqui exigimos a
  -- recusa por falta de EXECUTE, antes de entrar no corpo)
  begin
    perform public.reset_workspace_data(_ws);
    r := r || '{"anon_sem_execute_reset": false}';
  exception when insufficient_privilege then
    r := r || jsonb_build_object('anon_sem_execute_reset', sqlerrm like 'permission denied for function%');
  end;

  -- ---------------------------------------------------------------------------
  -- 5) Quem não é dono não reseta (não-membro e editor); seed não é RPC
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', jsonb_build_object('sub', _stranger, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.debts where workspace_id = _ws;
  r := r || jsonb_build_object('nao_membro_nao_le', n = 0);

  begin
    perform public.reset_workspace_data(_ws);
    r := r || '{"nao_membro_bloqueado": false}';
  exception when others then
    r := r || jsonb_build_object('nao_membro_bloqueado', sqlerrm = 'Apenas o dono do espaço pode resetar os dados');
    info := info || jsonb_build_object('erro_nao_membro', sqlerrm);
  end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', _editor, 'role', 'authenticated')::text, true);
  begin
    perform public.reset_workspace_data(_ws);
    r := r || '{"editor_bloqueado": false}';
  exception when others then
    r := r || jsonb_build_object('editor_bloqueado', sqlerrm = 'Apenas o dono do espaço pode resetar os dados');
  end;

  begin
    perform public.seed_workspace_defaults(_ws, _editor);
    r := r || '{"seed_nao_e_rpc": false}';
  exception when insufficient_privilege then
    r := r || '{"seed_nao_e_rpc": true}';
  end;

  execute 'set local role none';
  r := r || jsonb_build_object('dados_intactos_apos_tentativas',
    (select count(*) from public.accounts where workspace_id = _ws) = 1
    and (select count(*) from public.debts where workspace_id = _ws) = 1);

  -- Fotografia dos OUTROS espaços (dados reais) antes do reset.
  foreach t in array _data_tables || array['categories', 'tax_provisions', 'goals', 'workspace_members', 'workspace_invites'] loop
    execute format('select count(*) from public.%I where workspace_id not in ($1, $2)', t) into n using _ws, _editor_ws;
    _outros_antes := _outros_antes || jsonb_build_object(t, n);
  end loop;
  select count(*) into _prefs_antes from public.notification_prefs;

  -- ---------------------------------------------------------------------------
  -- 6) Dono reseta
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', jsonb_build_object('sub', _owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.reset_workspace_data(_ws);
  execute 'set local role none';  -- volta ao papel da sessão para contar sem RLS

  okf := true;
  foreach t in array _data_tables loop
    execute format('select count(*) from public.%I where workspace_id = $1', t) into n using _ws;
    info := info || jsonb_build_object('apos_reset_' || t, n);
    okf := okf and n = 0;
  end loop;
  r := r || jsonb_build_object('reset_apaga_dados', okf);

  foreach t in array _data_tables || array['categories', 'tax_provisions', 'goals', 'workspace_members', 'workspace_invites'] loop
    execute format('select count(*) from public.%I where workspace_id not in ($1, $2)', t) into n using _ws, _editor_ws;
    _outros_depois := _outros_depois || jsonb_build_object(t, n);
  end loop;

  r := r || jsonb_build_object(
    'reset_categorias_25',            (select count(*) from public.categories where workspace_id = _ws) = 25,
    'reset_categorias_sistema_5',     (select count(*) from public.categories where workspace_id = _ws and sistema and chave is not null) = 5,
    'reset_categorias_pessoal_11',    (select count(*) from public.categories where workspace_id = _ws and not sistema and contexto = 'PESSOAL') = 11,
    'reset_categorias_empresarial_9', (select count(*) from public.categories where workspace_id = _ws and not sistema and contexto = 'EMPRESARIAL') = 9,
    'reset_envelopes_4',              (select count(*) from public.tax_provisions where workspace_id = _ws) = 4,
    'reset_metas_2',                  (select count(*) from public.goals where workspace_id = _ws) = 2,
    'reset_seed_identico',            pg_temp.leva3_fp(_ws, _owner) = _golden,
    'reset_onboarding_false',         (select not onboarding_completo from public.profiles where id = _owner),
    'reset_mantem_espaco_e_mei',
      exists(select 1 from public.workspaces
              where id = _ws and mei_ativo and mei_limite_anual_centavos = 5000000 and mei_abertura = date '2026-03-01'),
    'reset_mantem_membros_e_convites',
      (select count(*) from public.workspace_members where workspace_id = _ws) = 2
      and (select count(*) from public.workspace_invites where workspace_id = _ws) = 1,
    'reset_mantem_prefs',             (select count(*) from public.notification_prefs) = _prefs_antes,
    'outros_espacos_intactos',        _outros_antes = _outros_depois
  );
  info := info || jsonb_build_object('outros_espacos', _outros_depois,
                                     'onboarding_dono_antes_do_teste', _onboarding_antes);

  select bool_and(value = 'true'::jsonb) into okf from jsonb_each(r);
  raise exception 'LEVA3_RESULT %', jsonb_build_object('ok', okf, 'assercoes', r, 'info', info)::text;
end
$leva3$;
