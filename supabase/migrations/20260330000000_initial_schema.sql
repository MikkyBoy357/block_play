-- BlockPlay Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  display_name text,
  avatar_url text,
  subscription_tier text check (subscription_tier in ('weekly', 'monthly', 'yearly')) default null,
  subscription_expires_at timestamptz default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ============================================================
-- 2. GAME SESSIONS (persistent game history)
-- ============================================================
create table if not exists public.game_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  game_slug text not null,
  score integer not null default 0,
  duration_ms integer default 0,
  actions integer default 0,
  verified boolean default true,
  qualified boolean default false,
  earned numeric(10,2) default 0,
  created_at timestamptz default now()
);

alter table public.game_sessions enable row level security;

create policy "Users can view own sessions"
  on public.game_sessions for select using (auth.uid() = user_id);

create policy "Anyone can view sessions for leaderboard"
  on public.game_sessions for select using (true);

create policy "Users can insert own sessions"
  on public.game_sessions for insert with check (auth.uid() = user_id);

-- Index for leaderboard queries
create index if not exists idx_game_sessions_leaderboard
  on public.game_sessions (game_slug, score desc, created_at desc);

create index if not exists idx_game_sessions_user
  on public.game_sessions (user_id, created_at desc);

-- ============================================================
-- 3. WEEKLY EARNINGS (server-side cap tracking)
-- ============================================================
create table if not exists public.weekly_earnings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_start date not null,
  total_earned numeric(10,2) default 0,
  plays integer default 0,
  updated_at timestamptz default now(),
  unique(user_id, week_start)
);

alter table public.weekly_earnings enable row level security;

create policy "Users can view own earnings"
  on public.weekly_earnings for select using (auth.uid() = user_id);

create policy "Users can upsert own earnings"
  on public.weekly_earnings for insert with check (auth.uid() = user_id);

create policy "Users can update own earnings"
  on public.weekly_earnings for update using (auth.uid() = user_id);

-- ============================================================
-- 4. FUNCTION: Auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: fire on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 5. VIEW: Leaderboard (top scores per game, this week)
-- ============================================================
create or replace view public.weekly_leaderboard as
select
  gs.game_slug,
  gs.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  max(gs.score) as high_score,
  count(*) as games_played,
  sum(gs.earned) as total_earned,
  max(gs.created_at) as last_played
from public.game_sessions gs
join public.profiles p on p.id = gs.user_id
where gs.created_at >= date_trunc('week', now())
group by gs.game_slug, gs.user_id, p.username, p.display_name, p.avatar_url;

-- ============================================================
-- 6. VIEW: Recent winners (for live ticker)
-- ============================================================
create or replace view public.recent_winners as
select
  gs.id,
  gs.game_slug,
  gs.score,
  gs.earned,
  gs.created_at,
  p.username,
  p.display_name,
  p.avatar_url
from public.game_sessions gs
join public.profiles p on p.id = gs.user_id
where gs.qualified = true and gs.earned > 0
order by gs.created_at desc
limit 50;

-- ============================================================
-- 7. VIEW: Platform stats (for live ticker)
-- ============================================================
create or replace view public.platform_stats as
select
  (select count(*) from public.game_sessions where created_at >= now() - interval '24 hours') as games_today,
  (select count(distinct user_id) from public.game_sessions where created_at >= now() - interval '15 minutes') as playing_now,
  (select coalesce(sum(earned), 0) from public.game_sessions where created_at >= date_trunc('week', now())) as weekly_prize_pool;
