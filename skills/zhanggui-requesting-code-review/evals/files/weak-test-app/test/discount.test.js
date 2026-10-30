import assert from 'node:assert/strict';
import test from 'node:test';

import { discountFor } from '../src/discount.js';

test('discount works', () => {
  assert.equal(discountFor(100), discountFor(100));
});

test('discount is zero below the threshold', () => {
  assert.equal(discountFor(50), 0);
});
