-- Additive v0.2.0 schema. This migration is not run against production by the app.
-- Existing profiles(id uuid, username text) and admin_users are retained.
begin;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Expected public.profiles to exist; inspect the live schema before applying this migration';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'username'
  ) then
    raise exception 'Expected public.profiles(id, username); adapt this migration to the existing schema';
  end if;
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'id') <> 'uuid' then
    raise exception 'Expected public.profiles.id to be uuid; adapt this migration to the existing schema';
  end if;
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'username')
      not in ('text', 'character varying') then
    raise exception 'Expected public.profiles.username to be text; adapt this migration to the existing schema';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from public.profiles
    where username is not null
    group by lower(username)
    having count(*) > 1
  ) then
    raise exception 'Case-insensitive username conflicts exist in public.profiles; resolve them before applying the unique index';
  end if;
end
$$;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.founder_badges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists bio text not null default '',
  add column if not exists avatar_url text,
  add column if not exists avatar_seed uuid not null default gen_random_uuid(),
  add column if not exists avatar_generator_version smallint not null default 1,
  add column if not exists is_banned boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_seed')
      <> 'uuid' then
    raise exception 'Expected public.profiles.avatar_seed to be uuid';
  end if;
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'avatar_generator_version') not in ('smallint', 'integer') then
    raise exception 'Expected public.profiles.avatar_generator_version to be an integer';
  end if;
end
$$;

update public.profiles set avatar_seed = gen_random_uuid() where avatar_seed is null;
update public.profiles set avatar_generator_version = 1
  where avatar_generator_version is null or avatar_generator_version < 1;
alter table public.profiles alter column avatar_seed set default gen_random_uuid();
alter table public.profiles alter column avatar_seed set not null;
alter table public.profiles alter column avatar_generator_version set default 1;
alter table public.profiles alter column avatar_generator_version set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_avatar_generator_version_positive'
  ) then
    alter table public.profiles add constraint profiles_avatar_generator_version_positive
      check (avatar_generator_version > 0) not valid;
  end if;
  alter table public.profiles validate constraint profiles_avatar_generator_version_positive;
end
$$;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null,
  reason text not null,
  referral_code text,
  comments text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  admin_notes text,
  activation_status text not null default 'not_sent'
    check (activation_status in ('not_sent', 'sent', 'failed', 'claimed')),
  activation_sent_at timestamptz
);

alter table public.applications
  add column if not exists username text,
  add column if not exists email text,
  add column if not exists reason text,
  add column if not exists referral_code text,
  add column if not exists comments text,
  add column if not exists status text not null default 'pending',
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists admin_notes text,
  add column if not exists activation_status text not null default 'not_sent',
  add column if not exists activation_sent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications' and column_name = 'id'
  ) then
    alter table public.applications add column id uuid default gen_random_uuid();
  end if;
  if exists (select 1 from public.applications where id is null) then
    raise exception 'public.applications contains rows without an id; resolve before applying this migration';
  end if;
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'applications' and column_name = 'id')
      <> 'uuid' then
    raise exception 'Expected public.applications.id to be uuid; adapt this migration to the existing schema';
  end if;
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'applications' and column_name = 'status')
      not in ('text', 'character varying') then
    raise exception 'Expected public.applications.status to be text; adapt this migration to the existing schema';
  end if;
  if exists (
    select 1 from public.applications where status is null
      or status not in ('pending', 'approved', 'rejected')
  ) then
    raise exception 'public.applications contains unsupported statuses; review existing rows before migrating';
  end if;
end
$$;

alter table public.applications alter column id set default gen_random_uuid();
alter table public.applications alter column id set not null;

do $$
begin
  if exists (
    select 1 from public.applications
    where status in ('pending', 'approved') and username is not null
    group by lower(username)
    having count(*) > 1
  ) then
    raise exception 'Case-insensitive active application username conflicts exist; resolve them before applying the unique index';
  end if;
  if exists (
    select 1 from public.applications
    where status in ('pending', 'approved') and email is not null
    group by lower(email)
    having count(*) > 1
  ) then
    raise exception 'Case-insensitive active application email conflicts exist; resolve them before applying the unique index';
  end if;
end
$$;

create unique index if not exists applications_id_unique on public.applications(id);
create index if not exists applications_status_submitted_idx
  on public.applications(status, submitted_at desc);
