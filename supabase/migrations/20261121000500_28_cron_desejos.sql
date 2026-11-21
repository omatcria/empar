create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('wishlist-price-check-diario', '0 11 * * *', $$
  select net.http_post(
    url := 'https://gkzstunjcftvqoljgvce.supabase.co/functions/v1/wishlist-price-check',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='wishlist_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
