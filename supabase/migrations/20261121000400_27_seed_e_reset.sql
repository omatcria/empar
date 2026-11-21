-- ============ 27 · Seed padrão reutilizável + reset de dados do espaço ============

-- Seed padrão de um espaço: categorias de sistema (ponte) + padrão PESSOAL/EMPRESARIAL,
-- envelopes de imposto e metas preset. Extraído VERBATIM de handle_new_user
-- (apenas ws_id → _ws e new.id → _uid). Interno: sem EXECUTE para clientes.
create or replace function public.seed_workspace_defaults(_ws uuid, _uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Categorias de sistema (ponte)
  insert into public.categories (workspace_id, user_id, nome, contexto, tipo, icone, cor, sistema, chave) values
    (_ws, _uid, 'Pró-labore',            'EMPRESARIAL', 'DESPESA', 'landmark', '#8b5cf6', true, 'PRO_LABORE_SAIDA'),
    (_ws, _uid, 'Pró-labore',            'PESSOAL',     'RECEITA', 'landmark', '#3b82f6', true, 'PRO_LABORE_ENTRADA'),
    (_ws, _uid, 'Distribuição de lucros','EMPRESARIAL', 'DESPESA', 'landmark', '#8b5cf6', true, 'DISTRIBUICAO_SAIDA'),
    (_ws, _uid, 'Distribuição de lucros','PESSOAL',     'RECEITA', 'landmark', '#3b82f6', true, 'DISTRIBUICAO_ENTRADA'),
    (_ws, _uid, 'Impostos',             'EMPRESARIAL', 'DESPESA', 'receipt',  '#ef4444', true, 'IMPOSTOS');

  -- Categorias padrão PESSOAL
  insert into public.categories (workspace_id, user_id, nome, contexto, tipo, icone, cor) values
    (_ws, _uid, 'Salário CLT',    'PESSOAL', 'RECEITA', 'wallet',        '#10b981'),
    (_ws, _uid, 'Outras receitas','PESSOAL', 'RECEITA', 'plus',          '#10b981'),
    (_ws, _uid, 'Moradia',        'PESSOAL', 'DESPESA', 'home',          '#f59e0b'),
    (_ws, _uid, 'Alimentação',    'PESSOAL', 'DESPESA', 'utensils',      '#f59e0b'),
    (_ws, _uid, 'Transporte',     'PESSOAL', 'DESPESA', 'car',           '#f59e0b'),
    (_ws, _uid, 'Saúde',          'PESSOAL', 'DESPESA', 'heart-pulse',   '#f59e0b'),
    (_ws, _uid, 'Educação',       'PESSOAL', 'DESPESA', 'graduation-cap','#f59e0b'),
    (_ws, _uid, 'Lazer',          'PESSOAL', 'DESPESA', 'party-popper',  '#f59e0b'),
    (_ws, _uid, 'Compras',        'PESSOAL', 'DESPESA', 'shopping-bag',  '#f59e0b'),
    (_ws, _uid, 'Assinaturas',    'PESSOAL', 'DESPESA', 'repeat',        '#f59e0b'),
    (_ws, _uid, 'Outros',         'PESSOAL', 'DESPESA', 'ellipsis',      '#64748b');

  -- Categorias padrão EMPRESARIAL
  insert into public.categories (workspace_id, user_id, nome, contexto, tipo, icone, cor) values
    (_ws, _uid, 'Receita de serviços', 'EMPRESARIAL', 'RECEITA', 'briefcase',   '#10b981'),
    (_ws, _uid, 'Vendas',              'EMPRESARIAL', 'RECEITA', 'trending-up',  '#10b981'),
    (_ws, _uid, 'Outras receitas PJ',  'EMPRESARIAL', 'RECEITA', 'plus',         '#10b981'),
    (_ws, _uid, 'Fornecedores',        'EMPRESARIAL', 'DESPESA', 'truck',        '#f59e0b'),
    (_ws, _uid, 'Ferramentas/Software','EMPRESARIAL', 'DESPESA', 'wrench',       '#f59e0b'),
    (_ws, _uid, 'Anúncios/Marketing',  'EMPRESARIAL', 'DESPESA', 'megaphone',    '#f59e0b'),
    (_ws, _uid, 'Contador',            'EMPRESARIAL', 'DESPESA', 'calculator',   '#f59e0b'),
    (_ws, _uid, 'Taxas bancárias',     'EMPRESARIAL', 'DESPESA', 'banknote',     '#f59e0b'),
    (_ws, _uid, 'Outros (PJ)',         'EMPRESARIAL', 'DESPESA', 'ellipsis',     '#64748b');

  -- Envelopes de imposto
  insert into public.tax_provisions (workspace_id, user_id, nome, percentual, ativo) values
    (_ws, _uid, 'DAS',      6.000,  false),
    (_ws, _uid, 'INSS',     11.000, false),
    (_ws, _uid, 'IRPF',     0.000,  false),
    (_ws, _uid, 'Contador', 0.000,  false);

  -- Metas preset
  insert into public.goals (workspace_id, user_id, contexto, nome, valor_alvo_centavos, preset) values
    (_ws, _uid, 'PESSOAL',     'Reserva de emergência pessoal',     0, 'RESERVA_PESSOAL'),
    (_ws, _uid, 'EMPRESARIAL', 'Reserva de emergência empresarial', 0, 'RESERVA_EMPRESARIAL');
end;
$$;

revoke execute on function public.seed_workspace_defaults(uuid, uuid) from public, anon, authenticated;

-- Novo usuário: perfil + espaço + membro dono + seed padrão (comportamento idêntico ao anterior).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  u_nome text := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, nome) values (new.id, u_nome);

  -- Espaço pessoal do novo usuário
  insert into public.workspaces (nome, owner_id)
  values (u_nome || ' — Finanças', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role, email, nome, status)
  values (ws_id, new.id, 'owner', new.email, new.raw_user_meta_data->>'nome', 'active');

  update public.profiles set active_workspace_id = ws_id where id = new.id;

  -- Categorias, envelopes de imposto e metas preset
  perform public.seed_workspace_defaults(ws_id, new.id);

  return new;
