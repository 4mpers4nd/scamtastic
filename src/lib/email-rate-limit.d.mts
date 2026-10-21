export function consumeEmailRateLimit(
  key: string,
  now?: number,
  windowMs?: number,
): { allowed: boolean; retryAfterSeconds: number };
