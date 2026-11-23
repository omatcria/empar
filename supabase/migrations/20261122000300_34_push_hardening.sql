-- Migração 34: endurecimento das notificações push.
-- Destinatário precisa ser membro do espaço; tipos de vencimento só nascem no servidor;
-- push só é disparado quando o usuário tem inscrição; vencimentos só para membros ativos.

-- 1) Gatilho BEFORE ------------------------------------------------------------------------
create or replace function public.notifications_filter()
returns trigger language plpgsql security definer set search_path = public as $$
declare col text; allowed text;
begin
  -- destinatário fora do espaço: descarta
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = new.workspace_id and user_id = new.user_id
  ) then
    return null;
  end if;
  -- tipos gerados só pelo servidor: clientes autenticados não podem inserir
  if new.tipo in ('venc_fatura', 'venc_conta', 'venc_recorrencia', 'venc_divida')
     and coalesce(auth.role(), '') = 'authenticated' then
    return null;
  end if;
  col := public.notification_pref_column(new.tipo);
  if col is not null then
    select to_jsonb(p)->>col into allowed from public.notification_prefs p where p.user_id = new.user_id;
    if allowed = 'false' then return null; end if;
  end if;
  if new.meta->>'dedupe_key' is not null and exists (
    select 1 from public.notifications n
    where n.user_id = new.user_id and n.dedupe_key = new.meta->>'dedupe_key'
  ) then
    return null;
  end if;
  return new;
end $$;

-- 2) Gatilho AFTER: só chama o send-push se o usuário tem inscrição -----------------------------
create or replace function public.notifications_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    return null;
  end if;
  begin
    perform net.http_post(
      url := 'https://gkzstunjcftvqoljgvce.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret')
      ),
      body := jsonb_build_object('notification_id', new.id),
      timeout_milliseconds := 10000
    );
  exception when others then
    null;
  end;
  return null;
end $$;

-- 3) Vencimentos: só membros ativos ---------------------------------------------------------------
create or replace function public.generate_due_notifications(
  _today date default (now() at time zone 'America/Sao_Paulo')::date
) returns integer language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  with due as (
    -- faturas
    select i.workspace_id, 'venc_fatura'::text as tipo,
           'Fatura do ' || c.nome as sujeito,
           public.fmt_brl(t.total) || ' · vencimento ' || to_char(i.data_vencimento, 'DD/MM') as corpo,
           'venc_fatura:' || i.id as base, (i.data_vencimento - _today) as dias
    from public.invoices i
    join public.cards c on c.id = i.card_id
    join lateral (select coalesce(sum(valor_centavos), 0)::bigint as total from public.transactions where invoice_id = i.id) t on true
    where not coalesce(i.paga, false) and t.total > 0 and (i.data_vencimento - _today) in (3, 1, 0)
    union all
    -- contas a pagar
    select x.workspace_id, 'venc_conta',
           coalesce(nullif(x.descricao, ''), 'Conta'),
           public.fmt_brl(x.valor_centavos) || ' · vencimento ' || to_char(coalesce(x.data_vencimento, x.data), 'DD/MM'),
           'venc_conta:' || x.id, (coalesce(x.data_vencimento, x.data) - _today)
    from public.transactions x
    where x.tipo = 'DESPESA' and not coalesce(x.pago, false) and x.card_id is null
      and (coalesce(x.data_vencimento, x.data) - _today) in (3, 1, 0)
    union all
    -- recorrências (despesa)
    select r.workspace_id, 'venc_recorrencia',
           coalesce(nullif(r.template->>'descricao', ''), 'Recorrência'),
           public.fmt_brl(coalesce((r.template->>'valor_centavos')::bigint, 0)) || ' · recorrência ' || r.frequencia::text,
           'venc_recorrencia:' || r.id || ':' || r.proxima_data, (r.proxima_data - _today)
    from public.recurrences r
    where coalesce(r.ativo, true) and r.template->>'tipo' = 'DESPESA' and (r.proxima_data - _today) in (3, 1, 0)
    union all
    -- parcelas de dívida
    select p.workspace_id, 'venc_divida',
           'Parcela ' || p.numero || ' de ' || d.credor,
           public.fmt_brl(p.valor_centavos) || ' · vencimento ' || to_char(p.vencimento, 'DD/MM'),
           'venc_divida:' || p.id, (p.vencimento - _today)
    from public.debt_installments p
    join public.debts d on d.id = p.debt_id
    where not coalesce(p.pago, false) and (p.vencimento - _today) in (3, 1, 0)
  ),
  ins as (
    insert into public.notifications (workspace_id, user_id, tipo, titulo, corpo, meta)
    select due.workspace_id, m.user_id, due.tipo,
           due.sujeito || case due.dias when 0 then ' vence hoje' when 1 then ' vence amanhã' else ' vence em ' || due.dias || ' dias' end,
           due.corpo,
           jsonb_build_object('dedupe_key', due.base || ':' || due.dias)
    from due
    join public.workspace_members m on m.workspace_id = due.workspace_id and m.user_id is not null and m.status = 'active'
    on conflict (user_id, dedupe_key) do nothing
    returning 1
  )
  select count(*) into inserted from ins;
  return inserted;
end $$;

revoke execute on function public.notifications_filter() from public, anon, authenticated;
revoke execute on function public.notifications_push() from public, anon, authenticated;
revoke execute on function public.generate_due_notifications(date) from public, anon, authenticated;
