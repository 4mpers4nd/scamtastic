begin;

create or replace function public.followed_player_activity(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
begin
  if v_viewer is null or not exists (
    select 1 from public.profiles where id = v_viewer and not is_banned
  ) then
    raise exception using errcode = '42501', message = 'Active player access required';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'activityType', recent.event_type,
      'occurredAt', recent.created_at,
      'playerA', jsonb_build_object(
        'username', recent.player_a_username,
        'displayName', recent.player_a_display_name
      ),
      'playerB', jsonb_build_object(
        'username', recent.player_b_username,
        'displayName', recent.player_b_display_name
      )
    ) order by recent.created_at desc, recent.source_event_id)
    from (
      select
        e.source_event_id,
        e.event_type,
        e.created_at,
        player_a.username as player_a_username,
        player_a.display_name as player_a_display_name,
        player_b.username as player_b_username,
        player_b.display_name as player_b_display_name
      from public.neural_interaction_events e
      join public.profiles player_a on player_a.id = e.player_a and not player_a.is_banned
      join public.profiles player_b on player_b.id = e.player_b and not player_b.is_banned
      where e.event_type in (
        'gameplay.opportunity_participation',
        'gameplay.project_collaboration',
        'gameplay.multiplayer_activity'
      )
        and e.created_at >= now() - interval '30 days'
        and exists (
          select 1
          from public.player_follows f
          where f.follower_id = v_viewer
            and f.followed_id in (e.player_a, e.player_b)
        )
      order by e.created_at desc, e.source_event_id
      limit v_limit
    ) recent
  ), '[]'::jsonb);
end
$$;

revoke all on function public.followed_player_activity(integer) from public, anon;
grant execute on function public.followed_player_activity(integer) to authenticated;

commit;
