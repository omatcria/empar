-- Limita chamadas manuais ao navegador por usuário, sem acesso direto à tabela.
create table if not exists public.browser_scrape_quota (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started timestamptz not null,
  attempts integer not null
);
alter table public.browser_scrape_quota enable row level security;
revoke all on public.browser_scrape_quota from public, anon, authenticated;
create or replace function public.acquire_browser_scrape() returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); allowed boolean;
begin
  if uid is null then raise exception 'Usuário não autenticado'; end if;
  insert into public.browser_scrape_quota(user_id, window_started, attempts)
  values (uid, now(), 1)
  on conflict (user_id) do update set
    window_started = case when browser_scrape_quota.window_started <= now() - interval '1 hour' then now() else browser_scrape_quota.window_started end,
    attempts = case when browser_scrape_quota.window_started <= now() - interval '1 hour' then 1 else browser_scrape_quota.attempts + 1 end
  where browser_scrape_quota.window_started <= now() - interval '1 hour' or browser_scrape_quota.attempts < 10
  returning true into allowed;
  return coalesce(allowed, false);
end;
$$;
revoke all on function public.acquire_browser_scrape() from public, anon;
grant execute on function public.acquire_browser_scrape() to authenticated;
