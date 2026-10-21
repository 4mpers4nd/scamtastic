const USERNAME_PATTERN = /^[A-Za-z0-9_&-]{3,24}$/;

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function parseLeaderboard(value) {
  if (!Array.isArray(value) || value.length > 5) return null;
  const entries = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.username !== 'string' ||
      !USERNAME_PATTERN.test(item.username) ||
      !(item.displayName === null ||
        (typeof item.displayName === 'string' && item.displayName.length <= 80)) ||
      !isCount(item.value)
    ) return null;
    entries.push({
      username: item.username,
      displayName: item.displayName,
      value: item.value,
    });
  }
  return entries;
}

export function parseNetworkDashboard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mostConnected = parseLeaderboard(value.mostConnected);
  const mostInteractions = parseLeaderboard(value.mostInteractions);
  if (
    !isCount(value.playerCount) ||
    !isCount(value.connectionCount) ||
    !isCount(value.interactionCount) ||
    !mostConnected ||
    !mostInteractions
  ) return null;

  return {
    playerCount: value.playerCount,
    connectionCount: value.connectionCount,
    interactionCount: value.interactionCount,
    mostConnected,
    mostInteractions,
  };
}
