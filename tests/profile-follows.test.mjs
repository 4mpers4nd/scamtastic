import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePublicFollowData, parsePublicFollowPage } from '../src/lib/profile-follows.mjs';

test('public follow data accepts usernames with ampersands and returns only public fields', () => {
  const parsed = parsePublicFollowData({
    followersCount: 1,
    followingCount: 2,
    isFollowing: true,
    followers: [{ username: 'Ampers&', displayName: 'Ampers', email: 'private@example.com' }],
    following: [],
    privateMetadata: 'not exposed',
  });

  assert.deepEqual(parsed, {
    followersCount: 1,
    followingCount: 2,
    isFollowing: true,
    followers: [{ username: 'Ampers&', displayName: 'Ampers' }],
    following: [],
  });
});

test('follow-list pagination keeps ampersand usernames public and bounded', () => {
  assert.deepEqual(
    parsePublicFollowPage({
      count: 21,
      offset: 20,
      members: [{ username: 'Ampers&', displayName: 'Ampers', email: 'private@example.com' }],
    }),
    {
      count: 21,
      offset: 20,
      members: [{ username: 'Ampers&', displayName: 'Ampers' }],
    },
  );
  assert.equal(
    parsePublicFollowPage({
      count: 42,
      offset: 20,
      members: Array(21).fill({ username: 'Player_1', displayName: null }),
    }),
    null,
  );
});

test('public follow data rejects malformed counts, usernames, and member lists', () => {
  const valid = {
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
    followers: [],
    following: [],
  };

  assert.equal(parsePublicFollowData({ ...valid, followersCount: -1 }), null);
  assert.equal(parsePublicFollowData({ ...valid, followers: [{ username: 'bad@email.com', displayName: null }] }), null);
  assert.equal(parsePublicFollowData({ ...valid, following: {} }), null);
  assert.equal(parsePublicFollowData({ ...valid, following: Array(21).fill({ username: 'Player_1', displayName: null }) }), null);
});
