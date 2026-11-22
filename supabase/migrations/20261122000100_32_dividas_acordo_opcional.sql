-- 32 · Dívidas: só nome e valor original são obrigatórios; acordo e parcelas vêm depois.
alter table public.debts alter column valor_acordo_centavos drop not null;

create or replace function public.regenerate_debt_installments(_debt_id uuid, _n integer, _first_due date)
returns setof public.debt_installments
language plpgsql
security invoker
set search_path = public
as $$
declare
  d public.debts%rowtype;
  paid bigint;
  remaining bigint;
  last_paid integer;
begin
  if _n is null or _n < 1 or _first_due is null then
    raise exception 'Informe parcelas e vencimento válidos';
  end if;
  select * into d from public.debts where id = _debt_id for update;
  if not found or not public.has_write(d.workspace_id) then
    raise exception 'Dívida não encontrada ou sem permissão';
  end if;
  select coalesce(sum(valor_centavos), 0), coalesce(max(numero), 0)
    into paid, last_paid from public.debt_installments where debt_id = _debt_id and pago;
  remaining := greatest(0, coalesce(d.valor_acordo_centavos, d.valor_original_centavos, 0) - paid);
  delete from public.debt_installments where debt_id = _debt_id and not pago;
  if remaining > 0 then
    insert into public.debt_installments (workspace_id, user_id, debt_id, numero, valor_centavos, vencimento)
    select d.workspace_id, auth.uid(), d.id, last_paid + i,
      remaining / _n + case when i <= remaining % _n then 1 else 0 end,
      (_first_due + make_interval(months => i - 1))::date
    from generate_series(1, _n) as i;
  end if;
  return query select * from public.debt_installments where debt_id = _debt_id order by numero;
end;
$$;
revoke all on function public.regenerate_debt_installments(uuid, integer, date) from public;
grant execute on function public.regenerate_debt_installments(uuid, integer, date) to authenticated;
