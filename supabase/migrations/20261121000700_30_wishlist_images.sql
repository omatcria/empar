-- Imagens de desejos são privadas e compartilhadas apenas com membros do espaço.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist-images', 'wishlist-images', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
create policy "Membros leem imagens de desejos" on storage.objects for select to authenticated
using (bucket_id = 'wishlist-images' and public.is_member((storage.foldername(name))[1]::uuid));
create policy "Membros com escrita enviam imagens de desejos" on storage.objects for insert to authenticated
with check (bucket_id = 'wishlist-images' and public.has_write((storage.foldername(name))[1]::uuid));
create policy "Membros com escrita apagam imagens de desejos" on storage.objects for delete to authenticated
using (bucket_id = 'wishlist-images' and public.has_write((storage.foldername(name))[1]::uuid));