end;
$$;

-- create or replace preserva os privilégios; reforça o hardening (só trigger, nunca RPC).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Reset: apaga TODOS os dados do espaço (mantém perfil, espaço + config MEI, membros,
-- convites e preferências), recria o seed padrão e devolve o dono ao onboarding.
-- Uma chamada = uma transação: qualquer erro desfaz tudo.
create or replace function public.reset_workspace_data(_ws uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null or not public.is_owner(_ws) then
    raise exception 'Apenas o dono do espaço pode resetar os dados' using errcode = '42501';
  end if;

  -- Ordem segura de FK: filhos antes dos pais.
  delete from public.transaction_reactions  where workspace_id = _ws;
  delete from public.notifications          where workspace_id = _ws;
  delete from public.activity_log           where workspace_id = _ws;
  delete from public.investment_movements   where workspace_id = _ws;
  delete from public.investments            where workspace_id = _ws;
  delete from public.debt_installments      where workspace_id = _ws;
  delete from public.debts                  where workspace_id = _ws;
  delete from public.wishlist_price_history where workspace_id = _ws;
  delete from public.wishlist_items         where workspace_id = _ws;
  delete from public.wishlist_categories    where workspace_id = _ws;
  delete from public.transactions           where workspace_id = _ws;  -- → faturas, cartões, contas, categorias (RESTRICT)
  delete from public.invoices               where workspace_id = _ws;  -- → cartões, contas (paid_account_id)
  delete from public.recurrences            where workspace_id = _ws;
  delete from public.budgets                where workspace_id = _ws;
  delete from public.goals                  where workspace_id = _ws;
  delete from public.cards                  where workspace_id = _ws;  -- → contas (account_pagamento_id RESTRICT)
  delete from public.accounts               where workspace_id = _ws;
  update public.categories set categoria_pai_id = null
    where workspace_id = _ws and categoria_pai_id is not null;
  delete from public.categories             where workspace_id = _ws;
  delete from public.tax_provisions         where workspace_id = _ws;

  perform public.seed_workspace_defaults(_ws, _uid);

  update public.profiles set onboarding_completo = false where id = _uid;
end;
$$;

revoke execute on function public.reset_workspace_data(uuid) from public, anon;
grant execute on function public.reset_workspace_data(uuid) to authenticated;
