import assert from 'node:assert/strict';
import test from 'node:test';

import { lineTotal, payableTotal, subtotal } from '../src/cart.js';

const book = { sku: 'book', price: 20, quantity: 1 };
const lamp = { sku: 'lamp', price: 55, quantity: 1 };

test('lineTotal multiplies price by quantity', () => {
  assert.equal(lineTotal({ price: 12.5, quantity: 3 }), 37.5);
});

test('subtotal adds every line', () => {
  assert.equal(subtotal([book, lamp]), 75);
});

test('payableTotal with no coupon adds tax and shipping', () => {
  assert.equal(payableTotal([book]), 26.99);
});

test('a coupon lowers the amount that tax and shipping are charged on', () => {
  // 55 - 20% = 44, tax 10% of 44 = 4.40, shipping stays payable below 50
  assert.equal(payableTotal([lamp], 20), 53.39);
});