create unique index if not exists applications_active_email_unique
  on public.applications(lower(email)) where status in ('pending', 'approved');
create unique index if not exists applications_active_username_unique
  on public.applications(lower(username)) where status in ('pending', 'approved');
create unique index if not exists profiles_username_lower_unique
  on public.profiles(lower(username));
do $$
begin
  if exists (
    select 1 from public.profiles
    where avatar_seed is not null
    group by avatar_seed
    having count(*) > 1
  ) then
    raise exception 'Duplicate procedural avatar seeds exist in public.profiles; resolve before creating the unique index';
  end if;
end
$$;
create unique index if not exists profiles_avatar_seed_unique
  on public.profiles(avatar_seed);

create table if not exists public.reserved_usernames (
  username text primary key
);
insert into public.reserved_usernames(username) values
  ('admin'), ('administrator'), ('api'), ('apply'), ('auth'), ('game'),
  ('login'), ('logout'), ('profile'), ('settings'), ('support'), ('system')
on conflict do nothing;

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  usage_limit integer not null default 5 check (usage_limit between 1 and 100),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists referral_codes_creator_idx
  on public.referral_codes(creator_id, created_at desc);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  referral_code_id uuid not null references public.referral_codes(id),
  referred_at timestamptz not null default now()
);

-- Reconcile the existing referral schema without replacing historical rows.
-- The referred account may not exist until an approved application is claimed.
alter table public.referrals
  add column if not exists referrer_id uuid,
  add column if not exists referred_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.referrals'::regclass
      and conname = 'referrals_referrer_id_fkey'
  ) then
    alter table public.referrals
      add constraint referrals_referrer_id_fkey
      foreign key (referrer_id) references auth.users(id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.referrals'::regclass
      and conname = 'referrals_referred_id_fkey'
  ) then
    alter table public.referrals
      add constraint referrals_referred_id_fkey
      foreign key (referred_id) references auth.users(id);
  end if;
end
$$;

-- Backfill missing referrer IDs without overwriting existing attribution.
-- to_jsonb() lets this work with schemas that do or do not have owner_id.
update public.referrals r
set referrer_id = coalesce(
  rc.creator_id,
  nullif(to_jsonb(rc)->>'owner_id', '')::uuid
)
from public.referral_codes rc
where rc.id = r.referral_code_id
  and r.referrer_id is null;

-- Stop rather than silently discard or misattribute unresolvable history.
do $$
begin
  if exists (
    select 1
    from public.referrals
    where referrer_id is null
  ) then
    raise exception
      'Existing referrals have no resolvable referrer; review them before migrating';
  end if;
end
$$;

alter table public.referrals
  alter column referrer_id set not null,
  alter column referred_id drop not null;

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs(created_at desc);

create table if not exists public.application_rate_limits (
  rate_key text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists application_rate_limits_key_time_idx
  on public.application_rate_limits(rate_key, attempted_at desc);

do $$
declare v_table text; v_column text;
begin
  for v_table, v_column in
    select * from (values
      ('referral_codes', 'id'), ('referral_codes', 'code'),
      ('referral_codes', 'creator_id'), ('referral_codes', 'usage_limit'),
      ('referral_codes', 'revoked_at'), ('referral_codes', 'created_at'),
      ('referrals', 'id'), ('referrals', 'application_id'),
      ('referrals', 'referral_code_id'), ('referrals', 'referred_at'),
      ('admin_audit_logs', 'id'), ('admin_audit_logs', 'admin_id'),
      ('admin_audit_logs', 'action'), ('admin_audit_logs', 'target_type'),
      ('admin_audit_logs', 'target_id'), ('admin_audit_logs', 'metadata'),
      ('admin_audit_logs', 'created_at')
    ) expected(table_name, column_name)
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_table and column_name = v_column
    ) then
      raise exception 'Existing public.% is missing expected column %; inspect and adapt the migration',
        v_table, v_column;
    end if;
  end loop;
end
$$;

create or replace function public.is_scamtastic_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.admin_users au
    where coalesce(
      to_jsonb(au)->>'user_id',
      to_jsonb(au)->>'profile_id',
      to_jsonb(au)->>'admin_id',
      to_jsonb(au)->>'auth_user_id',
      to_jsonb(au)->>'id'
    ) = auth.uid()::text
  )
$$;

create or replace function public.assert_scamtastic_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_scamtastic_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  return auth.uid();
end
$$;

