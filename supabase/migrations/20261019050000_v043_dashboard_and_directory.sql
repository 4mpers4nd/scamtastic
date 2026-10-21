begin;

create or replace function public.public_network_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with active_connections as (
    select c.player_a, c.player_b, c.interaction_count
    from public.neural_connections c
    join public.profiles a on a.id = c.player_a and not a.is_banned
    join public.profiles b on b.id = c.player_b and not b.is_banned
  ), player_edges as (
    select player_a as player_id, interaction_count from active_connections
    union all
    select player_b as player_id, interaction_count from active_connections
  ), edge_totals as (
    select player_id, count(*)::bigint as connection_count,
      coalesce(sum(interaction_count), 0)::bigint as interaction_count
    from player_edges
    group by player_id
  ), player_totals as (
    select p.id, p.username, p.display_name,
      coalesce(t.connection_count, 0)::bigint as connection_count,
      coalesce(t.interaction_count, 0)::bigint as interaction_count
    from public.profiles p
    join public.neural_nodes n on n.player_id = p.id
    left join edge_totals t on t.player_id = p.id
    where not p.is_banned
  )
  select jsonb_build_object(
    'playerCount', (
      select count(*) from public.neural_nodes n
      join public.profiles p on p.id = n.player_id
      where not p.is_banned
    ),
    'connectionCount', (select count(*) from active_connections),
    'interactionCount', (select coalesce(sum(interaction_count), 0) from active_connections),
    'mostConnected', coalesce((
      select jsonb_agg(jsonb_build_object(
        'username', ranked.username,
        'displayName', ranked.display_name,
        'value', ranked.connection_count
      ) order by ranked.connection_count desc, ranked.username)
      from (
        select username, display_name, connection_count
        from player_totals
        where connection_count > 0
        order by connection_count desc, username
        limit 5
      ) ranked
    ), '[]'::jsonb),
    'mostInteractions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'username', ranked.username,
        'displayName', ranked.display_name,
        'value', ranked.interaction_count
      ) order by ranked.interaction_count desc, ranked.username)
      from (
        select username, display_name, interaction_count
        from player_totals
        where interaction_count > 0
        order by interaction_count desc, username
        limit 5
      ) ranked
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.public_network_dashboard() from public;
grant execute on function public.public_network_dashboard() to anon, authenticated;

create or replace function public.public_player_follow_page(
  p_username text,
  p_direction text,
  p_offset integer default 0,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target uuid;
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 1000000);
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_count bigint;
  v_members jsonb;
begin
  if p_direction is null or p_direction not in ('followers', 'following') then
    raise exception using errcode = '22023', message = 'Invalid follow-list direction';
  end if;

  select id into v_target
  from public.profiles
  where lower(username) = lower(p_username) and not is_banned;
  if v_target is null then return null; end if;

  if p_direction = 'followers' then
    select count(*) into v_count
    from public.player_follows f
    join public.profiles p on p.id = f.follower_id and not p.is_banned
    where f.followed_id = v_target;

    select coalesce(jsonb_agg(jsonb_build_object(
      'username', members.username,
      'displayName', members.display_name
    ) order by members.created_at desc, members.username), '[]'::jsonb)
    into v_members
    from (
      select p.username, p.display_name, f.created_at
      from public.player_follows f
      join public.profiles p on p.id = f.follower_id and not p.is_banned
      where f.followed_id = v_target
      order by f.created_at desc, p.username
      limit v_limit offset v_offset
    ) members;
  else
    select count(*) into v_count
    from public.player_follows f
    join public.profiles p on p.id = f.followed_id and not p.is_banned
    where f.follower_id = v_target;

    select coalesce(jsonb_agg(jsonb_build_object(
      'username', members.username,
      'displayName', members.display_name
    ) order by members.created_at desc, members.username), '[]'::jsonb)
    into v_members
    from (
      select p.username, p.display_name, f.created_at
      from public.player_follows f
      join public.profiles p on p.id = f.followed_id and not p.is_banned
      where f.follower_id = v_target
      order by f.created_at desc, p.username
      limit v_limit offset v_offset
    ) members;
  end if;

  return jsonb_build_object(
    'count', v_count,
    'offset', v_offset,
    'members', v_members
  );
end
$$;

revoke all on function public.public_player_follow_page(text, text, integer, integer) from public;
grant execute on function public.public_player_follow_page(text, text, integer, integer) to anon, authenticated;

create or replace function public.admin_list_players_page(
  p_search text default '',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := left(btrim(coalesce(p_search, '')), 100);
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 1000000);
  v_total bigint;
  v_players jsonb;
begin
  perform public.assert_scamtastic_admin();

  select count(*) into v_total
  from public.profiles p
  where v_search = ''
    or p.username ilike '%' || v_search || '%'
    or coalesce(p.display_name, '') ilike '%' || v_search || '%';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', page.id,
    'username', page.username,
    'display_name', page.display_name,
    'avatar_seed', page.avatar_seed,
    'avatar_generator_version', page.avatar_generator_version,
    'is_banned', page.is_banned,
    'is_founder', page.is_founder,
    'is_admin', page.is_admin,
    'created_at', page.created_at,
    'invitation_credits', page.invitation_credits,
    'invitation_count', page.invitation_count,
    'recruited_count', page.recruited_count
  ) order by page.created_at desc, page.id), '[]'::jsonb)
  into v_players
  from (
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_seed,
      p.avatar_generator_version,
      p.is_banned,
      p.created_at,
      exists (select 1 from public.founder_badges fb where fb.user_id = p.id) as is_founder,
      exists (
        select 1 from public.admin_users au
        where coalesce(to_jsonb(au)->>'user_id', to_jsonb(au)->>'profile_id',
          to_jsonb(au)->>'admin_id', to_jsonb(au)->>'auth_user_id',
          to_jsonb(au)->>'id') = p.id::text
      ) as is_admin,
      coalesce(c.available, 0) as invitation_credits,
      (select count(*) from public.player_invitations i where i.inviter_id = p.id) as invitation_count,
      (select count(*) from public.player_invitations i
        where i.inviter_id = p.id and i.status = 'redeemed') as recruited_count
    from public.profiles p
    left join public.player_invitation_credits c on c.player_id = p.id
    where v_search = ''
      or p.username ilike '%' || v_search || '%'
      or coalesce(p.display_name, '') ilike '%' || v_search || '%'
    order by p.created_at desc, p.id
    limit v_limit offset v_offset
  ) page;

  return jsonb_build_object('players', v_players, 'total', v_total);
end
$$;

create or replace function public.admin_get_player(p_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_scamtastic_admin();
  return (
    select jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'display_name', p.display_name,
      'bio', p.bio,
      'is_banned', p.is_banned,
      'is_founder', exists (select 1 from public.founder_badges fb where fb.user_id = p.id),
      'is_admin', exists (
        select 1 from public.admin_users au
        where coalesce(to_jsonb(au)->>'user_id', to_jsonb(au)->>'profile_id',
          to_jsonb(au)->>'admin_id', to_jsonb(au)->>'auth_user_id',
          to_jsonb(au)->>'id') = p.id::text
      ),
      'created_at', p.created_at
    )
    from public.profiles p where p.id = p_player_id
  );
end
$$;

revoke all on function public.admin_list_players_page(text, integer, integer) from public, anon;
grant execute on function public.admin_list_players_page(text, integer, integer) to authenticated;
revoke all on function public.admin_get_player(uuid) from public, anon;
grant execute on function public.admin_get_player(uuid) to authenticated;

commit;
