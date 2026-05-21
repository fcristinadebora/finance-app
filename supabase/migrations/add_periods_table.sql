-- Salary periods: each row marks the start of a new pay period.
-- The current period runs from the most recent started_on to today.
-- The previous period runs from the second-most-recent started_on
-- to the day before the most recent started_on.

create table if not exists periods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  started_on  date not null,
  label       text,
  created_at  timestamptz default now() not null
);

alter table periods enable row level security;

create policy "Users can manage their own periods"
  on periods
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
