-- Persistent, public-safe neural network data. Review and apply manually after
-- staging verification; the application never runs migrations automatically.
begin;

do $$
begin
  if to_regclass('public.profiles') is null
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'id' and data_type = 'uuid'
    )
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'username'
    )
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'is_banned'
    )
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'avatar_seed'
    )
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'avatar_generator_version'
    ) then
    raise exception 'Expected public.profiles with id, username, is_banned, and procedural avatar fields; apply and inspect the v0.2.0 migration first';
  end if;
end
$$;

create table public.neural_network_config (
  singleton boolean primary key default true check (singleton),
  max_strength integer not null default 20 check (max_strength between 1 and 100)
);
insert into public.neural_network_config(singleton, max_strength)
values (true, 20)
on conflict (singleton) do nothing;

create table public.neural_nodes (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  position_x double precision not null check (position_x between -1000000 and 1000000),
  position_y double precision not null check (position_y between -1000000 and 1000000),
  position_z double precision not null check (position_z between -1000000 and 1000000),
  created_at timestamptz not null default now()
);

create table public.neural_connections (
  player_a uuid not null references public.neural_nodes(player_id) on delete cascade,
  player_b uuid not null references public.neural_nodes(player_id) on delete cascade,
  strength integer not null default 1 check (strength >= 1),
  interaction_count bigint not null default 1 check (interaction_count >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_a, player_b),
  check (player_a < player_b)
);

create table public.neural_interaction_events (
  source_event_id text primary key check (length(source_event_id) between 1 and 200),
  event_type text not null check (event_type in (
    'gameplay.opportunity_participation',
    'gameplay.project_collaboration',
    'gameplay.player_transaction',
    'gameplay.invitation_accepted',
    'gameplay.multiplayer_activity'
  )),
  player_a uuid not null references public.profiles(id) on delete cascade,
  player_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (player_a < player_b)
);

create index neural_nodes_created_at_idx on public.neural_nodes(created_at, player_id);
create index neural_connections_player_b_idx on public.neural_connections(player_b, player_a);
create index neural_interaction_events_created_at_idx
  on public.neural_interaction_events(created_at);

alter table public.neural_network_config enable row level security;
alter table public.neural_nodes enable row level security;
alter table public.neural_connections enable row level security;
alter table public.neural_interaction_events enable row level security;

revoke all on public.neural_network_config, public.neural_nodes,
  public.neural_connections, public.neural_interaction_events
  from public, anon, authenticated;
grant select, update on public.neural_network_config to service_role;

create or replace function public.place_neural_node(p_player_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
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
  if p_player_id is null then
    raise exception using errcode = '22023', message = 'Player ID is required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_player_id and not is_banned
  ) then
    raise exception using errcode = 'P0002', message = 'Active player profile not found';
  end if;
  if exists (select 1 from public.neural_nodes where player_id = p_player_id) then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('scamtastic-neural-placement', 0));
  if exists (select 1 from public.neural_nodes where player_id = p_player_id) then
    return false;
  end if;

  select count(*) into v_node_count from public.neural_nodes;
  if v_node_count > 0 then
    v_anchor_offset := floor(random() * v_node_count);
    select position_x, position_y, position_z
      into v_anchor_x, v_anchor_y, v_anchor_z
      from public.neural_nodes
      order by created_at, player_id
      offset v_anchor_offset
      limit 1;

    for v_attempt in 1..96 loop
      v_x := random() * 2 - 1;
      v_y := random() * 2 - 1;
      v_z := random() * 2 - 1;
      v_length := sqrt(v_x * v_x + v_y * v_y + v_z * v_z);
      if v_length < 0.000001 then
        continue;
      end if;

      v_radius := 12 + random() * 18;
      v_x := v_anchor_x + v_x / v_length * v_radius;
      v_y := v_anchor_y + v_y / v_length * v_radius;
      v_z := v_anchor_z + v_z / v_length * v_radius;

      select min(sqrt(
        power(position_x - v_x, 2)
        + power(position_y - v_y, 2)
        + power(position_z - v_z, 2)
      ))
      into v_nearest
      from public.neural_nodes;

      if v_nearest >= 8 and v_nearest <= 26 then
        exit;
      end if;
    end loop;

    if v_attempt > 96 or v_nearest is null or v_nearest < 8 or v_nearest > 26 then
      raise exception using errcode = 'P0001',
        message = 'Unable to find a well-spaced neural position; retry node creation';
    end if;
  else
    v_x := 0;
    v_y := 0;
    v_z := 0;
  end if;

  insert into public.neural_nodes(player_id, position_x, position_y, position_z)
  values (p_player_id, v_x, v_y, v_z)
  on conflict (player_id) do nothing;
  return found;
