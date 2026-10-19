const unauthenticatedCodes = new Set([
  'bad_jwt',
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_expired',
  'session_not_found',
  'user_not_found',
]);

export function isUnauthenticatedAuthError(error) {
  if (!error || typeof error !== 'object') return false;

  if (error.name === 'AuthSessionMissingError' || error.name === 'AuthInvalidJwtError') {
    return true;
  }

  return (
    error.name === 'AuthApiError' &&
    (error.status === 401 || unauthenticatedCodes.has(error.code))
  );
}

export async function getUserOrNull(auth) {
  const { data, error } = await auth.getUser();
  if (error) {
    if (isUnauthenticatedAuthError(error)) return null;
    throw error;
  }
  return data.user;
}

export function getAccessDecision(user, { adminOnly = false, isAdmin = false } = {}) {
  if (!user) return 'login';
  if (adminOnly && !isAdmin) return 'forbidden';
  return 'allow';
}
