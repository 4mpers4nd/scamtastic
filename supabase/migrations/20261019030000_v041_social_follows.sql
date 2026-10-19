begin;

create table public.player_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index player_follows_followed_created_idx
  on public.player_follows(followed_id, created_at desc);
create index player_follows_follower_created_idx
  on public.player_follows(follower_id, created_at desc);

alter table public.player_follows enable row level security;
revoke all on public.player_follows from public, anon, authenticated;
grant all on public.player_follows to service_role;

create or replace function public.public_player_follow_data(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target uuid;
  v_viewer uuid := auth.uid();
begin
  select id into v_target
  from public.profiles
  where lower(username) = lower(p_username) and not is_banned;
  if v_target is null then return null; end if;

  return jsonb_build_object(
    'followersCount', (
      select count(*)
      from public.player_follows f
      join public.profiles follower on follower.id = f.follower_id and not follower.is_banned
      where f.followed_id = v_target
    ),
    'followingCount', (
      select count(*)
      from public.player_follows f
      join public.profiles followed on followed.id = f.followed_id and not followed.is_banned
      where f.follower_id = v_target
    ),
    'isFollowing', (
      v_viewer is not null and exists (
        select 1 from public.profiles
        where id = v_viewer and not is_banned
      ) and exists (
        select 1 from public.player_follows f
        where f.follower_id = v_viewer and f.followed_id = v_target
      )
    ),
    'followers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'username', recent.username,
        'displayName', recent.display_name
      ) order by recent.created_at desc, recent.username)
      from (
        select follower.username, follower.display_name, f.created_at
        from public.player_follows f
        join public.profiles follower on follower.id = f.follower_id and not follower.is_banned
        where f.followed_id = v_target
        order by f.created_at desc, follower.username
        limit 20
      ) recent
    ), '[]'::jsonb),
    'following', coalesce((
      select jsonb_agg(jsonb_build_object(
        'username', recent.username,
        'displayName', recent.display_name
      ) order by recent.created_at desc, recent.username)
      from (
        select followed.username, followed.display_name, f.created_at
        from public.player_follows f
        join public.profiles followed on followed.id = f.followed_id and not followed.is_banned
        where f.follower_id = v_target
        order by f.created_at desc, followed.username
        limit 20
      ) recent
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.follow_player(p_username text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_follower uuid := auth.uid();
  v_target uuid;
begin
  if v_follower is null or not exists (
    select 1 from public.profiles where id = v_follower and not is_banned
  ) then
    raise exception using errcode = '42501', message = 'Active player access required';
  end if;

  select id into v_target
  from public.profiles
  where lower(username) = lower(p_username) and not is_banned;
  if v_target is null then
    raise exception using errcode = 'P0002', message = 'Active player profile not found';
  end if;
  if v_follower = v_target then
    raise exception using errcode = '22023', message = 'Players cannot follow themselves';
  end if;

  insert into public.player_follows(follower_id, followed_id)
  values (v_follower, v_target)
  on conflict (follower_id, followed_id) do nothing;
  return found;
end
$$;

create or replace function public.unfollow_player(p_username text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_follower uuid := auth.uid();
  v_target uuid;
begin
  if v_follower is null or not exists (
    select 1 from public.profiles where id = v_follower and not is_banned
  ) then
    raise exception using errcode = '42501', message = 'Active player access required';
  end if;

  select id into v_target
  from public.profiles
  where lower(username) = lower(p_username) and not is_banned;
  if v_target is null then
    raise exception using errcode = 'P0002', message = 'Active player profile not found';
  end if;
  if v_follower = v_target then
    raise exception using errcode = '22023', message = 'Players cannot follow themselves';
  end if;

  delete from public.player_follows
  where follower_id = v_follower and followed_id = v_target;
  return found;
end
$$;

revoke all on function public.public_player_follow_data(text) from public;
grant execute on function public.public_player_follow_data(text) to anon, authenticated;
revoke all on function public.follow_player(text) from public, anon;
grant execute on function public.follow_player(text) to authenticated;
revoke all on function public.unfollow_player(text) from public, anon;
grant execute on function public.unfollow_player(text) to authenticated;

commit;