create or replace function public.audit_scamtastic_action(
  p_admin uuid, p_action text, p_target_type text, p_target_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, metadata)
  values (p_admin, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb))
$$;

create or replace function public.submit_scamtastic_application(
  p_rate_key text,
  p_username text,
  p_email text,
  p_reason text,
  p_referral_code text default null,
  p_comments text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := btrim(p_username);
  v_email text := lower(btrim(p_email));
  v_referral public.referral_codes%rowtype;
  v_application_id uuid;
begin
  if coalesce(length(p_rate_key), 0) < 32 then
    raise exception using errcode = '22023', message = 'Invalid request';
  end if;
  if coalesce(v_username, '') !~ '^[A-Za-z0-9_&-]{3,24}$' then
    raise exception using errcode = '22023', message = 'Invalid username';
  end if;
  if coalesce(v_email, '') !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    or length(v_email) > 254
    or length(coalesce(p_reason, '')) not between 10 and 2000
    or length(coalesce(p_comments, '')) > 2000 then
    raise exception using errcode = '22023', message = 'Invalid application fields';
  end if;

  delete from public.application_rate_limits
    where attempted_at < now() - interval '2 days';
  perform pg_advisory_xact_lock(hashtextextended(p_rate_key, 0));
  if (select count(*) from public.application_rate_limits
      where rate_key = p_rate_key and attempted_at > now() - interval '1 hour') >= 5 then
    raise exception using errcode = 'P0001', message = 'Rate limit exceeded';
  end if;
  insert into public.application_rate_limits(rate_key) values (p_rate_key);

  if exists (select 1 from public.applications where lower(email) = v_email
      and status in ('pending', 'approved')) then
    return 'received';
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(v_username))
      or exists (select 1 from public.applications where lower(username) = lower(v_username)
        and status in ('pending', 'approved'))
      or exists (select 1 from public.reserved_usernames
        where lower(username) = lower(v_username)) then
    return 'username_unavailable';
  end if;

  if nullif(btrim(p_referral_code), '') is not null then
    select * into v_referral from public.referral_codes
      where code = upper(btrim(p_referral_code)) and revoked_at is null
      for update;
    if not found or (
      select count(*) from public.referrals where referral_code_id = v_referral.id
    ) >= v_referral.usage_limit then
      raise exception using errcode = '22023', message = 'Invalid referral code';
    end if;
  end if;

  begin
    insert into public.applications(username, email, reason, referral_code, comments)
      values (v_username, v_email, btrim(p_reason), nullif(upper(btrim(p_referral_code)), ''),
        nullif(btrim(p_comments), ''))
      returning id into v_application_id;
  exception when unique_violation then
    if exists (select 1 from public.profiles where lower(username) = lower(v_username))
      or exists (select 1 from public.applications where lower(username) = lower(v_username)
        and status in ('pending', 'approved'))
      or exists (select 1 from public.reserved_usernames
        where lower(username) = lower(v_username)) then
      return 'username_unavailable';
    end if;
    if exists (select 1 from public.applications where lower(email) = v_email
        and status in ('pending', 'approved')) then
      return 'received';
    end if;
    raise;
  end;

    if v_referral.id is not null then
    insert into public.referrals (
      application_id,
      referral_code_id,
      referrer_id,
      referred_id
    )
    values (
      v_application_id,
      v_referral.id,
      coalesce(
        v_referral.creator_id,
        nullif(to_jsonb(v_referral)->>'owner_id', '')::uuid
      ),
      null
    );
  end if;
  return 'received';
