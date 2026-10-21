import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInvitationCode,
  invitationCodeHash,
  isInvitationCode,
} from '../src/lib/invitation-code.mjs';

test('invitation codes are cryptographically random, fixed-length tokens', () => {
  const first = createInvitationCode();
  const second = createInvitationCode();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.match(second, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
});

test('invitation hashes reject malformed tokens and are deterministic', () => {
  const code = 'a'.repeat(64);
  assert.equal(isInvitationCode(code), true);
  assert.equal(invitationCodeHash(code), invitationCodeHash(code));
  assert.equal(invitationCodeHash('bad'), null);
  assert.equal(isInvitationCode(`${code}a`), false);
  assert.equal(invitationCodeHash(null), null);
});