end
$$;

create or replace function public.ensure_neural_node(p_player_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_player_id is null then
    raise exception using errcode = '22023', message = 'Player ID is required';
  end if;
  if auth.role() is not null and auth.role() <> 'service_role'
    and auth.uid() is distinct from p_player_id then
    raise exception using errcode = '42501', message = 'Cannot create another player''s neuron';
  end if;
  return public.place_neural_node(p_player_id);
end
$$;

create or replace function public.create_neural_node_after_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_banned then
    begin
      perform public.place_neural_node(new.id);
    exception when others then
      raise warning 'Neural node creation failed for profile %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end
$$;

drop trigger if exists create_neural_node_after_profile_insert on public.profiles;
create trigger create_neural_node_after_profile_insert
  after insert on public.profiles
  for each row execute function public.create_neural_node_after_profile_insert();
drop trigger if exists create_neural_node_after_profile_reactivation on public.profiles;
create trigger create_neural_node_after_profile_reactivation
  after update of is_banned on public.profiles
  for each row
  when (old.is_banned and not new.is_banned)
  execute function public.create_neural_node_after_profile_insert();

create or replace function public.backfill_neural_nodes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player record;
  v_created integer := 0;
  v_failed integer := 0;
begin
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;

  for v_player in
    select p.id
    from public.profiles p
    where not p.is_banned
      and not exists (
        select 1 from public.neural_nodes n where n.player_id = p.id
      )
    order by p.created_at, p.id
  loop
    begin
      if public.place_neural_node(v_player.id) then
        v_created := v_created + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
      raise warning 'Neural node backfill failed for profile %: %', v_player.id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('created', v_created, 'failed', v_failed);
end
$$;

create or replace function public.public_neural_snapshot(
  p_limit integer default 150,
  p_offset integer default 0,
  p_connection_limit integer default 2000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 150), 1), 300);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_connection_limit integer := least(greatest(coalesce(p_connection_limit, 2000), 1), 5000);
  v_max_strength integer;
  v_total bigint;
