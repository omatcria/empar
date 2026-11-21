insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values ('dd2d5d13-89c8-44ef-b125-36b0045470be','00000000-0000-0000-0000-000000000000','authenticated','authenticated','wish-image-a@example.invalid','{}','{}',now(),now()),
('0586cb6f-a413-4f87-a4aa-54a604f5576b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','wish-image-b@example.invalid','{}','{}',now(),now());
select set_config('test.ws', (select id::text from public.workspaces where owner_id='dd2d5d13-89c8-44ef-b125-36b0045470be'), true);
select set_config('request.jwt.claim.sub', 'dd2d5d13-89c8-44ef-b125-36b0045470be', true);
set local role authenticated;
insert into storage.objects(bucket_id, name) values ('wishlist-images', current_setting('test.ws') || '/test-image');
do $$ begin if (select count(*) from storage.objects where bucket_id='wishlist-images') <> 1 then raise exception 'Dono não consegue ler'; end if; end $$;
select set_config('request.jwt.claim.sub', '0586cb6f-a413-4f87-a4aa-54a604f5576b', true);
do $$ begin
 if (select count(*) from storage.objects where bucket_id='wishlist-images') <> 0 then raise exception 'Outro usuário consegue ler'; end if;
 begin
  insert into storage.objects(bucket_id,name) values ('wishlist-images',current_setting('test.ws') || '/forbidden');
  raise exception 'Outro usuário conseguiu gravar';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
