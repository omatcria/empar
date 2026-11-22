-- Dívida só com credor + valor original (acordo nulo) deve ser aceita e parcelável.
-- Marcador de sucesso: exceção 'DEBT_OPTIONAL_OK' (desfaz tudo; a Management API não devolve raise notice).
-- Qualquer falha de asserção levanta outra mensagem.
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values ('c4a1d2e3-7f60-4b8a-9d15-2e8f0a6b3c71', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'debt-optional-test@example.invalid', '{}', '{}', now(), now());
select set_config('request.jwt.claim.sub', 'c4a1d2e3-7f60-4b8a-9d15-2e8f0a6b3c71', true);
insert into public.debts (id, workspace_id, user_id, credor, valor_original_centavos)
select '0b7e4c52-91a3-4d68-8e2f-5c1a9b3d7e40', id, owner_id, 'Teste opcional', 50000
from public.workspaces where owner_id = 'c4a1d2e3-7f60-4b8a-9d15-2e8f0a6b3c71';
set local role authenticated;
do $$
declare vals bigint[];
begin
  if not exists (select 1 from public.debts where id = '0b7e4c52-91a3-4d68-8e2f-5c1a9b3d7e40' and valor_acordo_centavos is null) then
    raise exception 'ASSERT: dívida sem acordo não foi criada';
  end if;
  perform * from public.regenerate_debt_installments('0b7e4c52-91a3-4d68-8e2f-5c1a9b3d7e40', 2, '2026-12-10');
  select array_agg(valor_centavos order by numero) into vals
    from public.debt_installments where debt_id = '0b7e4c52-91a3-4d68-8e2f-5c1a9b3d7e40';
  if vals is distinct from array[25000,25000]::bigint[] then
    raise exception 'ASSERT: parcelas incorretas: %', vals;
  end if;
  raise exception 'DEBT_OPTIONAL_OK';
end $$;
rollback;
