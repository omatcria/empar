-- Teste da migração 34 (endurecimento do push). Transação desfeita (rollback).
-- Sucesso = erro final 'PUSH_HARDENING_OK'; qualquer outra mensagem é falha.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
 ('c1b00000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hard-a@example.invalid', '{}', '{}', now(), now()),
 ('c1b00000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hard-b@example.invalid', '{}', '{}', now(), now());
select set_config('request.jwt.claim.sub', 'c1b00000-0000-4000-8000-00000000000a', true);

do $$
declare
  ua constant uuid := 'c1b00000-0000-4000-8000-00000000000a';
  ub constant uuid := 'c1b00000-0000-4000-8000-00000000000b';
  ws uuid; n integer;
begin
  select id into ws from public.workspaces where owner_id = ua;
  if ws is null then raise exception 'workspace de A inexistente'; end if;
  delete from public.notification_prefs where user_id in (ua, ub);

  -- B não é membro: descartada
  insert into public.notifications (workspace_id, user_id, tipo, titulo, corpo)
    values (ws, ub, 'teste', 'x', 'y');
  select count(*) into n from public.notifications where user_id = ub;
  if n <> 0 then raise exception 'destinatário fora do espaço deveria ser descartado, veio %', n; end if;

  -- membro: teste passa
  insert into public.notifications (workspace_id, user_id, tipo, titulo, corpo)
    values (ws, ua, 'teste', 'x', 'y');
  select count(*) into n from public.notifications where user_id = ua and tipo = 'teste';
  if n <> 1 then raise exception 'teste para membro deveria passar, veio %', n; end if;

  -- venc_conta inserido como cliente (role authenticated): descartado
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  insert into public.notifications (workspace_id, user_id, tipo, titulo, corpo, meta)
    values (ws, ua, 'venc_conta', 'x', 'y', '{"dedupe_key":"hc1"}');
  select count(*) into n from public.notifications where user_id = ua and tipo = 'venc_conta';
  if n <> 0 then raise exception 'venc_conta de cliente deveria ser descartado, veio %', n; end if;

  -- como servidor/admin (sem role de cliente): passa
  perform set_config('request.jwt.claim.role', 'service_role', true);
  insert into public.notifications (workspace_id, user_id, tipo, titulo, corpo, meta)
    values (ws, ua, 'venc_conta', 'x', 'y', '{"dedupe_key":"hc2"}');
  select count(*) into n from public.notifications where user_id = ua and tipo = 'venc_conta';
  if n <> 1 then raise exception 'venc_conta do servidor deveria passar, veio %', n; end if;

  raise exception 'PUSH_HARDENING_OK';
end $$;
rollback;
