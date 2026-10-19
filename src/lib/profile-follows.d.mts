export type PublicFollowMember = {
  username: string;
  displayName: string | null;
};

export type PublicFollowData = {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followers: PublicFollowMember[];
  following: PublicFollowMember[];
};

export function parsePublicFollowData(value: unknown): PublicFollowData | null;
