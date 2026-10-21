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

export type PublicFollowPage = {
  count: number;
  offset: number;
  members: PublicFollowMember[];
};

export function parsePublicFollowData(value: unknown): PublicFollowData | null;
export function parsePublicFollowPage(value: unknown): PublicFollowPage | null;