end
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_admin uuid;
begin
  v_admin := public.assert_scamtastic_admin();
  return jsonb_build_object(
    'players', (select count(*) from public.profiles),
    'pending', (select count(*) from public.applications where status = 'pending'),
    'approved', (select count(*) from public.applications where status = 'approved'),
    'rejected', (select count(*) from public.applications where status = 'rejected'),
    'referral_codes', (select count(*) from public.referral_codes),
    'recent_activity', coalesce((
      select jsonb_agg(jsonb_build_object('action', action, 'target_type', target_type,
        'target_id', target_id, 'created_at', created_at) order by created_at desc)
      from (select action, target_type, target_id, created_at
        from public.admin_audit_logs order by created_at desc limit 8) recent
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.admin_list_applications(
  p_status text default 'all', p_search text default ''
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_scamtastic_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'username', a.username, 'email', a.email, 'reason', a.reason,
      'referral_code', a.referral_code, 'comments', a.comments, 'status', a.status,
      'submitted_at', a.submitted_at, 'reviewed_at', a.reviewed_at,
      'reviewed_by', a.reviewed_by, 'admin_notes', a.admin_notes,
      'activation_status', a.activation_status, 'activation_sent_at', a.activation_sent_at,
      'referrer_username', p.username,
      'referral_valid', (rc.id is not null and rc.revoked_at is null and
        (select count(*) from public.referrals r2 where r2.referral_code_id = rc.id)
          < rc.usage_limit),
      'history', coalesce((
        select jsonb_agg(jsonb_build_object('action', al.action,
          'created_at', al.created_at, 'admin_id', al.admin_id) order by al.created_at desc)
        from public.admin_audit_logs al
        where al.target_type = 'application' and al.target_id = a.id::text
      ), '[]'::jsonb)
    ) order by a.submitted_at desc)
    from public.applications a
    left join public.referrals r on r.application_id = a.id
    left join public.referral_codes rc on rc.id = r.referral_code_id
    left join public.profiles p on p.id = rc.creator_id
    where (p_status = 'all' or a.status = p_status)
      and (coalesce(p_search, '') = '' or a.username ilike '%' || p_search || '%'
        or a.email ilike '%' || p_search || '%')
  ), '[]'::jsonb);
end
$$;

create or replace function public.admin_review_application(
  p_application_id uuid, p_status text, p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_admin uuid; v_app public.applications%rowtype;
begin
  v_admin := public.assert_scamtastic_admin();
  if p_status is null or p_status not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'Invalid review status';
  end if;
  if length(coalesce(p_admin_notes, '')) > 4000 then
    raise exception using errcode = '22023', message = 'Administrative notes are too long';
  end if;
  select * into v_app from public.applications where id = p_application_id for update;
  if not found or v_app.status is distinct from 'pending' then
    raise exception using errcode = '40001', message = 'Application is no longer pending';
  end if;
  if p_status = 'approved' and (
    coalesce(v_app.username, '') !~ '^[A-Za-z0-9_&-]{3,24}$'
    or lower(v_app.username) in (select lower(username) from public.reserved_usernames)
    or coalesce(v_app.email, '') !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    or length(coalesce(v_app.email, '')) > 254
    or exists (select 1 from public.profiles where lower(username) = lower(v_app.username))
  ) then
    raise exception using errcode = '23505', message = 'Requested username is unavailable';
  end if;
  if p_status = 'approved' and exists (
    select 1 from auth.users u
    where u.id = v_admin and lower(u.email) = lower(v_app.email)
  ) then
    raise exception using errcode = '42501', message = 'Administrators cannot approve their own application';
  end if;
  update public.applications set status = p_status, reviewed_by = v_admin,
    reviewed_at = now(), admin_notes = nullif(btrim(p_admin_notes), '')
    where id = p_application_id returning * into v_app;
  perform public.audit_scamtastic_action(v_admin, 'application.' || p_status,
    'application', p_application_id::text, jsonb_build_object('username', v_app.username));
  return jsonb_build_object('id', v_app.id, 'email', v_app.email, 'username', v_app.username);
end
$$;

create or replace function public.admin_set_activation_status(
  p_application_id uuid, p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_admin uuid;
begin
  v_admin := public.assert_scamtastic_admin();
  if p_status is null or p_status not in ('sent', 'failed') then
    raise exception using errcode = '22023', message = 'Invalid activation status';
  end if;
  update public.applications set activation_status = p_status,
    activation_sent_at = case when p_status = 'sent' then now() else activation_sent_at end
    where id = p_application_id and status = 'approved' and activation_status <> 'claimed';
  if not found then
    raise exception using errcode = '40001', message = 'Approved application not found';
  end if;
  perform public.audit_scamtastic_action(v_admin, 'application.activation_' || p_status,
    'application', p_application_id::text);
end
$$;

create or replace function public.admin_list_players(p_search text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_scamtastic_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name,
      'avatar_seed', p.avatar_seed,
      'avatar_generator_version', p.avatar_generator_version,
      'bio', p.bio, 'is_banned', p.is_banned,
      'is_founder', exists (select 1 from public.founder_badges fb where fb.user_id = p.id),
      'is_admin', exists (
        select 1 from public.admin_users au
        where coalesce(to_jsonb(au)->>'user_id', to_jsonb(au)->>'profile_id',
          to_jsonb(au)->>'admin_id', to_jsonb(au)->>'auth_user_id',
          to_jsonb(au)->>'id') = p.id::text
      ), 'created_at', p.created_at, 'referral_count', (
        select count(*) from public.referrals r
        join public.referral_codes rc on rc.id = r.referral_code_id
        where rc.creator_id = p.id
      )
    ) order by p.created_at desc)
    from public.profiles p
    where coalesce(p_search, '') = '' or p.username ilike '%' || p_search || '%'
      or coalesce(p.display_name, '') ilike '%' || p_search || '%'
  ), '[]'::jsonb);
