import { createHash, randomBytes } from 'node:crypto';

const CODE_PATTERN = /^[a-f0-9]{64}$/;

export function createInvitationCode() {
  return randomBytes(32).toString('hex');
}

export function invitationCodeHash(code) {
  if (typeof code !== 'string' || !CODE_PATTERN.test(code)) return null;
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

export function isInvitationCode(code) {
  return typeof code === 'string' && CODE_PATTERN.test(code);
}
