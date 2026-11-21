-- ============ 24 · Acompanhamento do MEI + novas preferências de notificação ============
-- Configuração MEI por espaço (ligada por padrão, teto R$ 81.000,00). A RLS de
-- `workspaces` já restringe UPDATE ao dono (is_owner), então só ele edita.
alter table public.workspaces
  add column if not exists mei_ativo boolean not null default true,
  add column if not exists mei_limite_anual_centavos bigint not null default 8100000
    check (mei_limite_anual_centavos > 0),
  add column if not exists mei_abertura date;  -- null = aberto antes do ano corrente (sem proporcionalidade)

-- Preferências por usuário (respeitadas pelo cálculo de notificações e pelo cron de preços).
alter table public.notification_prefs
  add column if not exists mei_alertas boolean not null default true,
  add column if not exists wishlist_precos boolean not null default true;
