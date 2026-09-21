-- ============================================================================
-- DIGITAL HEROES - PHASE E: WINNER PROOF STORAGE CONFIGURATION
-- ============================================================================

-- 1. Create private bucket for winner score proof screenshots
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'winner-proofs',
  'winner-proofs',
  false,
  5242880, -- 5 MB limit
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 2. Storage RLS Policies (Defense-in-depth on storage.objects)
-- Enable RLS on storage.objects if not already enabled
alter table storage.objects enable row level security;

-- Policy: Admins have full access to winner proofs
create policy "Admins have full access to winner proofs"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'winner-proofs' and
  public.is_admin()
)
with check (
  bucket_id = 'winner-proofs' and
  public.is_admin()
);

-- Policy: Winners can select their own winner proofs
create policy "Winners can view own proofs via direct storage"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'winner-proofs' and
  exists (
    select 1 from public.winners w
    where w.user_id = auth.uid()
      and w.proof_image_url = name
  )
);
