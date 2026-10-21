const USERNAME_PATTERN = /^[A-Za-z0-9_&-]{3,24}$/;
const PUBLIC_ACTIVITY_TYPES = new Set([
  'gameplay.opportunity_participation',
  'gameplay.project_collaboration',
  'gameplay.multiplayer_activity',
]);

function isPublicPlayer(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.username === 'string' &&
      USERNAME_PATTERN.test(value.username) &&
      (value.displayName === null ||
        (typeof value.displayName === 'string' && value.displayName.length <= 80)),
  );
}

export function parseFollowedActivity(value) {
  if (!Array.isArray(value) || value.length > 50) return null;
  const items = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      !PUBLIC_ACTIVITY_TYPES.has(item.activityType) ||
      typeof item.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(item.occurredAt)) ||
      !isPublicPlayer(item.playerA) ||
      !isPublicPlayer(item.playerB)
    ) {
      return null;
    }
    items.push({
      activityType: item.activityType,
      occurredAt: item.occurredAt,
      playerA: {
        username: item.playerA.username,
        displayName: item.playerA.displayName,
      },
      playerB: {
        username: item.playerB.username,
        displayName: item.playerB.displayName,
      },
    });
  }
  return items;
}
