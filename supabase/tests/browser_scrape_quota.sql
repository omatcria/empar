insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values ('309bffbb-5873-4c8f-91a3-f8c158c1f392','00000000-0000-0000-0000-000000000000','authenticated','authenticated','browser-quota-test@example.invalid','{}','{}',now(),now());
select set_config('request.jwt.claim.sub','309bffbb-5873-4c8f-91a3-f8c158c1f392',true);
set local role authenticated;
do $$ begin
  for i in 1..10 loop if not public.acquire_browser_scrape() then raise exception 'Tentativa permitida foi bloqueada'; end if; end loop;
  if public.acquire_browser_scrape() then raise exception 'Limite não respeitado'; end if;
end $$;
reset role;
