const requests = new Map();

export function consumeEmailRateLimit(key, now = Date.now(), windowMs = 5 * 60_000) {
  for (const [entryKey, expiresAt] of requests) {
    if (expiresAt <= now) requests.delete(entryKey);
  }

  const expiresAt = requests.get(key);
  if (expiresAt && expiresAt > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((expiresAt - now) / 1000) };
  }

  requests.set(key, now + windowMs);
  return { allowed: true, retryAfterSeconds: 0 };
}
