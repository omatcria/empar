-- ============ 25 · Empréstimos e dívidas (acordos com parcelas) ============
-- Módulo ISOLADO: dívidas não geram transações nem entram em saldos/relatórios.

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  contexto context_enum not null default 'PESSOAL',
  credor text not null,
  origem text not null default 'Serasa Limpa Nome',
  descricao text,
  valor_original_centavos bigint check (valor_original_centavos >= 0),
  valor_acordo_centavos bigint not null check (valor_acordo_centavos >= 0),
  data_acordo date,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debt_installments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  debt_id uuid not null references public.debts(id) on delete cascade,
  numero int not null check (numero >= 1),
  valor_centavos bigint not null check (valor_centavos >= 0),
  vencimento date not null,
  pago boolean not null default false,
  pago_em date,
  unique (debt_id, numero)
);

create index if not exists idx_debts_ws on public.debts(workspace_id);
create index if not exists idx_debt_inst_ws on public.debt_installments(workspace_id);
create index if not exists idx_debt_inst_debt on public.debt_installments(debt_id);

create trigger trg_debts_updated
  before update on public.debts
  for each row execute function set_updated_at();

-- RLS: leitura por membro, escrita por membro com permissão (owner/editor)
alter table public.debts enable row level security;
alter table public.debt_installments enable row level security;

create policy "Membros veem dívidas" on public.debts
  for select to authenticated using (is_member(workspace_id));
create policy "Membros com escrita inserem dívidas" on public.debts
  for insert to authenticated with check (has_write(workspace_id));
create policy "Membros com escrita atualizam dívidas" on public.debts
  for update to authenticated using (has_write(workspace_id)) with check (has_write(workspace_id));
create policy "Membros com escrita apagam dívidas" on public.debts
  for delete to authenticated using (has_write(workspace_id));

create policy "Membros veem parcelas de dívidas" on public.debt_installments
  for select to authenticated using (is_member(workspace_id));
create policy "Membros com escrita inserem parcelas de dívidas" on public.debt_installments
  for insert to authenticated with check (has_write(workspace_id));
create policy "Membros com escrita atualizam parcelas de dívidas" on public.debt_installments
  for update to authenticated using (has_write(workspace_id)) with check (has_write(workspace_id));
create policy "Membros com escrita apagam parcelas de dívidas" on public.debt_installments
  for delete to authenticated using (has_write(workspace_id));

grant select, insert, update, delete on table public.debts to authenticated;
grant select, insert, update, delete on table public.debt_installments to authenticated;
