begin;

create table public.player_invitation_credits (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  available integer not null default 0 check (available >= 0),
  updated_at timestamptz not null default now()
);

create table public.invitation_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (reason in (
    'initial_allocation', 'invitation_created', 'invitation_refund',
    'request_approved', 'admin_grant', 'admin_set'
  )),
  invitation_id uuid,
  request_id uuid,
  admin_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.player_invitations (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('player', 'admin')),
  inviter_id uuid references public.profiles(id) on delete set null,
  issued_by_admin uuid references auth.users(id) on delete set null,
  target_email text,
  status text not null default 'pending' check (status in (
    'pending', 'submitted', 'approved', 'rejected', 'redeemed',
    'revoked', 'expired'
  )),
  application_id uuid unique references public.applications(id) on delete set null,
  redeemed_by uuid references auth.users(id) on delete set null,
  authorized_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  check (
    (kind = 'player' and inviter_id is not null and issued_by_admin is null and target_email is null)
    or
    (kind = 'admin' and inviter_id is null and issued_by_admin is not null and target_email is not null)
  )
);

alter table public.applications
  add column invitation_id uuid unique references public.player_invitations(id) on delete set null;

alter table public.invitation_credit_transactions
  add constraint invitation_credit_transactions_invitation_fk
  foreign key (invitation_id) references public.player_invitations(id) on delete set null;

create table public.invitation_credit_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  requested integer not null check (requested between 1 and 20),
  explanation text check (length(explanation) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  granted integer check (granted between 0 and 20),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index invitation_credit_requests_one_pending_per_player
  on public.invitation_credit_requests(player_id) where status = 'pending';
create index player_invitations_inviter_created_idx
  on public.player_invitations(inviter_id, created_at desc);
create index player_invitations_status_expiry_idx
  on public.player_invitations(status, expires_at);
create index invitation_credit_transactions_player_created_idx
  on public.invitation_credit_transactions(player_id, created_at desc);
create index invitation_credit_requests_status_created_idx
  on public.invitation_credit_requests(status, created_at desc);

create table public.admin_email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  subject text not null check (length(subject) between 1 and 200),
  html_body text not null check (length(html_body) <= 20000),
  text_body text not null check (length(text_body) <= 10000),
  is_builtin boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index admin_email_templates_builtin_name_idx
  on public.admin_email_templates(name) where is_builtin;

create table public.admin_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  subject text not null check (length(subject) between 1 and 200),
  recipient_count integer not null check (recipient_count between 1 and 10),
  status text not null check (status in ('sending', 'sent', 'failed')),
  provider_status integer check (provider_status between 100 and 599),
  created_at timestamptz not null default now()
);
create index admin_email_deliveries_created_idx
  on public.admin_email_deliveries(created_at desc);

create or replace function public.is_verified_scamtastic_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_scamtastic_admin() and exists (
    select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null
  )
$$;

alter table public.player_invitation_credits enable row level security;
alter table public.invitation_credit_transactions enable row level security;
alter table public.player_invitations enable row level security;
alter table public.invitation_credit_requests enable row level security;
alter table public.admin_email_templates enable row level security;
alter table public.admin_email_deliveries enable row level security;

revoke all on public.player_invitation_credits, public.invitation_credit_transactions,
  public.player_invitations, public.invitation_credit_requests,
  public.admin_email_templates, public.admin_email_deliveries from public, anon, authenticated;
grant all on public.player_invitation_credits, public.invitation_credit_transactions,
  public.player_invitations, public.invitation_credit_requests,
  public.admin_email_templates, public.admin_email_deliveries to service_role;

create or replace function public.initialize_player_invitation_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.player_invitation_credits(player_id, available)
    values (new.id, 5) on conflict (player_id) do nothing;
  if found then
    insert into public.invitation_credit_transactions(player_id, amount, reason, idempotency_key)
      values (new.id, 5, 'initial_allocation', 'initial:' || new.id::text)
      on conflict (idempotency_key) do nothing;
  end if;
  return new;
end
$$;

drop trigger if exists initialize_player_invitation_credits on public.profiles;
create trigger initialize_player_invitation_credits
  after insert on public.profiles
  for each row execute function public.initialize_player_invitation_credits();

insert into public.player_invitation_credits(player_id, available)
  select id, 5 from public.profiles
  on conflict (player_id) do nothing;
insert into public.invitation_credit_transactions(player_id, amount, reason, idempotency_key)
  select id, 5, 'initial_allocation', 'initial:' || id::text from public.profiles
  on conflict (idempotency_key) do nothing;

create or replace function public.expire_player_invitations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with expired as (
    update public.player_invitations
      set status = 'expired'
      where kind = 'player' and status = 'pending' and expires_at <= now()
      returning id, inviter_id
  ), refunds as (
    insert into public.invitation_credit_transactions(
      player_id, amount, reason, invitation_id, idempotency_key
    )
    select inviter_id, 1, 'invitation_refund', id, 'refund:' || id::text
      from expired where inviter_id is not null
    on conflict (idempotency_key) do nothing
    returning player_id
  ), refund_totals as (
    select player_id, count(*)::integer as amount from refunds group by player_id
  )
  update public.player_invitation_credits c
    set available = c.available + r.amount, updated_at = now()
    from refund_totals r where c.player_id = r.player_id;
  update public.player_invitations
    set status = 'expired'
    where kind = 'admin' and status = 'pending' and expires_at <= now();
