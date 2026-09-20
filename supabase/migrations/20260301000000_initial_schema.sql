-- ============================================================================
-- DIGITAL HEROES: Initial Schema Migration (Milestone 1A)
-- ============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'subscriber' check (role in ('subscriber', 'admin')),
  charity_id uuid, -- foreign key constraint attached after charities table creation
  charity_contribution_pct numeric(5,2) not null default 10.00 check (charity_contribution_pct >= 10.00 and charity_contribution_pct <= 100.00),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper function to prevent recursive RLS queries on profiles.
-- By setting security definer and search_path, it runs with table-owner privileges.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================================
-- 2. CHARITIES TABLE
-- ============================================================================
create table public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tagline text,
  description text not null,
  logo_url text,
  cover_image_url text,
  gallery_images text[] not null default '{}',
  is_featured boolean not null default false,
  website_url text,
  total_funds_raised numeric(12,2) not null default 0.00 check (total_funds_raised >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Attach foreign key constraint on profiles.charity_id
alter table public.profiles
  add constraint fk_profiles_charity
  foreign key (charity_id) references public.charities(id) on delete set null;

-- ============================================================================
-- 3. CHARITY EVENTS TABLE
-- ============================================================================
create table public.charity_events (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  title text not null,
  description text,
  event_date timestamptz not null,
  location text,
  event_type text not null default 'golf_day',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_charity_events_charity on public.charity_events(charity_id, event_date);

-- ============================================================================
-- 4. SUBSCRIPTIONS TABLE (1:N with profiles to retain subscription history)
-- ============================================================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan_type text not null check (plan_type in ('monthly', 'yearly')),
  status text not null check (status in ('active', 'trialing', 'canceled', 'past_due', 'unpaid', 'incomplete', 'lapsed')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'usd',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_user_status on public.subscriptions(user_id, status);

-- ============================================================================
-- 5. GOLF SCORES TABLE
-- ============================================================================
create table public.golf_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score >= 1 and score <= 45),
  played_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_user_played_date unique (user_id, played_date)
);

-- Index for efficient retrieval of the latest scores by played_date DESC, created_at DESC
create index idx_golf_scores_user_played on public.golf_scores(user_id, played_date desc, created_at desc);

-- ============================================================================
-- 6. DRAWS TABLE
-- ============================================================================
create table public.draws (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  draw_date timestamptz not null,
  cadence text not null default 'monthly',
  status text not null default 'draft' check (status in ('draft', 'simulated', 'published', 'completed')),
  draw_mode text not null check (draw_mode in ('random', 'algorithmic')),
  drawn_numbers integer[] check (drawn_numbers is null or array_length(drawn_numbers, 1) = 5),
  total_active_subscribers integer not null default 0 check (total_active_subscribers >= 0),
  subscription_pool_portion numeric(10,2) not null default 0.00 check (subscription_pool_portion >= 0),
  rollover_jackpot_in numeric(10,2) not null default 0.00 check (rollover_jackpot_in >= 0),
  total_prize_pool numeric(10,2) not null default 0.00 check (total_prize_pool >= 0),
  tier_5_pool numeric(10,2) not null default 0.00 check (tier_5_pool >= 0),
  tier_4_pool numeric(10,2) not null default 0.00 check (tier_4_pool >= 0),
  tier_3_pool numeric(10,2) not null default 0.00 check (tier_3_pool >= 0),
  unclaimed_tier_4 numeric(10,2) not null default 0.00 check (unclaimed_tier_4 >= 0),
  unclaimed_tier_3 numeric(10,2) not null default 0.00 check (unclaimed_tier_3 >= 0),
  jackpot_rolled_over boolean not null default false,
  rollover_jackpot_out numeric(10,2) not null default 0.00 check (rollover_jackpot_out >= 0),
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 7. DRAW ENTRIES TABLE
-- ============================================================================
create table public.draw_entries (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scores_snapshot integer[] not null check (array_length(scores_snapshot, 1) = 5),
  matches_count integer not null default 0 check (matches_count >= 0 and matches_count <= 5),
  matched_numbers integer[] not null default '{}',
  winning_tier text check (winning_tier in ('tier_5', 'tier_4', 'tier_3', null)),
  prize_amount numeric(10,2) not null default 0.00 check (prize_amount >= 0),
  created_at timestamptz not null default now(),
  constraint unique_draw_user unique (draw_id, user_id)
);

create index idx_draw_entries_user on public.draw_entries(user_id);
create index idx_draw_entries_draw on public.draw_entries(draw_id);

-- ============================================================================
-- 8. WINNERS TABLE
-- ============================================================================
create table public.winners (
  id uuid primary key default gen_random_uuid(),
  draw_entry_id uuid not null references public.draw_entries(id) on delete cascade unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  draw_id uuid not null references public.draws(id) on delete cascade,
  tier text not null check (tier in ('tier_5', 'tier_4', 'tier_3')),
  prize_amount numeric(10,2) not null check (prize_amount >= 0),
  verification_status text not null default 'pending_submission' check (verification_status in ('pending_submission', 'pending_review', 'approved', 'rejected')),
  proof_image_url text,
  proof_submitted_at timestamptz,
  admin_notes text,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  paid_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_winners_user on public.winners(user_id);
create index idx_winners_verification on public.winners(verification_status);

-- ============================================================================
-- 9. DONATIONS TABLE
-- ============================================================================
create table public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  charity_id uuid not null references public.charities(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'usd',
  donation_type text not null check (donation_type in ('subscription_allocation', 'independent')),
  stripe_payment_id text,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

create index idx_donations_charity on public.donations(charity_id);

-- ============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    charity_id,
    charity_contribution_pct
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    'subscriber',
    case
      when new.raw_user_meta_data->>'charity_id' is not null
      then (new.raw_user_meta_data->>'charity_id')::uuid
      else null
    end,
    coalesce((new.raw_user_meta_data->>'charity_contribution_pct')::numeric, 10.00)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all 9 tables
alter table public.profiles enable row level security;
alter table public.charities enable row level security;
alter table public.charity_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.golf_scores enable row level security;
alter table public.draws enable row level security;
alter table public.draw_entries enable row level security;
alter table public.winners enable row level security;
alter table public.donations enable row level security;

-- ----------------------------------------------------------------------------
-- PROFILES RLS:
-- 1. Users can SELECT their own profile
-- 2. Admins can SELECT and UPDATE profiles
-- 3. NO generic user UPDATE policy to prevent role escalation
-- ----------------------------------------------------------------------------
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "Admins can update profiles" on public.profiles
  for update using (public.is_admin());

-- ----------------------------------------------------------------------------
-- CHARITIES RLS:
-- 1. Public read for everyone
-- 2. Admins can INSERT, UPDATE, DELETE
-- ----------------------------------------------------------------------------
create policy "Anyone can view charities" on public.charities
  for select using (true);

create policy "Admins can insert charities" on public.charities
  for insert with check (public.is_admin());

create policy "Admins can update charities" on public.charities
  for update using (public.is_admin());

create policy "Admins can delete charities" on public.charities
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- CHARITY EVENTS RLS:
-- 1. Public read
-- 2. Admins manage
-- ----------------------------------------------------------------------------
create policy "Anyone can view charity events" on public.charity_events
  for select using (true);

create policy "Admins can manage charity events" on public.charity_events
  for all using (public.is_admin());

-- ----------------------------------------------------------------------------
-- SUBSCRIPTIONS RLS:
-- 1. Users can view own subscriptions
-- 2. Admins can view/manage all subscriptions
-- ----------------------------------------------------------------------------
create policy "Users can view own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id or public.is_admin());

create policy "Admins can manage subscriptions" on public.subscriptions
  for all using (public.is_admin());

-- ----------------------------------------------------------------------------
-- GOLF SCORES RLS:
-- 1. Users can view, insert, update, delete own scores
-- 2. Admins can also view/manage scores (PRD: Edit golf scores)
-- ----------------------------------------------------------------------------
create policy "Users can view own scores" on public.golf_scores
  for select using (auth.uid() = user_id or public.is_admin());

create policy "Users can insert own scores" on public.golf_scores
  for insert with check (auth.uid() = user_id or public.is_admin());

create policy "Users can update own scores" on public.golf_scores
  for update using (auth.uid() = user_id or public.is_admin());

create policy "Users can delete own scores" on public.golf_scores
  for delete using (auth.uid() = user_id or public.is_admin());

-- ----------------------------------------------------------------------------
-- DRAWS RLS:
-- 1. Anyone can view published draws
-- 2. Admins can manage all draws (create, simulate, publish)
-- ----------------------------------------------------------------------------
create policy "Anyone can view published draws" on public.draws
  for select using (status = 'published' or public.is_admin());

create policy "Admins can manage draws" on public.draws
  for all using (public.is_admin());

-- ----------------------------------------------------------------------------
-- DRAW ENTRIES RLS:
-- 1. Users can view their own entries
-- 2. Admins can view all entries
-- ----------------------------------------------------------------------------
create policy "Users can view own draw entries" on public.draw_entries
  for select using (auth.uid() = user_id or public.is_admin());

create policy "Admins can manage draw entries" on public.draw_entries
  for all using (public.is_admin());

-- ----------------------------------------------------------------------------
-- WINNERS RLS:
-- 1. Users can SELECT their own winners records
-- 2. Admins can manage winners (review, approve/reject, payout)
-- 3. NO generic user UPDATE policy (proof submissions are processed server-side)
-- ----------------------------------------------------------------------------
create policy "Users can view own winnings" on public.winners
  for select using (auth.uid() = user_id or public.is_admin());

create policy "Admins can manage winners" on public.winners
  for all using (public.is_admin());

-- ----------------------------------------------------------------------------
-- DONATIONS RLS:
-- 1. Users can view own donations
-- 2. Admins can view all donations
-- ----------------------------------------------------------------------------
create policy "Users can view own donations" on public.donations
  for select using (auth.uid() = user_id or public.is_admin());

create policy "Admins can view all donations" on public.donations
  for select using (public.is_admin());
