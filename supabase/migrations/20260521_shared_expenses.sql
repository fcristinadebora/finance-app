-- ============================================================
-- Shared Expenses module
-- ============================================================

-- 1. Create shared_expenses table
create table public.shared_expenses (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  title        text        not null,
  extra_info   text,
  participants text[]      not null default '{}',
  share_token  text        not null unique,
  created_at   timestamptz not null default now()
);

-- 2. RLS: only the owner can read/write their own shares
alter table public.shared_expenses enable row level security;

create policy "shared_expenses_owner_all"
  on public.shared_expenses
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Add share_id to transactions (nullable FK)
alter table public.transactions
  add column share_id uuid references public.shared_expenses(id) on delete set null;

-- 4. Public RPC: get a share + its transactions by token (no auth needed)
--    Uses security definer so it bypasses RLS and works for anonymous callers.
create or replace function public.get_share_by_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share  public.shared_expenses%rowtype;
  v_txs    json;
begin
  select * into v_share
  from public.shared_expenses
  where share_token = p_token;

  if not found then
    return null;
  end if;

  select json_agg(
    json_build_object(
      'id',           t.id,
      'description',  t.description,
      'amount',       t.amount,
      'occurred_on',  t.occurred_on,
      'kind',         t.kind,
      'notes',        t.notes,
      'category_id',  t.category_id
    )
    order by t.occurred_on desc, t.created_at desc
  ) into v_txs
  from public.transactions t
  where t.share_id = v_share.id;

  return json_build_object(
    'id',           v_share.id,
    'title',        v_share.title,
    'extra_info',   v_share.extra_info,
    'participants', v_share.participants,
    'share_token',  v_share.share_token,
    'created_at',   v_share.created_at,
    'transactions', coalesce(v_txs, '[]'::json)
  );
end;
$$;

-- Allow anonymous/authenticated users to call the function
grant execute on function public.get_share_by_token(text) to anon, authenticated;