end
$$;

create or replace function public.create_player_invitation(p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := auth.uid();
  v_invitation public.player_invitations%rowtype;
begin
  perform public.expire_player_invitations();
  if v_player is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid invitation request';
  end if;
  if exists (select 1 from public.profiles where id = v_player and is_banned) then
    raise exception using errcode = '42501', message = 'Suspended players cannot invite';
  end if;
  perform 1 from public.player_invitation_credits
    where player_id = v_player for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Invitation credits are unavailable';
  end if;
  if (select available from public.player_invitation_credits where player_id = v_player) < 1 then
    raise exception using errcode = 'P0001', message = 'No invitation credits remain';
  end if;
  if exists (select 1 from public.player_invitations where code_hash = p_code_hash) then
    raise exception using errcode = '23505', message = 'Invitation already exists';
  end if;
  insert into public.player_invitations(code_hash, kind, inviter_id)
    values (p_code_hash, 'player', v_player) returning * into v_invitation;
  update public.player_invitation_credits set available = available - 1, updated_at = now()
    where player_id = v_player;
  insert into public.invitation_credit_transactions(
    player_id, amount, reason, invitation_id, idempotency_key
  ) values (
    v_player, -1, 'invitation_created', v_invitation.id,
    'created:' || v_invitation.id::text
  );
  return jsonb_build_object('id', v_invitation.id, 'expires_at', v_invitation.expires_at);
end
$$;

create or replace function public.my_invitation_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := auth.uid();
begin
  if v_player is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  perform public.expire_player_invitations();
  return jsonb_build_object(
    'available', coalesce((select available from public.player_invitation_credits where player_id = v_player), 0),
    'total', (select count(*) from public.player_invitations where inviter_id = v_player),
    'pending', (select count(*) from public.player_invitations
      where inviter_id = v_player and status in ('pending', 'submitted', 'approved')),
    'successful', (select count(*) from public.player_invitations where inviter_id = v_player and status = 'redeemed'),
    'closed', (select count(*) from public.player_invitations
      where inviter_id = v_player and status in ('expired', 'revoked', 'rejected')),
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'requested', requested, 'explanation', explanation, 'status', status,
      'granted', granted, 'created_at', created_at
    ) order by created_at desc) from public.invitation_credit_requests where player_id = v_player), '[]'::jsonb),
    'invitations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'status', status, 'created_at', created_at, 'expires_at', expires_at
    ) order by created_at desc) from public.player_invitations where inviter_id = v_player), '[]'::jsonb)
  );
end
$$;

create or replace function public.revoke_player_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := auth.uid();
  v_invitation public.player_invitations%rowtype;
begin
  if v_player is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into v_invitation from public.player_invitations
    where id = p_invitation_id and inviter_id = v_player and kind = 'player'
    for update;
  if not found or v_invitation.status <> 'pending' then return false; end if;
  update public.player_invitations set status = 'revoked' where id = v_invitation.id;
  update public.player_invitation_credits set available = available + 1, updated_at = now()
    where player_id = v_player;
  insert into public.invitation_credit_transactions(
    player_id, amount, reason, invitation_id, idempotency_key
  ) values (
    v_player, 1, 'invitation_refund', v_invitation.id,
    'refund:' || v_invitation.id::text
  ) on conflict (idempotency_key) do nothing;
  return true;
end
$$;

