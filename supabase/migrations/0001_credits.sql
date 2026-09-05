-- Credits, the welcome gift, and the plan record.
--
-- Run this once in the Supabase SQL editor (Database → SQL Editor → New query).
--
-- The security model matters more than the schema here. This project ships only
-- the publishable key, so every statement a browser can reach runs as `anon` or
-- `authenticated` under row level security. Therefore:
--
--   * `wallets` and `credit_ledger` grant SELECT on your own rows and nothing
--     else. There is deliberately no INSERT, UPDATE, or DELETE policy, so a
--     forged request cannot top up a balance or erase a charge.
--   * Every mutation goes through a SECURITY DEFINER function that derives the
--     user from `auth.uid()` and never from an argument. A caller cannot name
--     someone else's wallet because there is no parameter for it.
--   * Each function sets `search_path = ''` and fully qualifies every name. A
--     SECURITY DEFINER function without that can be hijacked by a caller who
--     creates a same-named object in a schema earlier on the path.
--
-- Amounts are integer cents everywhere. Floating-point money drifts, and a
-- drifting balance is a support ticket.

-- ─────────────────────────────────────────────────────────────────────────────
-- Mailbox identity
-- ─────────────────────────────────────────────────────────────────────────────

-- Collapses every alias of one Gmail mailbox onto a single key.
--
-- Gmail ignores dots in the local part and everything after a `+`, so
-- `j.o.h.n+free@gmail.com` and `john@gmail.com` are one inbox. Without this, one
-- mailbox mints unlimited accounts and unlimited welcome credit.
--
-- Returns NULL for anything outside the accepted domains, which is what makes it
-- usable as a gate: no fingerprint, no gift.
create or replace function public.mailbox_fingerprint(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_email is null then null
    when lower(split_part(p_email, '@', 2)) not in ('gmail.com', 'googlemail.com')
      then null
    else nullif(
      replace(split_part(split_part(lower(trim(p_email)), '@', 1), '+', 1), '.', ''),
      ''
    ) || '@gmail.com'
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance_cents integer not null default 0 check (balance_cents >= 0),
  -- Which plan is paying, and until when. NULL means the free tier.
  plan_id text check (plan_id in ('go', 'premium', 'premium_plus')),
  plan_renews_at timestamptz,
  -- Set the moment the welcome gift is granted, so it can only happen once.
  welcome_granted_at timestamptz,
  -- Set when the user dismisses or claims the gift modal, so it stops appearing.
  welcome_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wallets is
  'One row per user: credit balance in cents, plan, and welcome-gift state.';

-- One welcome gift per real mailbox, enforced by the database rather than by
-- application logic that a second concurrent request could race past.
create table if not exists public.welcome_grants (
  fingerprint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);

comment on table public.welcome_grants is
  'Claimed welcome gifts, keyed by normalised mailbox. The primary key is the guard.';

-- Append-only history. Every change to a balance leaves a row, so a disputed
-- total can be reconstructed instead of argued about.
create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Positive credits, negative debits.
  amount_cents integer not null check (amount_cents <> 0),
  reason text not null check (
    reason in ('welcome', 'plan', 'topup', 'generation', 'adjustment', 'refund')
  ),
  -- Free-form context: model id, run kind, plan id. Never anything secret.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.wallets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.welcome_grants enable row level security;

-- Read-only, own rows. Mutations are the SECURITY DEFINER functions' job.
drop policy if exists "own wallet is readable" on public.wallets;
create policy "own wallet is readable"
  on public.wallets for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own ledger is readable" on public.credit_ledger;
create policy "own ledger is readable"
  on public.credit_ledger for select
  to authenticated
  using (auth.uid() = user_id);

-- `welcome_grants` maps mailboxes to accounts, so it gets no policy at all: not
-- even the owner reads it. Only the definer functions below touch it.

-- ─────────────────────────────────────────────────────────────────────────────
-- Wallet provisioning
-- ─────────────────────────────────────────────────────────────────────────────

-- Creates the wallet row for a new user.
--
-- The gift is NOT granted here. A trigger on `auth.users` runs inside the sign-up
-- transaction, and an exception there fails the sign-up itself — so this does the
-- one thing that cannot fail, and the gift is claimed later by an explicit call.
create or replace function public.provision_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_provision_wallet on auth.users;
create trigger on_auth_user_created_provision_wallet
  after insert on auth.users
  for each row execute function public.provision_wallet();

-- ─────────────────────────────────────────────────────────────────────────────
-- The welcome gift
-- ─────────────────────────────────────────────────────────────────────────────

-- Grants $5 once per mailbox, and reports what happened.
--
-- Returns the wallet state plus `granted`, so one round trip both claims the gift
-- and tells the UI whether to celebrate. Idempotent: calling it twice is a no-op
-- that returns `granted = false`, which matters because the modal's claim button
-- can be double-clicked and a page can be reloaded mid-flow.
--
-- `p_amount_cents` is validated rather than trusted — it arrives from server code
-- today, but a SECURITY DEFINER function must not assume its caller is honest.
create or replace function public.claim_welcome_grant(p_amount_cents integer default 500)
returns table (balance_cents integer, granted boolean, already_claimed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_fingerprint text;
  v_granted boolean := false;
  v_balance integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 500 then
    raise exception 'invalid grant amount' using errcode = '22023';
  end if;

  insert into public.wallets (user_id) values (v_user_id)
  on conflict (user_id) do nothing;

  -- Serialise concurrent claims for this user: two tabs finishing sign-in at once
  -- would otherwise both read `welcome_granted_at IS NULL` and both grant.
  select w.balance_cents into v_balance
  from public.wallets w
  where w.user_id = v_user_id
  for update;

  if exists (
    select 1 from public.wallets w
    where w.user_id = v_user_id and w.welcome_granted_at is not null
  ) then
    return query
      select v_balance, false, true;
    return;
  end if;

  select u.email into v_email from auth.users u where u.id = v_user_id;
  v_fingerprint := public.mailbox_fingerprint(v_email);

  -- No usable mailbox means no gift, and no error either: the account still works,
  -- it simply starts empty.
  if v_fingerprint is null then
    return query select v_balance, false, false;
    return;
  end if;

  -- The primary key is the real guard. A second account on the same mailbox
  -- conflicts here and silently gets nothing.
  insert into public.welcome_grants (fingerprint, user_id)
  values (v_fingerprint, v_user_id)
  on conflict (fingerprint) do nothing;

  if found then
    v_granted := true;
  end if;

  if v_granted then
    update public.wallets w
    set balance_cents = w.balance_cents + p_amount_cents,
        welcome_granted_at = now(),
        updated_at = now()
    where w.user_id = v_user_id
    returning w.balance_cents into v_balance;

    insert into public.credit_ledger (user_id, amount_cents, reason, metadata)
    values (v_user_id, p_amount_cents, 'welcome', jsonb_build_object('fingerprint', v_fingerprint));
  else
    -- Mailbox already used. Mark it claimed so the modal never shows again.
    update public.wallets w
    set welcome_granted_at = now(), updated_at = now()
    where w.user_id = v_user_id
    returning w.balance_cents into v_balance;
  end if;

  return query select v_balance, v_granted, not v_granted;
end;
$$;

-- Records that the user has seen the gift, so it stops appearing.
create or replace function public.mark_welcome_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.wallets w
  set welcome_seen_at = now(), updated_at = now()
  where w.user_id = v_user_id and w.welcome_seen_at is null;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Charging for a run
-- ─────────────────────────────────────────────────────────────────────────────

-- Debits a generation, atomically, or reports that it cannot be afforded.
--
-- Written as one statement with a `WHERE balance_cents >= amount` guard rather
-- than read-then-write. Two concurrent generations on one balance would otherwise
-- both read "enough" and both deduct, and the CHECK constraint would turn the
-- second into a 500 after the work was already done.
--
-- `p_reference` makes the call idempotent. A retried request carrying the same
-- reference is charged once, which is what stops a dropped connection from
-- billing twice for one project.
create or replace function public.debit_credits(
  p_amount_cents integer,
  p_reason text default 'generation',
  p_metadata jsonb default '{}'::jsonb,
  p_reference text default null
)
returns table (balance_cents integer, charged boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 10000 then
    raise exception 'invalid debit amount' using errcode = '22023';
  end if;
  if p_reason not in ('generation', 'adjustment') then
    raise exception 'invalid debit reason' using errcode = '22023';
  end if;

  if p_reference is not null then
    v_meta := v_meta || jsonb_build_object('reference', p_reference);

    -- Already charged under this reference: report success without double billing.
    if exists (
      select 1 from public.credit_ledger l
      where l.user_id = v_user_id
        and l.metadata ->> 'reference' = p_reference
    ) then
      select w.balance_cents into v_balance
      from public.wallets w where w.user_id = v_user_id;
      return query select coalesce(v_balance, 0), true;
      return;
    end if;
  end if;

  update public.wallets w
  set balance_cents = w.balance_cents - p_amount_cents,
      updated_at = now()
  where w.user_id = v_user_id
    and w.balance_cents >= p_amount_cents
  returning w.balance_cents into v_balance;

  if v_balance is null then
    -- Not enough credit (or no wallet). Report the real balance so the caller can
    -- say how short the user is.
    select w.balance_cents into v_balance
    from public.wallets w where w.user_id = v_user_id;
    return query select coalesce(v_balance, 0), false;
    return;
  end if;

  insert into public.credit_ledger (user_id, amount_cents, reason, metadata)
  values (v_user_id, -p_amount_cents, p_reason, v_meta);

  return query select v_balance, true;
end;
$$;

-- Refunds a charge when the work failed after it was billed.
create or replace function public.refund_credits(
  p_amount_cents integer,
  p_reference text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 10000 then
    raise exception 'invalid refund amount' using errcode = '22023';
  end if;

  -- Only refund something that was actually charged under this reference, so a
  -- replayed call cannot mint credit.
  if p_reference is not null and not exists (
    select 1 from public.credit_ledger l
    where l.user_id = v_user_id
      and l.reason = 'generation'
      and l.metadata ->> 'reference' = p_reference
  ) then
    select w.balance_cents into v_balance from public.wallets w where w.user_id = v_user_id;
    return coalesce(v_balance, 0);
  end if;

  if p_reference is not null and exists (
    select 1 from public.credit_ledger l
    where l.user_id = v_user_id
      and l.reason = 'refund'
      and l.metadata ->> 'reference' = p_reference
  ) then
    select w.balance_cents into v_balance from public.wallets w where w.user_id = v_user_id;
    return coalesce(v_balance, 0);
  end if;

  update public.wallets w
  set balance_cents = w.balance_cents + p_amount_cents, updated_at = now()
  where w.user_id = v_user_id
  returning w.balance_cents into v_balance;

  insert into public.credit_ledger (user_id, amount_cents, reason, metadata)
  values (
    v_user_id,
    p_amount_cents,
    'refund',
    case when p_reference is null then '{}'::jsonb
         else jsonb_build_object('reference', p_reference) end
  );

  return coalesce(v_balance, 0);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────────

-- `anon` gets nothing: every function derives the user from `auth.uid()`, so an
-- unauthenticated call could only ever raise.
revoke all on function public.claim_welcome_grant(integer) from public, anon;
revoke all on function public.mark_welcome_seen() from public, anon;
revoke all on function public.debit_credits(integer, text, jsonb, text) from public, anon;
revoke all on function public.refund_credits(integer, text) from public, anon;

grant execute on function public.claim_welcome_grant(integer) to authenticated;
grant execute on function public.mark_welcome_seen() to authenticated;
grant execute on function public.debit_credits(integer, text, jsonb, text) to authenticated;
grant execute on function public.refund_credits(integer, text) to authenticated;

-- Backfills wallets for accounts that existed before this migration.
insert into public.wallets (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;
