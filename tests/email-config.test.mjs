import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  administratorInvitationCallbackUrl,
  activationCallbackUrl,
  emailSenderConfig,
  emailSiteUrl,
} from '../src/lib/email-config.mjs';
import { consumeEmailRateLimit } from '../src/lib/email-rate-limit.mjs';

test('approval callback uses the configured preview deployment origin', () => {
  const siteUrl = emailSiteUrl({
    siteUrl: 'https://scamtastic-git-development-team.vercel.app',
    vercelEnv: 'preview',
    productionUrl: 'scamtastic.online',
    nodeEnv: 'production',
  });
  const callback = activationCallbackUrl(siteUrl, 'one-time-token', 'invite');

  assert.equal(
    callback.toString(),
    'https://scamtastic-git-development-team.vercel.app/auth/callback?token_hash=one-time-token&type=invite&next=%2Factivate',
  );
  assert.notEqual(new URL(callback).hostname, 'scamtastic.online');
});

test('administrator invitation callbacks preserve a validated one-time code on the configured host', () => {
  const callback = administratorInvitationCallbackUrl(
    'https://preview.scamtastic.test',
    'activation-hash',
    'invite',
    'a'.repeat(64),
  );
  assert.equal(callback.origin, 'https://preview.scamtastic.test');
  assert.equal(callback.searchParams.get('next'), `/invite/${'a'.repeat(64)}`);
  assert.throws(() =>
    administratorInvitationCallbackUrl('https://preview.scamtastic.test', 'hash', 'invite', '../production'),
  );
});

test('preview and development email links cannot point at production', () => {
  assert.throws(
    () =>
      emailSiteUrl({
        siteUrl: 'https://scamtastic.online',
        vercelEnv: 'preview',
        productionUrl: 'scamtastic.online',
        nodeEnv: 'production',
      }),
    /points to the production host/,
  );
  assert.throws(
    () =>
      emailSiteUrl({
        siteUrl: 'https://scamtastic.online',
        vercelEnv: 'development',
        productionUrl: 'scamtastic.online',
        nodeEnv: 'development',
      }),
    /Development email delivery is disabled/,
  );
});

test('missing sender configuration identifies variables without revealing values', () => {
  assert.throws(
    () =>
      emailSenderConfig({
        siteUrl: 'http://localhost:3000',
        nodeEnv: 'development',
      }),
    (error) => {
      assert.match(error.message, /RESEND_API_KEY/);
      assert.match(error.message, /EMAIL_FROM/);
      assert.doesNotMatch(error.message, /secret|token-value/i);
      return true;
    },
  );
});

test('test-email rate limit allows one send per key per time window', () => {
  const key = `admin-${randomUUID()}`;

  assert.deepEqual(consumeEmailRateLimit(key, 1000, 300_000), {
    allowed: true,
    retryAfterSeconds: 0,
  });
  assert.deepEqual(consumeEmailRateLimit(key, 2000, 300_000), {
    allowed: false,
    retryAfterSeconds: 299,
  });
  assert.equal(consumeEmailRateLimit(key, 301_000, 300_000).allowed, true);
});
