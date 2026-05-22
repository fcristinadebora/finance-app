-- ============================================================
-- Share password gate
-- ============================================================

-- pgcrypto is already enabled in Supabase by default.
-- If not: create extension if not exists pgcrypto schema extensions;

-- 1. Add nullable password column (stores bcrypt hash)
alter table public.shared_expenses
  add column if not exists password text;

-- 2. Trigger: auto-hash plain-text password on insert/update
--    - empty string  → null  (removes password)
--    - non-null string → bcrypt hash
--    - null           → null  (no password / keep as-is via partial update)
create or replace function public.hash_share_password()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.password = '' then
    new.password := null;
  elsif new.password is not null then
    new.password := crypt(new.password, gen_salt('bf', 8));
  end if;
  return new;
end;
$$;

drop trigger if exists share_password_hash_trigger on public.shared_expenses;
create trigger share_password_hash_trigger
  before insert or update of password
  on public.shared_expenses
  for each row
  execute function public.hash_share_password();

-- 3. Lightweight public metadata endpoint (no auth, no sensitive data)
--    Returns: { title, requires_password } or null if not found
create or replace function public.get_share_meta(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.shared_expenses%rowtype;
begin
  select * into v_share
  from public.shared_expenses
  where share_token = p_token;

  if not found then
    return null;
  end if;

  return json_build_object(
    'title',              v_share.title,
    'requires_password',  v_share.password is not null
  );
end;
$$;

grant execute on function public.get_share_meta(text) to anon, authenticated;

-- 4. Replace get_share_by_token to support optional password verification
--    Returns: full share JSON on success, or null on wrong/missing password
create or replace function public.get_share_by_token(p_token text, p_password text default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
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

  -- If this share has a password, verify it
  if v_share.password is not null then
    if p_password is null or crypt(p_password, v_share.password) <> v_share.password then
      return null;
    end if;
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

grant execute on function public.get_share_by_token(text, text) to anon, authenticated;