create or replace function public.request_invitation_credits(p_requested integer, p_explanation text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := auth.uid();
  v_id uuid;
begin
  if v_player is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if p_requested not between 1 and 20 or length(coalesce(p_explanation, '')) > 1000 then
    raise exception using errcode = '22023', message = 'Invalid credit request';
  end if;
  if exists (select 1 from public.invitation_credit_requests
      where player_id = v_player and created_at > now() - interval '7 days') then
    raise exception using errcode = 'P0001', message = 'Credit request rate limit exceeded';
  end if;
  insert into public.invitation_credit_requests(player_id, requested, explanation)
    values (v_player, p_requested, nullif(btrim(p_explanation), ''))
    returning id into v_id;
  return v_id;
end
$$;

create or replace function public.invitation_preview(p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.player_invitations%rowtype;
  v_profile record;
begin
  perform public.expire_player_invitations();
  if p_code_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into v_invitation from public.player_invitations where code_hash = p_code_hash;
  if not found then return null; end if;
  if v_invitation.status in ('expired', 'revoked', 'redeemed', 'rejected') then
    return jsonb_build_object(
      'kind', v_invitation.kind, 'status', v_invitation.status,
      'expires_at', v_invitation.expires_at
    );
  end if;
  if v_invitation.status not in ('pending', 'submitted', 'approved')
      or v_invitation.expires_at <= now() then return null; end if;
  if v_invitation.kind = 'admin' then
    return jsonb_build_object('kind', 'admin', 'status', v_invitation.status,
      'expires_at', v_invitation.expires_at);
  end if;
  select username, display_name, avatar_seed, avatar_generator_version
    into v_profile from public.profiles where id = v_invitation.inviter_id and not is_banned;
  if not found then return null; end if;
  return jsonb_build_object(
    'kind', 'player', 'status', v_invitation.status, 'expires_at', v_invitation.expires_at,
    'inviter', jsonb_build_object(
      'username', v_profile.username, 'display_name', v_profile.display_name,
      'avatar_seed', v_profile.avatar_seed,
      'avatar_version', v_profile.avatar_generator_version
    )
  );
end
$$;

create or replace function public.admin_issue_invitation(p_code_hash text, p_email text, p_expires_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  perform public.expire_player_invitations();
  if p_code_hash is null or p_email is null
    or p_code_hash !~ '^[0-9a-f]{64}$' or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(p_email) > 254 or p_expires_days not between 1 and 90 then
    raise exception using errcode = '22023', message = 'Invalid administrator invitation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_admin::text || ':admin-invites', 0));
  if (select count(*) from public.player_invitations
      where issued_by_admin = v_admin and created_at > now() - interval '1 hour') >= 20 then
    raise exception using errcode = 'P0001', message = 'Administrator invitation rate limit exceeded';
  end if;
  insert into public.player_invitations(
    code_hash, kind, issued_by_admin, target_email, authorized_at, expires_at
  ) values (
    p_code_hash, 'admin', v_admin, lower(btrim(p_email)), now(),
    now() + make_interval(days => p_expires_days)
  ) returning id into v_id;
  perform public.audit_scamtastic_action(v_admin, 'admin_invitation_issued',
    'invitation', v_id::text, jsonb_build_object('expires_days', p_expires_days));
  return jsonb_build_object('id', v_id, 'expires_at', now() + make_interval(days => p_expires_days));
end
$$;

create or replace function public.admin_revoke_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_invitation public.player_invitations%rowtype;
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  perform public.expire_player_invitations();
  select * into v_invitation from public.player_invitations where id = p_invitation_id for update;
  if not found or v_invitation.status <> 'pending' then return false; end if;
  update public.player_invitations set status = 'revoked' where id = v_invitation.id;
  if v_invitation.kind = 'player' and v_invitation.status = 'pending' then
    update public.player_invitation_credits set available = available + 1, updated_at = now()
      where player_id = v_invitation.inviter_id;
    insert into public.invitation_credit_transactions(
      player_id, amount, reason, invitation_id, admin_id, idempotency_key
    ) values (
      v_invitation.inviter_id, 1, 'invitation_refund', v_invitation.id, v_admin,
      'refund:' || v_invitation.id::text
    ) on conflict (idempotency_key) do nothing;
  end if;
  perform public.audit_scamtastic_action(v_admin, 'invitation_revoked',
    'invitation', v_invitation.id::text, jsonb_build_object('kind', v_invitation.kind));
  return true;
end
$$;

create or replace function public.admin_adjust_invitation_credits(
  p_player_id uuid, p_amount integer, p_operation text, p_operation_key text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_balance integer;
  v_transaction_id uuid;
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  if p_amount not between 0 and 10000 or p_operation not in ('grant', 'set')
    or p_operation_key is null or p_operation_key !~ '^[a-f0-9-]{36}$'
    or (p_operation = 'grant' and p_amount < 1) then
    raise exception using errcode = '22023', message = 'Invalid credit adjustment';
  end if;
  insert into public.player_invitation_credits(player_id, available)
    values (p_player_id, 0) on conflict (player_id) do nothing;
  perform 1 from public.player_invitation_credits where player_id = p_player_id for update;
  if exists (select 1 from public.invitation_credit_transactions
      where idempotency_key = 'admin:' || p_operation_key) then
    select available into v_balance from public.player_invitation_credits where player_id = p_player_id;
    return v_balance;
  end if;
  if p_operation = 'grant' then
    if p_amount > 0 then
      insert into public.invitation_credit_transactions(
        player_id, amount, reason, admin_id, idempotency_key
      ) values (p_player_id, p_amount, 'admin_grant', v_admin, 'admin:' || p_operation_key)
      on conflict (idempotency_key) do nothing
      returning id into v_transaction_id;
      if v_transaction_id is null then
        select available into v_balance from public.player_invitation_credits where player_id = p_player_id;
        return v_balance;
      end if;
    end if;
    update public.player_invitation_credits set available = available + p_amount, updated_at = now()
      where player_id = p_player_id returning available into v_balance;
  else
    select available into v_balance from public.player_invitation_credits where player_id = p_player_id;
    if p_amount <> v_balance then
      insert into public.invitation_credit_transactions(
        player_id, amount, reason, admin_id, idempotency_key
      ) values (
        p_player_id, p_amount - v_balance, 'admin_set', v_admin, 'admin:' || p_operation_key
      ) on conflict (idempotency_key) do nothing returning id into v_transaction_id;
      if v_transaction_id is null then
        select available into v_balance from public.player_invitation_credits where player_id = p_player_id;
        return v_balance;
      end if;
      update public.player_invitation_credits set available = p_amount, updated_at = now()
        where player_id = p_player_id returning available into v_balance;
    end if;
  end if;
  perform public.audit_scamtastic_action(v_admin, 'invitation_credits_' || p_operation,
    'player', p_player_id::text, jsonb_build_object('balance', v_balance));
  return v_balance;
end
$$;

create or replace function public.admin_review_credit_request(
  p_request_id uuid, p_status text, p_granted integer default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_request public.invitation_credit_requests%rowtype;
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  if p_status not in ('approved', 'denied') then raise exception using errcode = '22023', message = 'Invalid request decision'; end if;
  select * into v_request from public.invitation_credit_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then return false; end if;
  if p_status = 'approved' and coalesce(p_granted, v_request.requested) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'Invalid granted amount';
  end if;
  update public.invitation_credit_requests
    set status = p_status, granted = case when p_status = 'approved' then coalesce(p_granted, requested) else 0 end,
      reviewed_by = v_admin, reviewed_at = now()
    where id = p_request_id;
  if p_status = 'approved' then
    update public.player_invitation_credits set available = available + coalesce(p_granted, v_request.requested), updated_at = now()
      where player_id = v_request.player_id;
    insert into public.invitation_credit_transactions(
      player_id, amount, reason, request_id, admin_id, idempotency_key
    ) values (
      v_request.player_id, coalesce(p_granted, v_request.requested), 'request_approved',
      p_request_id, v_admin, 'request:' || p_request_id::text
    ) on conflict (idempotency_key) do nothing;
  end if;
  perform public.audit_scamtastic_action(v_admin, 'invitation_credit_request_' || p_status,
    'credit_request', p_request_id::text, jsonb_build_object('granted', p_granted));
  return true;
end
$$;

create or replace function public.claim_administrator_invitation(
  p_code_hash text, p_username text, p_display_name text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_invitation public.player_invitations%rowtype;
  v_username text := btrim(p_username);
begin
  if v_user is null or p_code_hash !~ '^[0-9a-f]{64}$'
    or v_username !~ '^[A-Za-z0-9_&-]{3,24}$'
    or length(coalesce(p_display_name, '')) > 80 then
    raise exception using errcode = '22023', message = 'Invalid activation request';
  end if;
  select lower(email) into v_email from auth.users
    where id = v_user and email_confirmed_at is not null;
  if v_email is null then raise exception using errcode = '42501', message = 'Verified email required'; end if;
  select * into v_invitation from public.player_invitations
    where code_hash = p_code_hash and kind = 'admin' for update;
  if not found or lower(v_invitation.target_email) <> v_email then
    raise exception using errcode = '42501', message = 'Invitation is invalid or expired';
  end if;
  if v_invitation.status = 'redeemed' and v_invitation.redeemed_by = v_user then
    return true;
  end if;
  if v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    raise exception using errcode = '42501', message = 'Invitation is invalid or expired';
  end if;
  if exists (select 1 from public.profiles where id = v_user) then
    update public.player_invitations set status = 'redeemed', redeemed_by = v_user, redeemed_at = now()
      where id = v_invitation.id;
    perform public.audit_scamtastic_action(v_invitation.issued_by_admin,
      'admin_invitation_redeemed', 'invitation', v_invitation.id::text, '{}'::jsonb);
    return true;
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(v_username))
    or exists (select 1 from public.applications where lower(username) = lower(v_username)
      and status in ('pending', 'approved'))
    or exists (select 1 from public.reserved_usernames where lower(username) = lower(v_username)) then
    raise exception using errcode = '23505', message = 'Username unavailable';
  end if;
  insert into public.profiles(id, username, display_name, bio, is_banned, created_at)
    values (v_user, v_username, nullif(btrim(p_display_name), ''), '', false, now());
  update public.player_invitations set status = 'redeemed', redeemed_by = v_user, redeemed_at = now()
    where id = v_invitation.id;
  perform public.audit_scamtastic_action(v_invitation.issued_by_admin,
    'admin_invitation_redeemed', 'invitation', v_invitation.id::text, '{}'::jsonb);
  return true;
end
$$;

create or replace function public.submit_invited_application(
  p_rate_key text, p_username text, p_email text, p_reason text,
  p_invitation_hash text, p_referral_code text default null, p_comments text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := btrim(p_username);
  v_email text := lower(btrim(p_email));
  v_invitation public.player_invitations%rowtype;
  v_referral public.referral_codes%rowtype;
  v_application_id uuid;
begin
  if coalesce(length(p_rate_key), 0) < 32
    or coalesce(v_username, '') !~ '^[A-Za-z0-9_&-]{3,24}$'
    or coalesce(v_email, '') !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    or length(v_email) > 254 or length(coalesce(p_reason, '')) not between 10 and 2000
    or length(coalesce(p_comments, '')) > 2000 then
    raise exception using errcode = '22023', message = 'Invalid application fields';
  end if;
  if p_invitation_hash is not null then
    if p_invitation_hash !~ '^[0-9a-f]{64}$' then
      raise exception using errcode = '22023', message = 'Invalid invitation code';
    end if;
    select * into v_invitation from public.player_invitations
      where code_hash = p_invitation_hash and kind = 'player' for update;
    if not found or v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
      raise exception using errcode = '22023', message = 'Invalid or expired invitation code';
    end if;
  end if;

  delete from public.application_rate_limits where attempted_at < now() - interval '2 days';
  perform pg_advisory_xact_lock(hashtextextended(p_rate_key, 0));
  if (select count(*) from public.application_rate_limits
      where rate_key = p_rate_key and attempted_at > now() - interval '1 hour') >= 5 then
    raise exception using errcode = 'P0001', message = 'Rate limit exceeded';
  end if;
  insert into public.application_rate_limits(rate_key) values (p_rate_key);

  if exists (select 1 from public.applications where lower(email) = v_email
      and status in ('pending', 'approved')) then return 'received'; end if;
  if exists (select 1 from public.profiles where lower(username) = lower(v_username))
    or exists (select 1 from public.applications where lower(username) = lower(v_username)
      and status in ('pending', 'approved'))
    or exists (select 1 from public.reserved_usernames where lower(username) = lower(v_username)) then
    return 'username_unavailable';
  end if;

  if nullif(btrim(p_referral_code), '') is not null then
    select * into v_referral from public.referral_codes
      where code = upper(btrim(p_referral_code)) and revoked_at is null for update;
    if not found or (select count(*) from public.referrals where referral_code_id = v_referral.id) >= v_referral.usage_limit then
      raise exception using errcode = '22023', message = 'Invalid referral code';
    end if;
  end if;

  begin
    insert into public.applications(username, email, reason, referral_code, comments, invitation_id)
      values (v_username, v_email, btrim(p_reason), nullif(upper(btrim(p_referral_code)), ''),
        nullif(btrim(p_comments), ''), v_invitation.id)
      returning id into v_application_id;
  exception when unique_violation then
    if exists (select 1 from public.profiles where lower(username) = lower(v_username))
      or exists (select 1 from public.applications where lower(username) = lower(v_username)
        and status in ('pending', 'approved'))
      or exists (select 1 from public.reserved_usernames where lower(username) = lower(v_username)) then
      return 'username_unavailable';
    end if;
    if exists (select 1 from public.applications where lower(email) = v_email
        and status in ('pending', 'approved')) then return 'received'; end if;
    raise;
  end;
  if v_referral.id is not null then
    insert into public.referrals(application_id, referral_code_id)
      values (v_application_id, v_referral.id);
  end if;
  if v_invitation.id is not null then
    update public.player_invitations set application_id = v_application_id, status = 'submitted'
      where id = v_invitation.id;
  end if;
  return 'received';
end
$$;

create or replace function public.v040_application_invitation_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.player_invitations%rowtype;
  v_inviter uuid;
  v_player_a uuid;
  v_player_b uuid;
begin
  if (old.status is distinct from new.status
      or old.activation_status is distinct from new.activation_status)
      and new.invitation_id is not null then
    select * into v_invitation from public.player_invitations where id = new.invitation_id for update;
    if new.status = 'rejected' and old.status in ('pending', 'approved')
      and v_invitation.kind = 'player' and v_invitation.status not in ('rejected', 'revoked') then
      update public.player_invitations set status = 'rejected' where id = v_invitation.id;
      update public.player_invitation_credits set available = available + 1, updated_at = now()
        where player_id = v_invitation.inviter_id;
      insert into public.invitation_credit_transactions(
        player_id, amount, reason, invitation_id, idempotency_key
      ) values (
        v_invitation.inviter_id, 1, 'invitation_refund', v_invitation.id,
        'refund:' || v_invitation.id::text
      ) on conflict (idempotency_key) do nothing;
    elsif new.activation_status = 'claimed' and old.activation_status is distinct from 'claimed'
      and new.status = 'approved' then
      update public.player_invitations set status = 'redeemed',
        redeemed_by = (select id from auth.users where lower(email) = lower(new.email) limit 1),
        redeemed_at = now()
        where id = v_invitation.id and status = 'approved';
      v_inviter := v_invitation.inviter_id;
      select least(v_inviter, p.id), greatest(v_inviter, p.id)
        into v_player_a, v_player_b
        from public.profiles p
        where lower(p.username) = lower(new.username);
      if v_player_a is not null and v_player_a <> v_player_b then
        insert into public.neural_interaction_events(
          source_event_id, event_type, player_a, player_b
        ) values (
          'invitation:' || v_invitation.id::text,
          'gameplay.invitation_accepted', v_player_a, v_player_b
        ) on conflict (source_event_id) do nothing;
        insert into public.neural_connections(
          player_a, player_b, strength, interaction_count
        ) values (v_player_a, v_player_b, 1, 1)
        on conflict (player_a, player_b) do nothing;
      end if;
    elsif new.status = 'approved' and v_invitation.kind = 'player' then
      update public.player_invitations set status = 'approved' where id = v_invitation.id;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists v040_application_invitation_events on public.applications;
create trigger v040_application_invitation_events
  after update of status, activation_status on public.applications
  for each row execute function public.v040_application_invitation_events();

create or replace function public.admin_invitation_overview(
  p_search text default '', p_status text default null, p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  perform public.expire_player_invitations();
  if p_limit not between 1 and 200 then raise exception using errcode = '22023', message = 'Invalid page size'; end if;
  return jsonb_build_object(
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'status', i.status,
        'username', p.username, 'email', case when i.kind = 'admin' then i.target_email else null end,
        'invitee_username', coalesce(a.username, redeemed.username),
        'created_at', i.created_at, 'expires_at', i.expires_at,
        'redeemed_at', i.redeemed_at, 'credit_balance', c.available
      ) order by i.created_at desc)
      from (
        select * from public.player_invitations
        where (p_status is null or status = p_status)
        order by created_at desc limit p_limit
      ) i
      left join public.profiles p on p.id = i.inviter_id
      left join public.applications a on a.id = i.application_id
      left join public.profiles redeemed on redeemed.id = i.redeemed_by
      left join public.player_invitation_credits c on c.player_id = i.inviter_id
      where coalesce(p.username, i.target_email, a.username, redeemed.username, '')
        ilike '%' || left(coalesce(p_search, ''), 100) || '%'
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'username', p.username, 'requested', r.requested,
        'granted', r.granted, 'status', r.status, 'explanation', r.explanation,
        'created_at', r.created_at, 'credits', c.available
      ) order by r.created_at)
      from public.invitation_credit_requests r
      join public.profiles p on p.id = r.player_id
      left join public.player_invitation_credits c on c.player_id = r.player_id
      where r.status = 'pending'
    ), '[]'::jsonb),
    'total', (select count(*) from public.player_invitations),
    'pending', (select count(*) from public.player_invitations where status in ('pending', 'submitted', 'approved')),
    'successful', (select count(*) from public.player_invitations where status = 'redeemed')
  );
end
$$;

create or replace function public.admin_save_email_template(
  p_id uuid, p_name text, p_subject text, p_html text, p_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  if length(btrim(p_name)) not between 1 and 80 or length(btrim(p_subject)) not between 1 and 200
    or length(p_html) > 20000 or length(p_text) > 10000 then
    raise exception using errcode = '22023', message = 'Invalid email template';
  end if;
  if p_id is not null then
    update public.admin_email_templates set name = btrim(p_name), subject = btrim(p_subject),
      html_body = p_html, text_body = p_text, updated_by = v_admin, updated_at = now()
      where id = p_id and not is_builtin returning id into v_id;
  end if;
  if v_id is null then
    insert into public.admin_email_templates(name, subject, html_body, text_body, updated_by)
      values (btrim(p_name), btrim(p_subject), p_html, p_text, v_admin) returning id into v_id;
  end if;
  perform public.audit_scamtastic_action(v_admin, 'email_template_saved',
    'email_template', v_id::text, jsonb_build_object('name', btrim(p_name)));
  return v_id;
end
$$;

create or replace function public.admin_email_recipient_candidates(p_search text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'email', u.email)
      order by p.username)
    from (
      select * from public.profiles
      where not is_banned
        and (coalesce(p_search, '') = '' or username ilike '%' || left(p_search, 80) || '%')
      order by username limit 200
    ) p
    join auth.users u on u.id = p.id and u.email_confirmed_at is not null
  ), '[]'::jsonb);