end
$$;

create or replace function public.admin_update_player(
  p_player_id uuid, p_display_name text, p_bio text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_admin uuid;
begin
  v_admin := public.assert_scamtastic_admin();
  if length(coalesce(p_display_name, '')) > 80 or length(coalesce(p_bio, '')) > 500 then
    raise exception using errcode = '22023', message = 'Profile fields exceed their limits';
  end if;
  update public.profiles set display_name = nullif(btrim(p_display_name), ''),
    bio = coalesce(p_bio, '') where id = p_player_id;
  if not found then raise exception using errcode = 'P0002', message = 'Player not found'; end if;
  perform public.audit_scamtastic_action(v_admin, 'player.profile_updated',
    'player', p_player_id::text);
end
$$;

create or replace function public.admin_set_player_suspended(p_player_id uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_admin uuid; v_admin_count bigint;
begin
  v_admin := public.assert_scamtastic_admin();
  if p_suspended and exists (
    select 1 from public.admin_users au
    where coalesce(to_jsonb(au)->>'user_id', to_jsonb(au)->>'profile_id',
      to_jsonb(au)->>'admin_id', to_jsonb(au)->>'auth_user_id',
      to_jsonb(au)->>'id') = p_player_id::text
  ) then
    select count(*) into v_admin_count from public.admin_users;
    if v_admin_count <= 1 then
      raise exception using errcode = '23514', message = 'Cannot suspend the last administrator';
    end if;
  end if;
  update public.profiles set is_banned = p_suspended where id = p_player_id;
  if not found then raise exception using errcode = 'P0002', message = 'Player not found'; end if;
  perform public.audit_scamtastic_action(v_admin,
    case when p_suspended then 'player.suspended' else 'player.restored' end,
    'player', p_player_id::text);
end
$$;

create or replace function public.admin_list_referrals()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_scamtastic_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', rc.id, 'code', rc.code, 'creator_id', rc.creator_id,
      'creator_username', p.username, 'usage_limit', rc.usage_limit,
      'uses', (select count(*) from public.referrals r where r.referral_code_id = rc.id),
      'referred_players', coalesce((
        select jsonb_agg(jsonb_build_object(
          'username', a.username, 'status', a.status, 'submitted_at', a.submitted_at
        ) order by a.submitted_at desc)
        from public.referrals r
        join public.applications a on a.id = r.application_id
        where r.referral_code_id = rc.id
      ), '[]'::jsonb),
      'revoked_at', rc.revoked_at, 'created_at', rc.created_at
    ) order by rc.created_at desc)
    from public.referral_codes rc join public.profiles p on p.id = rc.creator_id
  ), '[]'::jsonb);
end
$$;

create or replace function public.create_referral_code(p_usage_limit integer default 5)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_code text;
begin
  if v_user is null or not exists (
    select 1 from public.profiles where id = v_user and not is_banned
  ) then
    raise exception using errcode = '42501', message = 'Approved player access required';
  end if;
  if p_usage_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Usage limit must be 1–100';
  end if;
  v_code := upper(replace(gen_random_uuid()::text, '-', ''));
  insert into public.referral_codes(code, creator_id, usage_limit)
    values (v_code, v_user, p_usage_limit);
  return v_code;
end
$$;

create or replace function public.my_referral_codes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not exists (
    select 1 from public.profiles where id = v_user and not is_banned
  ) then
    raise exception using errcode = '42501', message = 'Approved player access required';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', rc.id, 'code', rc.code, 'usage_limit', rc.usage_limit,
      'uses', (select count(*) from public.referrals r where r.referral_code_id = rc.id),
      'revoked_at', rc.revoked_at, 'created_at', rc.created_at
    ) order by rc.created_at desc)
    from public.referral_codes rc where rc.creator_id = v_user
  ), '[]'::jsonb);
