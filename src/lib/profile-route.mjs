const USERNAME_PATTERN = /^[A-Za-z0-9_&-]{3,24}$/;

export function profileHref(username) {
  return `/profile/${encodeURIComponent(username)}`;
}

export function profileUsernameFromRouteParam(value) {
  if (typeof value !== 'string') return null;

  let username = value;
  if (value.includes('%')) {
    try {
      username = decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  return USERNAME_PATTERN.test(username) ? username : null;
}