end
$$;

create or replace function public.admin_email_recipient_emails(p_user_ids uuid[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emails text[];
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  if coalesce(cardinality(p_user_ids), 0) > 10
    or cardinality(p_user_ids) <> (
      select count(distinct u.id) from unnest(p_user_ids) as u(id)
    ) then
    raise exception using errcode = '22023', message = 'Invalid recipient selection';
  end if;
  select array_agg(u.email order by u.id) into v_emails
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = any(p_user_ids) and u.email_confirmed_at is not null and not p.is_banned;
  if coalesce(cardinality(v_emails), 0) <> coalesce(cardinality(p_user_ids), 0) then
    raise exception using errcode = '22023', message = 'Recipient selection is unavailable';
  end if;
  return v_emails;
end
$$;

create or replace function public.admin_begin_email_delivery(p_subject text, p_recipient_count integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  if length(btrim(p_subject)) not between 1 and 200 or p_recipient_count not between 1 and 10 then
    raise exception using errcode = '22023', message = 'Invalid email delivery request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_admin::text || ':email', 0));
  if (select count(*) from public.admin_email_deliveries
      where admin_id = v_admin and created_at > now() - interval '1 hour') >= 5 then
    raise exception using errcode = 'P0001', message = 'Email rate limit exceeded';
  end if;
  insert into public.admin_email_deliveries(
    admin_id, subject, recipient_count, status
  ) values (v_admin, btrim(p_subject), p_recipient_count, 'sending')
    returning id into v_id;
  return v_id;
end
$$;

create or replace function public.admin_finish_email_delivery(
  p_delivery_id uuid, p_status text, p_provider_status integer default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  if p_status not in ('sent', 'failed')
    or (p_provider_status is not null and p_provider_status not between 100 and 599) then
    raise exception using errcode = '22023', message = 'Invalid delivery outcome';
  end if;
  update public.admin_email_deliveries
    set status = p_status, provider_status = p_provider_status
    where id = p_delivery_id and admin_id = auth.uid() and status = 'sending';
  if not found then return false; end if;
  perform public.audit_scamtastic_action(auth.uid(), 'administrative_email_' || p_status,
    'email_delivery', p_delivery_id::text,
    jsonb_build_object('provider_status', p_provider_status));
  return true;
end
$$;

create or replace function public.admin_list_invitation_players(p_search text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_scamtastic_admin() then raise exception using errcode = '42501', message = 'Administrator access required'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'username', p.username,
      'credits', coalesce(c.available, 0),
      'invitations', (select count(*) from public.player_invitations i where i.inviter_id = p.id),
      'recruited', (select count(*) from public.player_invitations i where i.inviter_id = p.id and i.status = 'redeemed')
    ) order by p.username)
    from (
      select id, username from public.profiles
      where not is_banned and (coalesce(p_search, '') = '' or username ilike '%' || left(p_search, 80) || '%')
      order by username limit 200
    ) p
    left join public.player_invitation_credits c on c.player_id = p.id
  ), '[]'::jsonb);
end
$$;

create or replace function public.admin_list_email_resources()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  return jsonb_build_object(
    'templates', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'subject', subject, 'html_body', html_body,
      'text_body', text_body, 'is_builtin', is_builtin
    ) order by is_builtin desc, name) from public.admin_email_templates), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'subject', subject, 'recipient_count', recipient_count,
      'status', status, 'created_at', created_at
    ) order by created_at desc) from (
      select * from public.admin_email_deliveries order by created_at desc limit 50
    ) d), '[]'::jsonb)
  );
