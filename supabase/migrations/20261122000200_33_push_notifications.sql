-- Migração 33: notificações push, preferências por tipo e vencimentos gerados no servidor.
-- O segredo 'push_webhook_secret' já existe no Vault (criado fora deste arquivo; nunca versionado).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Preferências novas ------------------------------------------------------
alter table public.notification_prefs
  add column if not exists venc_recorrencias boolean not null default true,
  add column if not exists venc_dividas boolean not null default true,
  add column if not exists membros_lancamentos boolean not null default true,
  add column if not exists membros_desejos boolean not null default true,
  add column if not exists reacoes boolean not null default true;

-- 2) Deduplicação por usuário ---------------------------------------------------
alter table public.notifications
  add column if not exists dedupe_key text generated always as (meta->>'dedupe_key') stored;
alter table public.notifications
  add constraint notifications_user_dedupe_key unique (user_id, dedupe_key);

-- 3) Inscrições de push -----------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- 4) Mapa tipo -> coluna de preferência ---------------------------------------------
create or replace function public.notification_pref_column(tipo text)
returns text language sql immutable set search_path = public as $$
  select case tipo
    when 'membro_lancamento' then 'membros_lancamentos'
    when 'membro_desejo' then 'membros_desejos'
    when 'reaction' then 'reacoes'
    when 'venc_fatura' then 'venc_faturas'
    when 'venc_conta' then 'venc_contas'
    when 'venc_recorrencia' then 'venc_recorrencias'
    when 'venc_divida' then 'venc_dividas'
    when 'orcamento_80' then 'orcamento_80'
    when 'mei' then 'mei_alertas'
    when 'wishlist' then 'wishlist_precos'
    else null
  end
$$;

-- 5) Formatação de dinheiro -------------------------------------------------------------
create or replace function public.fmt_brl(v bigint)
returns text language sql immutable set search_path = public as $$
  select case when v < 0 then '-' else '' end || 'R$ '
    || replace(to_char(abs(v) / 100, 'FM999,999,999,999,990'), ',', '.')
    || ',' || lpad((abs(v) % 100)::text, 2, '0')
$$;

-- 6) Gatilho BEFORE: preferência desligada ou duplicata descarta a linha ----------------------
create or replace function public.notifications_filter()
returns trigger language plpgsql security definer set search_path = public as $$
declare col text; allowed text;
begin
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
create trigger trg_notifications_filter before insert on public.notifications
  for each row execute function public.notifications_filter();

-- 7) Gatilho AFTER: dispara o envio de push; nunca impede o INSERT ---------------------------
create or replace function public.notifications_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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
create trigger trg_notifications_push after insert on public.notifications
  for each row execute function public.notifications_push();

-- 8) Vencimentos gerados no servidor ----------------------------------------------------------
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
    join public.workspace_members m on m.workspace_id = due.workspace_id and m.user_id is not null
    on conflict (user_id, dedupe_key) do nothing
    returning 1
  )
  select count(*) into inserted from ins;
  return inserted;
end $$;

revoke execute on function public.notification_pref_column(text) from public, anon, authenticated;
revoke execute on function public.fmt_brl(bigint) from public, anon, authenticated;
revoke execute on function public.notifications_filter() from public, anon, authenticated;
revoke execute on function public.notifications_push() from public, anon, authenticated;
revoke execute on function public.generate_due_notifications(date) from public, anon, authenticated;

-- 9) Agendamento: 12h UTC = 9h Brasília -------------------------------------------------------
select cron.schedule('notificacoes-vencimento-diario', '0 12 * * *', 'select public.generate_due_notifications()');