end
$$;

create or replace function public.revoke_own_referral_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  update public.referral_codes set revoked_at = coalesce(revoked_at, now())
    where id = p_code_id and creator_id = v_user;
  if not found then
    raise exception using errcode = 'P0002', message = 'Referral code not found';
  end if;
end
$$;

create or replace function public.revoke_referral_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_admin uuid;
begin
  v_admin := public.assert_scamtastic_admin();
  update public.referral_codes set revoked_at = coalesce(revoked_at, now())
    where id = p_code_id;
  if not found then raise exception using errcode = 'P0002', message = 'Referral code not found'; end if;
  perform public.audit_scamtastic_action(v_admin, 'referral.revoked',
    'referral_code', p_code_id::text);
end
$$;

create or replace function public.admin_list_audit_logs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_scamtastic_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'admin_id', admin_id,
      'action', action, 'target_type', target_type, 'target_id', target_id,
      'metadata', metadata, 'created_at', created_at) order by created_at desc)
    from (select * from public.admin_audit_logs order by created_at desc limit 250) recent
  ), '[]'::jsonb);
end
$$;

create or replace function public.public_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'username', p.username,
    'display_name', p.display_name,
    'bio', p.bio,
    'avatar_seed', p.avatar_seed,
    'avatar_generator_version', p.avatar_generator_version,
    'created_at', p.created_at,
    'is_founder', exists (select 1 from public.founder_badges fb where fb.user_id = p.id),
    'is_admin', exists (
      select 1 from public.admin_users au
      where coalesce(to_jsonb(au)->>'user_id', to_jsonb(au)->>'profile_id',
        to_jsonb(au)->>'admin_id', to_jsonb(au)->>'auth_user_id',
        to_jsonb(au)->>'id') = p.id::text
    ),
    'referral_count', (select count(*) from public.referrals r
      join public.referral_codes rc on rc.id = r.referral_code_id
      where rc.creator_id = p.id)
  )
  from public.profiles p
  where lower(p.username) = lower(p_username) and not p.is_banned
$$;

create or replace function public.reroll_own_avatar()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_seed uuid;
  v_version integer;
  v_attempt integer;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;

  perform 1 from public.profiles
    where id = v_user and not is_banned
    for update;
  if not found then
    raise exception using errcode = '42501', message = 'Active player access required';
  end if;

  for v_attempt in 1..5 loop
    v_seed := gen_random_uuid();
    begin
      update public.profiles set avatar_seed = v_seed
        where id = v_user and not is_banned
        returning avatar_generator_version into v_version;
      if not found then
        raise exception using errcode = '42501', message = 'Active player access required';
      end if;
      return jsonb_build_object(
        'avatar_seed', v_seed,
        'avatar_generator_version', v_version
      );
    exception when unique_violation then
      if v_attempt = 5 then raise; end if;
    end;
  end loop;

  raise exception using errcode = 'P0001', message = 'Unable to generate a unique avatar seed';
end
$$;

create or replace function public.claim_approved_application()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_email text; v_app public.applications%rowtype;
begin
  if v_user is null then return false; end if;
  select lower(email) into v_email from auth.users
    where id = v_user and email_confirmed_at is not null;
  if v_email is null then return false; end if;
  select * into v_app from public.applications
    where lower(email) = v_email and status = 'approved'
    order by reviewed_at desc limit 1 for update;
  if not found then return false; end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    if exists (select 1 from public.profiles where lower(username) = lower(v_app.username)) then
      return false;
    end if;
    insert into public.profiles(id, username, display_name, bio, is_banned, created_at)
      values (v_user, v_app.username, v_app.username, '', false, now());
  end if;
  update public.applications set activation_status = 'claimed'
    where id = v_app.id and activation_status <> 'claimed';
  return true;
end
$$;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.username is distinct from old.username then
    raise exception using errcode = '42501', message = 'Protected profile fields cannot be changed';
  end if;
  if length(coalesce(new.display_name, '')) > 80 or length(coalesce(new.bio, '')) > 500 then
    raise exception using errcode = '22023', message = 'Invalid public profile fields';
  end if;
  if new.is_banned is distinct from old.is_banned and not public.is_scamtastic_admin() then
    raise exception using errcode = '42501', message = 'Only administrators may change player access';
  end if;
  return new;
