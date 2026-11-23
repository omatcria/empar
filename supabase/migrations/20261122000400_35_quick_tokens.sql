-- Chaves pessoais: somente o hash é persistido.
create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  nome text not null check (length(nome) between 1 and 60),
  token_hash text not null unique,
  prefixo text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.api_tokens enable row level security;
create policy api_tokens_select_own on public.api_tokens for select to authenticated using (user_id = auth.uid());
grant select on public.api_tokens to authenticated;

create or replace function public.create_quick_token(_workspace uuid, _nome text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare token text;
begin
  if not public.has_write(_workspace) then raise exception 'Sem permissão para criar chave'; end if;
  if _nome is null or length(trim(_nome)) not between 1 and 60 then raise exception 'Nome inválido'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || _workspace::text, 0));
  if (select count(*) from public.api_tokens where user_id = auth.uid() and workspace_id = _workspace and revoked_at is null) >= 10 then
    raise exception 'Limite de 10 chaves ativas';
  end if;
  token := 'emp_' || encode(gen_random_bytes(24), 'hex');
  insert into public.api_tokens(user_id, workspace_id, nome, token_hash, prefixo)
    values (auth.uid(), _workspace, trim(_nome), encode(digest(token, 'sha256'), 'hex'), left(token, 8));
  return token;
end $$;
create or replace function public.revoke_quick_token(_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.api_tokens set revoked_at = now() where id = _id and user_id = auth.uid() and revoked_at is null;
$$;
revoke all on function public.create_quick_token(uuid, text) from public, anon;
revoke all on function public.revoke_quick_token(uuid) from public, anon;
grant execute on function public.create_quick_token(uuid, text) to authenticated;
grant execute on function public.revoke_quick_token(uuid) to authenticated;

-- A gravação é atômica: autorização, fatura, lançamento, histórico e avisos.
-- A função só é acessível à Edge Function com service_role.
create or replace function public.insert_quick_transaction(_hash text, _input jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  tok public.api_tokens%rowtype;
  member_role public.member_role;
  ctx public.context_enum;
  cat public.categories%rowtype;
  card public.cards%rowtype;
  inv uuid;
  txid uuid := (_input->>'id')::uuid;
  kind text := _input->>'kind';
  meio uuid := (_input->>'meio')::uuid;
  tx_type public.tx_type_enum := (_input->>'tipo')::public.tx_type_enum;
  valor bigint := (_input->>'valor')::bigint;
  dia date := (_input->>'data')::date;
  descricao text := _input->>'descricao';
begin
  select * into tok from public.api_tokens where token_hash = _hash and revoked_at is null for update;
  if not found then raise exception 'QUICK_UNAUTHORIZED'; end if;
  select role into member_role from public.workspace_members where workspace_id = tok.workspace_id and user_id = tok.user_id for share;
  if not found or member_role not in ('owner', 'editor') then raise exception 'QUICK_FORBIDDEN'; end if;
  if dia <> (now() at time zone 'America/Sao_Paulo')::date or valor <= 0 or length(descricao) > 120 then raise exception 'QUICK_INVALID'; end if;
  if kind = 'conta' then
    select contexto into ctx from public.accounts where id = meio and workspace_id = tok.workspace_id and not arquivada for share;
    if not found then raise exception 'QUICK_MEIO'; end if;
  elsif kind = 'cartao' and tx_type = 'DESPESA' then
    select * into card from public.cards where id = meio and workspace_id = tok.workspace_id and not arquivado and tipo <> 'debito' for share;
    if not found then raise exception 'QUICK_MEIO'; end if;
    ctx := card.contexto;
  else raise exception 'QUICK_MEIO'; end if;
  select * into cat from public.categories where id = (_input->>'categoria')::uuid and workspace_id = tok.workspace_id and contexto = ctx and tipo = tx_type and coalesce(chave, '') !~ 'PRO_LABORE|DISTRIBUICAO' for share;
  if not found then raise exception 'QUICK_CATEGORIA'; end if;
  if kind = 'cartao' then
    perform pg_advisory_xact_lock(hashtextextended(meio::text || ':' || (_input->'cycle'->>'mesReferencia'), 0));
    select id into inv from public.invoices where workspace_id = tok.workspace_id and card_id = meio and mes_referencia = _input->'cycle'->>'mesReferencia' limit 1;
    if inv is null then
      insert into public.invoices (user_id, workspace_id, card_id, mes_referencia, data_fechamento, data_vencimento)
      values (tok.user_id, tok.workspace_id, meio, _input->'cycle'->>'mesReferencia', (_input->'cycle'->>'dataFechamento')::date, (_input->'cycle'->>'dataVencimento')::date) returning id into inv;
    end if;
  end if;
  insert into public.transactions (id, user_id, workspace_id, contexto, tipo, account_id, card_id, invoice_id, category_id, valor_centavos, data, descricao, pago)
  values (txid, tok.user_id, tok.workspace_id, ctx, tx_type, case when kind = 'conta' then meio end, case when kind = 'cartao' then meio end, inv, cat.id, valor, dia, descricao, true);
  insert into public.activity_log (user_id, workspace_id, entity, action, entity_id, meta)
  values (tok.user_id, tok.workspace_id, 'transaction', 'create', txid, jsonb_build_object('descricao', descricao));
  insert into public.notifications (user_id, workspace_id, tipo, titulo, corpo, meta)
  select m.user_id, tok.workspace_id, 'membro_lancamento', _input->'notification'->>'titulo', _input->'notification'->>'corpo', jsonb_build_object('acao', 'criou', 'entity_id', txid)
  from public.workspace_members m where m.workspace_id = tok.workspace_id and m.user_id <> tok.user_id;
  update public.api_tokens set last_used_at = now() where id = tok.id;
  return txid;
end $$;
revoke all on function public.insert_quick_transaction(text, jsonb) from public, anon, authenticated;
grant execute on function public.insert_quick_transaction(text, jsonb) to service_role;
