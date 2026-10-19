import assert from 'node:assert/strict';
import test from 'node:test';
import { profileHref, profileUsernameFromRouteParam } from '../src/lib/profile-route.mjs';

test('profile links encode ampersands so the username remains one route segment', () => {
  const href = profileHref('Ampers&');

  assert.equal(href, '/profile/Ampers%26');
  assert.equal(
    profileUsernameFromRouteParam(
      decodeURIComponent(
        new URL(href, 'https://scamtastic.test').pathname.split('/').at(-1),
      ),
    ),
    'Ampers&',
  );
});

test('profile route params are validated after Next.js decodes them', () => {
  assert.equal(profileUsernameFromRouteParam('Ampers&'), 'Ampers&');
  assert.equal(profileUsernameFromRouteParam(' Ampers& '), null);
  assert.equal(profileUsernameFromRouteParam('Ampers%26'), null);
  assert.equal(profileUsernameFromRouteParam(undefined), null);
});
