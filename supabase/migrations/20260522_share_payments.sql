-- ============================================================
-- Share payments tracking
-- ============================================================

-- 1. Payments table
--    payers[] = participant names who jointly made this payment.
--    Each payer is credited amount / payers.length.
create table public.share_payments (
  id         uuid        primary key default gen_random_uuid(),
  share_id   uuid        not null references public.shared_expenses(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  payers     text[]      not null,
  amount     numeric     not null check (amount > 0),
  paid_on    date        not null default current_date,
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.share_payments enable row level security;

create policy "share_payments_owner_all"
  on public.share_payments
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.share_payments to authenticated;

-- 2. Update public RPC to include payments in the response
create or replace function public.get_share_by_token(p_token text, p_password text default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_share    public.shared_expenses%rowtype;
  v_txs      json;
  v_payments json;
begin
  select * into v_share
  from public.shared_expenses
  where share_token = p_token;

  if not found then
    return null;
  end if;

  -- Password check
  if v_share.password is not null then
    if p_password is null or crypt(p_password, v_share.password) <> v_share.password then
      return null;
    end if;
  end if;

  -- Transactions linked to this share
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

  -- Payments for this share
  select json_agg(
    json_build_object(
      'id',       p.id,
      'payers',   p.payers,
      'amount',   p.amount,
      'paid_on',  p.paid_on,
      'notes',    p.notes
    )
    order by p.paid_on desc, p.created_at desc
  ) into v_payments
  from public.share_payments p
  where p.share_id = v_share.id;

  return json_build_object(
    'id',           v_share.id,
    'title',        v_share.title,
    'extra_info',   v_share.extra_info,
    'participants', v_share.participants,
    'share_token',  v_share.share_token,
    'created_at',   v_share.created_at,
    'transactions', coalesce(v_txs,      '[]'::json),
    'payments',     coalesce(v_payments, '[]'::json)
  );
end;
$$;

grant execute on function public.get_share_by_token(text, text) to anon, authenticated;
