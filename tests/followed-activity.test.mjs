import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFollowedActivity } from '../src/lib/followed-activity.mjs';

test('followed activity keeps only safe fields and supported public event types', () => {
  const parsed = parseFollowedActivity([{
    activityType: 'gameplay.project_collaboration',
    occurredAt: '2026-10-19T12:00:00.000Z',
    playerA: { username: 'Ampers&', displayName: 'Ampers', email: 'private@example.com' },
    playerB: { username: 'Player_2', displayName: null },
    sourceEventId: 'private-event-id',
  }]);

  assert.deepEqual(parsed, [{
    activityType: 'gameplay.project_collaboration',
    occurredAt: '2026-10-19T12:00:00.000Z',
    playerA: { username: 'Ampers&', displayName: 'Ampers' },
    playerB: { username: 'Player_2', displayName: null },
  }]);
});

test('followed activity rejects unsupported events and invalid timestamps', () => {
  const valid = {
    activityType: 'gameplay.multiplayer_activity',
    occurredAt: '2026-10-19T12:00:00.000Z',
    playerA: { username: 'Player_1', displayName: null },
    playerB: { username: 'Player_2', displayName: null },
  };

  assert.equal(parseFollowedActivity([{ ...valid, activityType: 'gameplay.player_transaction' }]), null);
  assert.equal(parseFollowedActivity([{ ...valid, occurredAt: 'not-a-date' }]), null);
  assert.equal(parseFollowedActivity(Array.from({ length: 51 }, () => valid)), null);
});
