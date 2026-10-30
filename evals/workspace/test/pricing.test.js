import assert from 'node:assert/strict';
import test from 'node:test';

import { shippingFor, taxFor } from '../src/pricing.js';

test('taxFor applies the standard rate', () => {
  assert.equal(taxFor(20), 2);
});

test('shippingFor is free at or above the threshold', () => {
  assert.equal(shippingFor(50), 0);
  assert.equal(shippingFor(49.99), 4.99);
});