end
$$;
drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges before update on public.profiles
  for each row execute function public.protect_profile_privileges();

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.applications enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.application_rate_limits enable row level security;
alter table public.founder_badges enable row level security;
alter table public.reserved_usernames enable row level security;

drop policy if exists profiles_own_read on public.profiles;
create policy profiles_own_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_scamtastic_admin());
drop policy if exists profiles_restrict_private_read on public.profiles;
create policy profiles_restrict_private_read on public.profiles as restrictive
  for select to anon, authenticated
  using (id = (select auth.uid()) or public.is_scamtastic_admin());
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists profiles_restrict_update on public.profiles;
create policy profiles_restrict_update on public.profiles as restrictive
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists admin_users_own_read on public.admin_users;
create policy admin_users_own_read on public.admin_users for select to authenticated
  using (coalesce(to_jsonb(admin_users)->>'user_id', to_jsonb(admin_users)->>'profile_id',
    to_jsonb(admin_users)->>'admin_id', to_jsonb(admin_users)->>'auth_user_id',
    to_jsonb(admin_users)->>'id') = (select auth.uid())::text);

revoke all on public.applications, public.referral_codes, public.referrals,
  public.admin_audit_logs, public.application_rate_limits from public, anon, authenticated;
revoke all on public.reserved_usernames from public, anon, authenticated;
revoke all on public.admin_users from public, anon, authenticated;
revoke insert, update, delete on public.profiles from public, anon, authenticated;
revoke update (avatar_seed, avatar_generator_version, avatar_url)
  on public.profiles from public, anon, authenticated;
grant update(display_name, bio) on public.profiles to authenticated;
grant select on public.profiles to authenticated;
revoke update, delete on public.admin_audit_logs from public, anon, authenticated;
revoke all on public.founder_badges from public, anon, authenticated;

revoke all on function public.audit_scamtastic_action(uuid,text,text,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.protect_profile_privileges() from public, anon, authenticated;

revoke all on function public.is_scamtastic_admin() from public;
grant execute on function public.is_scamtastic_admin() to anon, authenticated;
revoke all on function public.assert_scamtastic_admin() from public, anon, authenticated;
grant execute on function public.assert_scamtastic_admin() to authenticated;
revoke all on function public.submit_scamtastic_application(text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.submit_scamtastic_application(text,text,text,text,text,text)
  to service_role;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
revoke all on function public.admin_list_applications(text,text) from public, anon;
grant execute on function public.admin_list_applications(text,text) to authenticated;
revoke all on function public.admin_review_application(uuid,text,text) from public, anon;
grant execute on function public.admin_review_application(uuid,text,text) to authenticated;
revoke all on function public.admin_set_activation_status(uuid,text) from public, anon;
grant execute on function public.admin_set_activation_status(uuid,text) to authenticated;
revoke all on function public.admin_list_players(text) from public, anon;
grant execute on function public.admin_list_players(text) to authenticated;
revoke all on function public.admin_update_player(uuid,text,text) from public, anon;
grant execute on function public.admin_update_player(uuid,text,text) to authenticated;
revoke all on function public.admin_set_player_suspended(uuid,boolean) from public, anon;
grant execute on function public.admin_set_player_suspended(uuid,boolean) to authenticated;
revoke all on function public.admin_list_referrals() from public, anon;
grant execute on function public.admin_list_referrals() to authenticated;
revoke all on function public.create_referral_code(integer) from public, anon;
grant execute on function public.create_referral_code(integer) to authenticated;
revoke all on function public.my_referral_codes() from public, anon;
grant execute on function public.my_referral_codes() to authenticated;
revoke all on function public.revoke_own_referral_code(uuid) from public, anon;
grant execute on function public.revoke_own_referral_code(uuid) to authenticated;
revoke all on function public.revoke_referral_code(uuid) from public, anon;
grant execute on function public.revoke_referral_code(uuid) to authenticated;
revoke all on function public.reroll_own_avatar() from public, anon;
grant execute on function public.reroll_own_avatar() to authenticated;
revoke all on function public.admin_list_audit_logs() from public, anon;
grant execute on function public.admin_list_audit_logs() to authenticated;
revoke all on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;
revoke all on function public.claim_approved_application() from public, anon;
grant execute on function public.claim_approved_application() to authenticated;

commit;
