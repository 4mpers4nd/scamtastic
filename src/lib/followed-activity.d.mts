export type FollowedActivityType =
  | 'gameplay.opportunity_participation'
  | 'gameplay.project_collaboration'
  | 'gameplay.multiplayer_activity';

export type PublicActivityPlayer = {
  username: string;
  displayName: string | null;
};

export type FollowedActivityItem = {
  activityType: FollowedActivityType;
  occurredAt: string;
  playerA: PublicActivityPlayer;
  playerB: PublicActivityPlayer;
};

export function parseFollowedActivity(value: unknown): FollowedActivityItem[] | null;