begin
  select max_strength into v_max_strength
  from public.neural_network_config
  where singleton;
  if v_max_strength is null then
    raise exception using errcode = 'P0001', message = 'Neural network configuration is missing';
  end if;

  select count(*) into v_total
  from public.neural_nodes n
  join public.profiles p on p.id = n.player_id
  where not p.is_banned;

  return jsonb_build_object(
    'totalNodes', v_total,
    'maxStrength', v_max_strength,
    'hasMore', v_total > v_offset + v_limit,
    'nodes', coalesce((
      with selected_nodes as (
        select n.player_id
        from public.neural_nodes n
        join public.profiles p on p.id = n.player_id
        where not p.is_banned
        order by p.created_at, p.id
        limit v_limit offset v_offset
      ),
      selected_edges as (
        select c.player_a, c.player_b, c.strength, c.interaction_count, c.created_at
        from public.neural_connections c
        join public.profiles pa on pa.id = c.player_a and not pa.is_banned
        join public.profiles pb on pb.id = c.player_b and not pb.is_banned
        where c.player_a in (select player_id from selected_nodes)
           or c.player_b in (select player_id from selected_nodes)
        order by c.strength desc, c.created_at, c.player_a, c.player_b
        limit v_connection_limit
      ),
      visible_nodes as (
        select player_id from selected_nodes
        union
        select player_a from selected_edges
        union
        select player_b from selected_edges
      )
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'displayName', p.display_name,
        'avatarSeed', p.avatar_seed,
        'avatarVersion', p.avatar_generator_version,
        'x', n.position_x,
        'y', n.position_y,
        'z', n.position_z,
        'referralCount', (
          select count(*) from public.referrals r
          join public.referral_codes rc on rc.id = r.referral_code_id
          where rc.creator_id = p.id
        ),
        'connectionCount', (
          select count(*) from public.neural_connections c
          join public.profiles pa on pa.id = c.player_a and not pa.is_banned
          join public.profiles pb on pb.id = c.player_b and not pb.is_banned
          where c.player_a = p.id or c.player_b = p.id
        ),
        'interactionCount', (
          select coalesce(sum(c.interaction_count), 0) from public.neural_connections c
          join public.profiles pa on pa.id = c.player_a and not pa.is_banned
          join public.profiles pb on pb.id = c.player_b and not pb.is_banned
          where c.player_a = p.id or c.player_b = p.id
        )
      ) order by p.created_at, p.id)
      from visible_nodes v
      join public.profiles p on p.id = v.player_id and not p.is_banned
      join public.neural_nodes n on n.player_id = p.id
    ), '[]'::jsonb),
    'connections', coalesce((
      with selected_nodes as (
        select n.player_id
        from public.neural_nodes n
        join public.profiles p on p.id = n.player_id
        where not p.is_banned
        order by p.created_at, p.id
        limit v_limit offset v_offset
      )
      select jsonb_agg(jsonb_build_object(
        'playerA', c.player_a,
        'playerB', c.player_b,
        'strength', c.strength,
        'interactionCount', c.interaction_count
      ) order by c.created_at, c.player_a, c.player_b)
      from (
        select c.player_a, c.player_b, c.strength, c.interaction_count, c.created_at
        from public.neural_connections c
        join public.profiles pa on pa.id = c.player_a and not pa.is_banned
        join public.profiles pb on pb.id = c.player_b and not pb.is_banned
        where c.player_a in (select player_id from selected_nodes)
           or c.player_b in (select player_id from selected_nodes)
        order by c.strength desc, c.created_at, c.player_a, c.player_b
        limit v_connection_limit
      ) c
    ), '[]'::jsonb),
    'connectionsHasMore', (
      with selected_nodes as (
        select n.player_id
        from public.neural_nodes n
        join public.profiles p on p.id = n.player_id
        where not p.is_banned
        order by p.created_at, p.id
        limit v_limit offset v_offset
      )
      select count(*) > v_connection_limit
      from public.neural_connections c
      join public.profiles pa on pa.id = c.player_a and not pa.is_banned
      join public.profiles pb on pb.id = c.player_b and not pb.is_banned
      where c.player_a in (select player_id from selected_nodes)
         or c.player_b in (select player_id from selected_nodes)
    )
  );
end
$$;

create or replace function public.public_neural_search(p_query text, p_limit integer default 20)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', matches.id,
    'username', matches.username,
    'displayName', matches.display_name,
    'avatarSeed', matches.avatar_seed,
    'avatarVersion', matches.avatar_generator_version,
    'x', matches.position_x,
    'y', matches.position_y,
    'z', matches.position_z
  ) order by matches.username), '[]'::jsonb)
  from (
    select p.id, p.username, p.display_name, p.avatar_seed,
      p.avatar_generator_version, n.position_x, n.position_y, n.position_z
    from public.profiles p
    join public.neural_nodes n on n.player_id = p.id
    where lower(p.username) like replace(lower(btrim(p_query)), '_', E'\\_') || '%'
      escape E'\\'
      and btrim(p_query) ~ '^[A-Za-z0-9_&-]{2,24}$'
      and length(btrim(p_query)) between 2 and 24
      and p.username ~ '^[A-Za-z0-9_&-]{3,24}$'
      and not p.is_banned
    order by p.username
    limit least(greatest(coalesce(p_limit, 20), 1), 20)
  ) matches
$$;

create or replace function public.public_neural_profile(p_username text, p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 250);
  v_node jsonb;
  v_connection_count bigint;
  v_interaction_count bigint;
  v_connections jsonb;
  v_max_strength integer;
