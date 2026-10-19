const USERNAME_PATTERN = /^[A-Za-z0-9_&-]{3,24}$/;

function isFollowMember(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.username === 'string' &&
      USERNAME_PATTERN.test(value.username) &&
      (value.displayName === null ||
        (typeof value.displayName === 'string' && value.displayName.length <= 80)),
  );
}

export function parsePublicFollowData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    !Number.isSafeInteger(value.followersCount) ||
    value.followersCount < 0 ||
    !Number.isSafeInteger(value.followingCount) ||
    value.followingCount < 0 ||
    typeof value.isFollowing !== 'boolean' ||
    !Array.isArray(value.followers) ||
    value.followers.length > 20 ||
    !Array.isArray(value.following) ||
    value.following.length > 20 ||
    !value.followers.every(isFollowMember) ||
    !value.following.every(isFollowMember)
  ) {
    return null;
  }

  return {
    followersCount: value.followersCount,
    followingCount: value.followingCount,
    isFollowing: value.isFollowing,
    followers: value.followers.map(({ username, displayName }) => ({ username, displayName })),
    following: value.following.map(({ username, displayName }) => ({ username, displayName })),
  };
}

export function parsePublicFollowPage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    !Number.isSafeInteger(value.count) ||
    value.count < 0 ||
    !Number.isSafeInteger(value.offset) ||
    value.offset < 0 ||
    !Array.isArray(value.members) ||
    value.members.length > 20 ||
    !value.members.every(isFollowMember)
  ) {
    return null;
  }

  return {
    count: value.count,
    offset: value.offset,
    members: value.members.map(({ username, displayName }) => ({ username, displayName })),
  };
}
