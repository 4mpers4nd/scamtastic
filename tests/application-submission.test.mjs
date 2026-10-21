import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applicationFormPayload,
  applicationRpcCall,
} from '../src/lib/application-submission.mjs';

test('application form payload excludes legacy referrals and retains player invitations', () => {
  const payload = applicationFormPayload({
    username: 'Ampers&',
    email: 'player@example.test',
    reason: 'I want to join the network.',
    invitationCode: 'a'.repeat(64),
    comments: 'Optional note',
    referralCode: 'LEGACY-REFERRAL',
  });

  assert.deepEqual(payload, {
    username: 'Ampers&',
    email: 'player@example.test',
    reason: 'I want to join the network.',
    invitationCode: 'a'.repeat(64),
    comments: 'Optional note',
  });
  assert.equal('referralCode' in payload, false);
});

test('application RPC keeps legacy signature compatible but never processes a referral', () => {
  const common = {
    rateKey: 'rate-key',
    username: 'Player_1',
    email: 'player@example.test',
    reason: 'I want to join the network.',
    comments: null,
  };
  const normal = applicationRpcCall({ ...common, invitationHash: null });
  assert.equal(normal.functionName, 'submit_scamtastic_application');
  assert.equal(normal.args.p_referral_code, null);

  const invited = applicationRpcCall({ ...common, invitationHash: 'a'.repeat(64) });
  assert.equal(invited.functionName, 'submit_invited_application');
  assert.equal(invited.args.p_referral_code, null);
  assert.equal(invited.args.p_invitation_hash, 'a'.repeat(64));
});