end
$$;

create or replace function public.admin_record_email_delivery(
  p_subject text, p_recipient_count integer, p_status text, p_provider_status integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_verified_scamtastic_admin() then raise exception using errcode = '42501', message = 'Verified administrator access required'; end if;
  if length(btrim(p_subject)) not between 1 and 200 or p_recipient_count not between 1 and 10
    or p_status not in ('sent', 'failed') then
    raise exception using errcode = '22023', message = 'Invalid email delivery metadata';
  end if;
  insert into public.admin_email_deliveries(admin_id, subject, recipient_count, status, provider_status)
    values (v_admin, btrim(p_subject), p_recipient_count, p_status, p_provider_status)
    returning id into v_id;
  perform public.audit_scamtastic_action(v_admin, 'administrative_email_' || p_status,
    'email_delivery', v_id::text, jsonb_build_object('recipient_count', p_recipient_count));
  return v_id;
end
$$;

insert into public.admin_email_templates(name, subject, html_body, text_body, is_builtin)
values
  ('Application approval', 'Your Scamtastic access is approved', '<p>Your application has been approved. Use the secure activation link in this email to join the network.</p>', 'Your application has been approved. Use the secure activation link in this email to join the network.', true),
  ('Application rejection', 'Your Scamtastic application update', '<p>Thank you for your interest. We are unable to approve your application at this time.</p>', 'Thank you for your interest. We are unable to approve your application at this time.', true),
  ('Player invitation', 'A Scamtastic player invited you', '<p>A player has invited you to request access. Your invitation does not bypass administrator review.</p>', 'A player has invited you to request access. Your invitation does not bypass administrator review.', true),
  ('Administrator invitation', 'Scamtastic has authorized your access', '<p>An administrator has authorized you to join Scamtastic. Follow the secure activation link to continue.</p>', 'An administrator has authorized you to join Scamtastic. Follow the secure activation link to continue.', true),
  ('Additional-credit approval', 'Your Scamtastic invitation credits were updated', '<p>Your invitation-credit request was approved.</p>', 'Your invitation-credit request was approved.', true),
  ('Additional-credit rejection', 'Your Scamtastic invitation-credit request', '<p>Your invitation-credit request was not approved.</p>', 'Your invitation-credit request was not approved.', true),
  ('General announcement', 'A message from Scamtastic', '<p>There is a new update from Scamtastic.</p>', 'There is a new update from Scamtastic.', true),
  ('Custom administrative message', 'A message from Scamtastic', '<p>There is a message from Scamtastic.</p>', 'There is a message from Scamtastic.', true)
on conflict do nothing;

revoke all on function public.create_player_invitation(text) from public, anon;
grant execute on function public.create_player_invitation(text) to authenticated;
revoke all on function public.my_invitation_dashboard() from public, anon;
grant execute on function public.my_invitation_dashboard() to authenticated;
revoke all on function public.revoke_player_invitation(uuid) from public, anon;
grant execute on function public.revoke_player_invitation(uuid) to authenticated;
revoke all on function public.request_invitation_credits(integer, text) from public, anon;
grant execute on function public.request_invitation_credits(integer, text) to authenticated;
revoke all on function public.invitation_preview(text) from public, authenticated;
grant execute on function public.invitation_preview(text) to anon, authenticated;
revoke all on function public.admin_issue_invitation(text, text, integer) from public, anon;
grant execute on function public.admin_issue_invitation(text, text, integer) to authenticated;
revoke all on function public.admin_revoke_invitation(uuid) from public, anon;
grant execute on function public.admin_revoke_invitation(uuid) to authenticated;
revoke all on function public.admin_adjust_invitation_credits(uuid, integer, text, text) from public, anon;
grant execute on function public.admin_adjust_invitation_credits(uuid, integer, text, text) to authenticated;
revoke all on function public.admin_review_credit_request(uuid, text, integer) from public, anon;
grant execute on function public.admin_review_credit_request(uuid, text, integer) to authenticated;
revoke all on function public.claim_administrator_invitation(text, text, text) from public, anon;
grant execute on function public.claim_administrator_invitation(text, text, text) to authenticated;
revoke all on function public.submit_invited_application(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_invited_application(text, text, text, text, text, text, text) to service_role;
revoke all on function public.admin_invitation_overview(text, text, integer) from public, anon;
grant execute on function public.admin_invitation_overview(text, text, integer) to authenticated;
revoke all on function public.admin_save_email_template(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_save_email_template(uuid, text, text, text, text) to authenticated;
revoke all on function public.admin_list_email_resources() from public, anon;
grant execute on function public.admin_list_email_resources() to authenticated;
revoke all on function public.admin_record_email_delivery(text, integer, text, integer) from public, anon;
revoke all on function public.admin_record_email_delivery(text, integer, text, integer) from authenticated;
revoke all on function public.admin_email_recipient_candidates(text) from public, anon;
grant execute on function public.admin_email_recipient_candidates(text) to authenticated;
revoke all on function public.admin_email_recipient_emails(uuid[]) from public, anon;
grant execute on function public.admin_email_recipient_emails(uuid[]) to authenticated;
revoke all on function public.admin_begin_email_delivery(text, integer) from public, anon;
grant execute on function public.admin_begin_email_delivery(text, integer) to authenticated;
revoke all on function public.admin_finish_email_delivery(uuid, text, integer) from public, anon;
grant execute on function public.admin_finish_email_delivery(uuid, text, integer) to authenticated;
revoke all on function public.admin_list_invitation_players(text) from public, anon;
grant execute on function public.admin_list_invitation_players(text) to authenticated;
revoke all on function public.expire_player_invitations() from public, anon, authenticated;
revoke all on function public.initialize_player_invitation_credits() from public, anon, authenticated;
revoke all on function public.v040_application_invitation_events() from public, anon, authenticated;
revoke all on function public.is_verified_scamtastic_admin() from public, anon, authenticated;

-- Preserve the Ampers& node and its edges while freeing the origin for the render-only system neuron.
do $$
declare
  v_player uuid;
  v_anchor_x double precision;
  v_anchor_y double precision;
  v_anchor_z double precision;
  v_x double precision;
  v_y double precision;
  v_z double precision;
  v_length double precision;
  v_radius double precision;
  v_nearest double precision;
  v_node_count bigint;
  v_anchor_offset bigint;
  v_attempt integer;
begin
  select n.player_id into v_player
    from public.neural_nodes n join public.profiles p on p.id = n.player_id
    where p.username = 'Ampers&'
      and sqrt(n.position_x * n.position_x + n.position_y * n.position_y + n.position_z * n.position_z) < 0.01
    for update of n;
  if v_player is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('scamtastic-neural-placement', 0));
  select count(*) into v_node_count from public.neural_nodes where player_id <> v_player;
  if v_node_count > 0 then
    v_anchor_offset := floor(random() * v_node_count);
    select position_x, position_y, position_z
      into v_anchor_x, v_anchor_y, v_anchor_z
      from public.neural_nodes where player_id <> v_player
      order by created_at, player_id offset v_anchor_offset limit 1;

    for v_attempt in 1..96 loop
      v_x := random() * 2 - 1;
      v_y := random() * 2 - 1;
      v_z := random() * 2 - 1;
      v_length := sqrt(v_x * v_x + v_y * v_y + v_z * v_z);
      if v_length < 0.000001 then continue; end if;
      v_radius := 12 + random() * 18;
      v_x := v_anchor_x + v_x / v_length * v_radius;
      v_y := v_anchor_y + v_y / v_length * v_radius;
      v_z := v_anchor_z + v_z / v_length * v_radius;
      select min(sqrt(
        power(position_x - v_x, 2) + power(position_y - v_y, 2) + power(position_z - v_z, 2)
      )) into v_nearest from public.neural_nodes where player_id <> v_player;
      exit when v_nearest >= 8 and v_nearest <= 26;
    end loop;
    if v_nearest is null or v_nearest < 8 or v_nearest > 26 then
      raise exception using errcode = 'P0001',
        message = 'Unable to find a well-spaced system-origin offset';
    end if;
  else
    update public.neural_nodes set position_x = 18, position_y = 0, position_z = 0
      where player_id = v_player;
    return;
  end if;
  update public.neural_nodes set position_x = v_x, position_y = v_y, position_z = v_z
    where player_id = v_player;
end
$$;

commit;
