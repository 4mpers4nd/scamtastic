import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { getAccessDecision, getUserOrNull, isUnauthenticatedAuthError } from '../src/lib/auth-state.mjs';

const anonymousErrors = [
  { name: 'AuthSessionMissingError', status: 400 },
  { name: 'AuthApiError', status: 401, code: 'unauthorized' },
  { name: 'AuthApiError', status: 400, code: 'session_expired' },
  { name: 'AuthApiError', status: 400, code: 'refresh_token_not_found' },
  { name: 'AuthInvalidJwtError', status: 400, code: 'bad_jwt' },
];

test('anonymous session errors resolve to an unauthenticated user', async () => {
  for (const error of anonymousErrors) {
    const user = await getUserOrNull({
      async getUser() {
        return { data: { user: null }, error };
      },
    });
    assert.equal(user, null);
    assert.equal(isUnauthenticatedAuthError(error), true);
  }

  assert.equal(getAccessDecision(null), 'login');
});

test('Supabase client with no stored session resolves anonymously without a request', async () => {
  const client = createClient('http://127.0.0.1:54321', 'test-anon-key');
  assert.equal(await getUserOrNull(client.auth), null);
});

test('authenticated users are preserved and may access protected routes', async () => {
  const user = { id: 'player-id' };
  const result = await getUserOrNull({
    async getUser() {
      return { data: { user }, error: null };
    },
  });

  assert.equal(result, user);
  assert.equal(getAccessDecision(result), 'allow');
  assert.equal(getAccessDecision(result, { adminOnly: true, isAdmin: true }), 'allow');
});

test('protected and administrator routes reject anonymous and non-admin users', () => {
  assert.equal(getAccessDecision(null), 'login');
  assert.equal(getAccessDecision({ id: 'player-id' }, { adminOnly: true }), 'forbidden');
});

test('unexpected authentication service errors are not hidden', async () => {
  const failure = { name: 'AuthUnknownError', status: 503, message: 'Auth service unavailable' };
  await assert.rejects(
    getUserOrNull({
      async getUser() {
        return { data: { user: null }, error: failure };
      },
    }),
    (error) => error === failure,
  );

  assert.equal(isUnauthenticatedAuthError(failure), false);
});