begin
  select * into v_profile
  from public.profiles p
  where lower(p.username) = lower(p_username) and not p.is_banned
  limit 1;
  if not found then
    return null;
  end if;
  select max_strength into v_max_strength
  from public.neural_network_config
  where singleton;
  if v_max_strength is null then
    raise exception using errcode = 'P0001', message = 'Neural network configuration is missing';
  end if;

  select jsonb_build_object(
    'x', n.position_x, 'y', n.position_y, 'z', n.position_z
  ) into v_node
  from public.neural_nodes n
  where n.player_id = v_profile.id;

  select count(*), coalesce(sum(c.interaction_count), 0)
  into v_connection_count, v_interaction_count
  from public.neural_connections c
  join public.profiles pa on pa.id = c.player_a and not pa.is_banned
  join public.profiles pb on pb.id = c.player_b and not pb.is_banned
  where c.player_a = v_profile.id or c.player_b = v_profile.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'playerA', c.player_a,
    'playerB', c.player_b,
    'strength', c.strength,
    'interactionCount', c.interaction_count,
    'player', jsonb_build_object(
      'id', other.id,
      'username', other.username,
      'displayName', other.display_name,
      'avatarSeed', other.avatar_seed,
      'avatarVersion', other.avatar_generator_version,
      'x', other_node.position_x,
      'y', other_node.position_y,
      'z', other_node.position_z
    )
  ) order by c.strength desc, c.created_at, other.id), '[]'::jsonb)
  into v_connections
  from (
    select c.*
    from public.neural_connections c
    join public.profiles other on other.id = case
      when c.player_a = v_profile.id then c.player_b else c.player_a end
      and not other.is_banned
    where c.player_a = v_profile.id or c.player_b = v_profile.id
    order by c.strength desc, c.created_at, c.player_a, c.player_b
    limit v_limit
  ) c
  join public.profiles other on other.id = case
    when c.player_a = v_profile.id then c.player_b else c.player_a end
    and not other.is_banned
  join public.neural_nodes other_node on other_node.player_id = other.id;

  return jsonb_build_object(
    'playerId', v_profile.id,
    'maxStrength', v_max_strength,
    'profile', public.public_profile(v_profile.username),
    'node', v_node,
    'connectionCount', v_connection_count,
    'interactionCount', v_interaction_count,
    'connections', v_connections,
    'hasMoreConnections', v_connection_count > v_limit
  );
end
$$;

create or replace function public.record_neural_interaction(
  p_source_event_id text,
  p_event_type text,
  p_player_a uuid,
  p_player_b uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a uuid := least(p_player_a, p_player_b);
  v_b uuid := greatest(p_player_a, p_player_b);
  v_max_strength integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Authorized gameplay service required';
  end if;
  if p_source_event_id is null or length(p_source_event_id) not between 1 and 200
    or p_event_type is null
    or p_event_type not in (
      'gameplay.opportunity_participation',
      'gameplay.project_collaboration',
      'gameplay.player_transaction',
      'gameplay.invitation_accepted',
      'gameplay.multiplayer_activity'
    )
    or p_player_a is null or p_player_b is null or p_player_a = p_player_b then
    raise exception using errcode = '22023', message = 'Invalid eligible gameplay event';
  end if;

  perform public.ensure_neural_node(v_a);
  perform public.ensure_neural_node(v_b);

  insert into public.neural_interaction_events(source_event_id, event_type, player_a, player_b)
  values (p_source_event_id, p_event_type, v_a, v_b)
  on conflict (source_event_id) do nothing;
  if not found then
    return false;
  end if;

  select max_strength into v_max_strength
  from public.neural_network_config
  where singleton;
  if v_max_strength is null then
    raise exception using errcode = 'P0001', message = 'Neural network configuration is missing';
  end if;

  insert into public.neural_connections(
    player_a, player_b, strength, interaction_count, created_at, updated_at
  )
  values (v_a, v_b, 1, 1, now(), now())
  on conflict (player_a, player_b) do update
  set strength = case
        when public.neural_connections.strength < v_max_strength
          then public.neural_connections.strength + 1
        else public.neural_connections.strength
      end,
      interaction_count = public.neural_connections.interaction_count + 1,
      updated_at = now();
  return true;
end
$$;

revoke all on function public.place_neural_node(uuid) from public, anon, authenticated;
revoke all on function public.ensure_neural_node(uuid) from public, anon, authenticated;
grant execute on function public.ensure_neural_node(uuid) to authenticated, service_role;
revoke all on function public.create_neural_node_after_profile_insert()
  from public, anon, authenticated;
revoke all on function public.backfill_neural_nodes() from public, anon, authenticated;
grant execute on function public.backfill_neural_nodes() to service_role;
revoke all on function public.public_neural_snapshot(integer, integer, integer) from public;
grant execute on function public.public_neural_snapshot(integer, integer, integer)
  to anon, authenticated;
revoke all on function public.public_neural_search(text, integer) from public;
grant execute on function public.public_neural_search(text, integer) to anon, authenticated;
revoke all on function public.public_neural_profile(text, integer) from public;
grant execute on function public.public_neural_profile(text, integer) to anon, authenticated;
revoke all on function public.record_neural_interaction(text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.record_neural_interaction(text, text, uuid, uuid)
  to service_role;

commit;
