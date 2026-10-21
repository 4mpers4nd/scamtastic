import assert from 'node:assert/strict';
import test from 'node:test';
import {
  creatorStoreHref,
  marketplaceProductHref,
  validProductId,
} from '../src/lib/storefront-links.mjs';

test('creator storefront links preserve encoded usernames and reopen selected products', () => {
  const href = creatorStoreHref('Ampers&', 'tool_42');
  assert.equal(href, '/profile/Ampers%26?tab=store&product=tool_42');
  const url = new URL(href, 'https://scamtastic.test');
  assert.equal(url.pathname, '/profile/Ampers%26');
  assert.equal(url.searchParams.get('tab'), 'store');
  assert.equal(url.searchParams.get('product'), 'tool_42');
});

test('marketplace modal links are bookmarkable and validate stable product ids', () => {
  const href = marketplaceProductHref('game-01', 'Ampers&');
  assert.equal(href, '/marketplace?product=game-01&creator=Ampers%26');
  assert.equal(validProductId('game-01'), 'game-01');
  assert.equal(validProductId('../private'), null);
  assert.equal(validProductId(''), null);
});
