-- Add bio column to profiles
alter table public.profiles add column if not exists bio text default '';
