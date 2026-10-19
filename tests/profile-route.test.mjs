import assert from 'node:assert/strict';
import test from 'node:test';
import { profileHref, profileUsernameFromRouteParam } from '../src/lib/profile-route.mjs';

test('profile links encode ampersands so the username remains one route segment', () => {
  const href = profileHref('Ampers&');

  assert.equal(href, '/profile/Ampers%26');
  const encodedRouteParam = new URL(href, 'https://scamtastic.test').pathname
    .split('/')
    .at(-1);
  assert.equal(profileUsernameFromRouteParam(encodedRouteParam), 'Ampers&');
  assert.equal(profileUsernameFromRouteParam('Ampers&'), 'Ampers&');
});

test('profile route params are validated after Next.js decodes them', () => {
  assert.equal(profileUsernameFromRouteParam('Ampers&'), 'Ampers&');
  assert.equal(profileUsernameFromRouteParam('Ampers%2526'), null);
  assert.equal(profileUsernameFromRouteParam('Ampers%2'), null);
  assert.equal(profileUsernameFromRouteParam(' Ampers& '), null);
  assert.equal(profileUsernameFromRouteParam(undefined), null);
});
