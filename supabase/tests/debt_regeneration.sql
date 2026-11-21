-- Executar na mesma transação que a migração, seguida de ROLLBACK.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values ('b85902c1-5510-4eba-96a7-d6065c060398', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'debt-regeneration-test@example.invalid', '{}', '{}', now(), now());
select set_config('request.jwt.claim.sub', 'b85902c1-5510-4eba-96a7-d6065c060398', true);
insert into public.debts (id, workspace_id, user_id, credor, valor_acordo_centavos)
select 'f2fdd52b-cf6e-43e3-aedb-e555273a1d50', id, owner_id, 'Teste', 100000
from public.workspaces where owner_id = 'b85902c1-5510-4eba-96a7-d6065c060398';
insert into public.debt_installments (workspace_id, user_id, debt_id, numero, valor_centavos, vencimento, pago)
select workspace_id, user_id, id, 1, 25000, '2026-01-01', true from public.debts where id = 'f2fdd52b-cf6e-43e3-aedb-e555273a1d50';
insert into public.debt_installments (workspace_id, user_id, debt_id, numero, valor_centavos, vencimento)
select workspace_id, user_id, id, 2, 75000, '2026-02-01' from public.debts where id = 'f2fdd52b-cf6e-43e3-aedb-e555273a1d50';
set local role authenticated;
do $$
declare vals bigint[]; dates date[]; n integer;
begin
  perform * from public.regenerate_debt_installments('f2fdd52b-cf6e-43e3-aedb-e555273a1d50', 3, '2026-01-31');
  select array_agg(valor_centavos order by numero), array_agg(vencimento order by numero), count(*)
    into vals, dates, n from public.debt_installments where debt_id = 'f2fdd52b-cf6e-43e3-aedb-e555273a1d50';
  if vals <> array[25000,25000,25000,25000]::bigint[] or dates <> array['2026-01-01','2026-01-31','2026-02-28','2026-03-31']::date[] or n <> 4 then
    raise exception 'Parcelas incorretas: %, %', vals, dates;
  end if;
  begin
    perform * from public.regenerate_debt_installments('f2fdd52b-cf6e-43e3-aedb-e555273a1d50', 0, '2026-01-31');
    raise exception 'Quantidade inválida aceita';
  exception when others then
    if sqlerrm = 'Quantidade inválida aceita' then raise; end if;
  end;
  if (select count(*) from public.debt_installments where debt_id = 'f2fdd52b-cf6e-43e3-aedb-e555273a1d50') <> 4 then
    raise exception 'Parcelas alteradas após erro';
  end if;
end $$;
reset role;
