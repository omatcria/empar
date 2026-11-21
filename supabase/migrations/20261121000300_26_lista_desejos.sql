-- ============ 26 · Lista de desejos com histórico de preço ============

create table if not exists public.wishlist_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  nome text not null,
  icone text not null default 'tag',
  cor text not null default '#64748b',
  created_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  category_id uuid references public.wishlist_categories(id) on delete set null,
  url text not null,
  titulo text not null,
  descricao text,
  imagem_url text,
  loja text,
  preco_atual_centavos bigint check (preco_atual_centavos >= 0),
  preco_inicial_centavos bigint check (preco_inicial_centavos >= 0),
  preco_minimo_centavos bigint check (preco_minimo_centavos >= 0),
  preco_alvo_centavos bigint check (preco_alvo_centavos >= 0),
  comprado boolean not null default false,
  comprado_em date,
  monitorar boolean not null default true,
  ultima_verificacao timestamptz,
  ultimo_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Gravado pelo app (1º preço) e pelo cron diário (service role).
create table if not exists public.wishlist_price_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_id uuid not null references public.wishlist_items(id) on delete cascade,
  preco_centavos bigint not null check (preco_centavos >= 0),
  verificado_em timestamptz not null default now()
);

create index if not exists idx_wish_cats_ws on public.wishlist_categories(workspace_id);
create index if not exists idx_wish_items_ws on public.wishlist_items(workspace_id);
create index if not exists idx_wish_items_cat on public.wishlist_items(category_id);
create index if not exists idx_wish_hist_ws on public.wishlist_price_history(workspace_id);
create index if not exists idx_wish_hist_item on public.wishlist_price_history(item_id, verificado_em);

create trigger trg_wishlist_items_updated
  before update on public.wishlist_items
  for each row execute function set_updated_at();

-- RLS: leitura por membro, escrita por membro com permissão (owner/editor)
alter table public.wishlist_categories enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.wishlist_price_history enable row level security;

create policy "Membros veem categorias de desejos" on public.wishlist_categories
  for select to authenticated using (is_member(workspace_id));
create policy "Membros com escrita inserem categorias de desejos" on public.wishlist_categories
  for insert to authenticated with check (has_write(workspace_id));
create policy "Membros com escrita atualizam categorias de desejos" on public.wishlist_categories
  for update to authenticated using (has_write(workspace_id)) with check (has_write(workspace_id));
create policy "Membros com escrita apagam categorias de desejos" on public.wishlist_categories
  for delete to authenticated using (has_write(workspace_id));

create policy "Membros veem desejos" on public.wishlist_items
  for select to authenticated using (is_member(workspace_id));
create policy "Membros com escrita inserem desejos" on public.wishlist_items
  for insert to authenticated with check (has_write(workspace_id));
create policy "Membros com escrita atualizam desejos" on public.wishlist_items
  for update to authenticated using (has_write(workspace_id)) with check (has_write(workspace_id));
create policy "Membros com escrita apagam desejos" on public.wishlist_items
  for delete to authenticated using (has_write(workspace_id));

create policy "Membros veem histórico de preços" on public.wishlist_price_history
  for select to authenticated using (is_member(workspace_id));
create policy "Membros com escrita inserem histórico de preços" on public.wishlist_price_history
  for insert to authenticated with check (has_write(workspace_id));
create policy "Membros com escrita atualizam histórico de preços" on public.wishlist_price_history
  for update to authenticated using (has_write(workspace_id)) with check (has_write(workspace_id));
create policy "Membros com escrita apagam histórico de preços" on public.wishlist_price_history
  for delete to authenticated using (has_write(workspace_id));

grant select, insert, update, delete on table public.wishlist_categories to authenticated;
grant select, insert, update, delete on table public.wishlist_items to authenticated;
grant select, insert, update, delete on table public.wishlist_price_history to authenticated;
