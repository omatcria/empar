-- Teste da migração 33 (push/vencimentos). Roda numa transação desfeita (rollback).
-- Sucesso = erro final 'PUSH_SQL_OK'; qualquer outra mensagem é falha.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
 ('c1a00000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'push-a@example.invalid', '{}', '{}', now(), now()),
 ('c1a00000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'push-b@example.invalid', '{}', '{}', now(), now());
select set_config('request.jwt.claim.sub', 'c1a00000-0000-4000-8000-00000000000a', true);

do $$
declare
  ua constant uuid := 'c1a00000-0000-4000-8000-00000000000a';
  ub constant uuid := 'c1a00000-0000-4000-8000-00000000000b';
  ws uuid; acc uuid; cat uuid; card uuid; inv uuid; inv2 uuid; inv3 uuid; debt uuid;
  ret integer; n integer; t text; c text;
begin
  select id into ws from public.workspaces where owner_id = ua;
  if ws is null then raise exception 'workspace de A inexistente'; end if;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, ub, 'editor')
    on conflict do nothing;
  -- sem preferência = permitido
  delete from public.notification_prefs where user_id = ub;

  insert into public.categories (user_id, workspace_id, nome, contexto, tipo)
    values (ua, ws, 'Teste push', 'PESSOAL', 'DESPESA') returning id into cat;
  insert into public.accounts (user_id, workspace_id, nome, contexto, tipo)
    values (ua, ws, 'Conta teste', 'PESSOAL', 'conta_corrente') returning id into acc;
  insert into public.cards (user_id, workspace_id, nome, contexto, dia_fechamento, dia_vencimento)
    values (ua, ws, 'Nubank', 'PESSOAL', 20, 25) returning id into card;
  insert into public.invoices (user_id, workspace_id, card_id, mes_referencia, data_fechamento, data_vencimento)
    values (ua, ws, card, '2026-11', '2026-11-20', '2026-11-25') returning id into inv;
  insert into public.transactions (user_id, workspace_id, contexto, tipo, card_id, invoice_id, category_id, valor_centavos, data, descricao)
    values (ua, ws, 'PESSOAL', 'DESPESA', card, inv, cat, 15000, '2026-11-10', 'Compra');
  -- fatura em D+2: não deve gerar
  insert into public.invoices (user_id, workspace_id, card_id, mes_referencia, data_fechamento, data_vencimento)
    values (ua, ws, card, '2026-12', '2026-11-19', '2026-11-24') returning id into inv2;
  insert into public.transactions (user_id, workspace_id, contexto, tipo, card_id, invoice_id, category_id, valor_centavos, data, descricao)
    values (ua, ws, 'PESSOAL', 'DESPESA', card, inv2, cat, 1000, '2026-11-10', 'Outra');
  -- conta pendente D+1
  insert into public.transactions (user_id, workspace_id, contexto, tipo, account_id, category_id, valor_centavos, data, descricao, pago)
    values (ua, ws, 'PESSOAL', 'DESPESA', acc, cat, 150000, '2026-11-23', 'Aluguel', false);
  -- recorrência hoje
  insert into public.recurrences (user_id, workspace_id, contexto, template, frequencia, dia, ativo, proxima_data)
    values (ua, ws, 'PESSOAL', jsonb_build_object('tipo','DESPESA','descricao','Internet','valor_centavos',9990,'category_id',cat), 'mensal', 22, true, '2026-11-22');
  -- dívida
  insert into public.debts (workspace_id, user_id, credor) values (ws, ua, 'Empréstimo') returning id into debt;
  insert into public.debt_installments (workspace_id, user_id, debt_id, numero, valor_centavos, vencimento, pago)
    values (ws, ua, debt, 1, 50000, '2026-10-25', true), (ws, ua, debt, 2, 50000, '2026-11-25', false);

  if public.fmt_brl(123456) <> 'R$ 1.234,56' then raise exception 'fmt_brl: %', public.fmt_brl(123456); end if;

  ret := public.generate_due_notifications('2026-11-22');
  select count(*) into n from public.notifications where workspace_id = ws and tipo like 'venc\_%';
  if n <> 8 then raise exception 'esperava 8 avisos no espaço, veio %', n; end if;
  if ret < 8 then raise exception 'retorno menor que 8: %', ret; end if;
  select count(*) into n from public.notifications where workspace_id = ws and user_id = ua;
  if n <> 4 then raise exception 'A deveria ter 4, tem %', n; end if;
  select count(*) into n from public.notifications where workspace_id = ws and user_id = ub;
  if n <> 4 then raise exception 'B deveria ter 4, tem %', n; end if;

  select titulo, corpo into t, c from public.notifications where user_id = ub and tipo='venc_fatura' and workspace_id = ws;
  if t <> 'Fatura do Nubank vence em 3 dias' then raise exception 'titulo fatura: %', t; end if;
  if c <> 'R$ 150,00 · vencimento 25/11' then raise exception 'corpo fatura: %', c; end if;
  select titulo into t from public.notifications where user_id = ub and tipo='venc_conta' and workspace_id = ws;
  if t <> 'Aluguel vence amanhã' then raise exception 'titulo conta: %', t; end if;
  select titulo, corpo into t, c from public.notifications where user_id = ub and tipo='venc_recorrencia' and workspace_id = ws;
  if t <> 'Internet vence hoje' then raise exception 'titulo rec: %', t; end if;
  if c <> 'R$ 99,90 · recorrência mensal' then raise exception 'corpo rec: %', c; end if;
  select titulo into t from public.notifications where user_id = ub and tipo='venc_divida' and workspace_id = ws;
  if t <> 'Parcela 2 de Empréstimo vence em 3 dias' then raise exception 'titulo divida: %', t; end if;

  -- idempotência
  ret := public.generate_due_notifications('2026-11-22');
  if ret <> 0 then raise exception 'segunda execução deveria ser 0, foi %', ret; end if;

  -- preferência desligada para A: nova fatura em D+3 gera só para B
  update public.notification_prefs set venc_faturas = false where user_id = ua;
  insert into public.invoices (user_id, workspace_id, card_id, mes_referencia, data_fechamento, data_vencimento)
    values (ua, ws, card, '2027-01', '2026-11-19', '2026-11-25') returning id into inv3;
  insert into public.transactions (user_id, workspace_id, contexto, tipo, card_id, invoice_id, category_id, valor_centavos, data, descricao)
    values (ua, ws, 'PESSOAL', 'DESPESA', card, inv3, cat, 2000, '2026-11-10', 'Terceira');
  perform public.generate_due_notifications('2026-11-22');
  select count(*) into n from public.notifications where user_id = ua and dedupe_key = 'venc_fatura:' || inv3 || ':3';
  if n <> 0 then raise exception 'A (pref desligada) recebeu fatura'; end if;
  select count(*) into n from public.notifications where user_id = ub and dedupe_key = 'venc_fatura:' || inv3 || ':3';
  if n <> 1 then raise exception 'B deveria receber a nova fatura'; end if;

  -- tudo desligado para A: teste passa; duplicata de dedupe_key é descartada sem erro
  update public.notification_prefs set venc_faturas=false, venc_contas=false, venc_recorrencias=false, venc_dividas=false,
    membros_lancamentos=false, membros_desejos=false, reacoes=false, orcamento_80=false, mei_alertas=false, wishlist_precos=false
    where user_id = ua;
  insert into public.notifications (workspace_id, user_id, tipo, titulo, corpo, meta)
    values (ws, ua, 'teste', 'Notificações ativadas', 'Este é um teste do Empar.', '{"dedupe_key":"k1"}');
  insert into public.notifications (workspace_id, user_id, tipo, titulo, corpo, meta)
    values (ws, ua, 'teste', 'Notificações ativadas', 'Este é um teste do Empar.', '{"dedupe_key":"k1"}');
  select count(*) into n from public.notifications where user_id = ua and dedupe_key = 'k1';
  if n <> 1 then raise exception 'teste/dedupe: esperava 1, veio %', n; end if;
  insert into public.notifications (workspace_id, user_id, tipo, titulo, corpo)
    values (ws, ua, 'reaction', 'x', 'y');
  select count(*) into n from public.notifications where user_id = ua and tipo = 'reaction';
  if n <> 0 then raise exception 'reaction com pref desligada deveria ser filtrada'; end if;

  if not exists (select 1 from cron.job where jobname='notificacoes-vencimento-diario' and schedule='0 12 * * *') then
    raise exception 'job de cron ausente';
  end if;
  raise exception 'PUSH_SQL_OK';
end $$;
rollback;
