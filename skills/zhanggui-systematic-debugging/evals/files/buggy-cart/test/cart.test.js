import assert from 'node:assert/strict';
import test from 'node:test';
import { subtotal, total } from '../src/cart.js';

test('subtotal multiplies price by quantity', () => {
  assert.equal(subtotal([{ price: 30, qty: 2 }, { price: 40, qty: 1 }]), 100);
});

test('spending 100 or more saves 20', () => {
  assert.equal(total([{ price: 60, qty: 1 }, { price: 50, qty: 1 }]), 90);
});

test('spending under 100 saves nothing', () => {
  assert.equal(total([{ price: 30, qty: 1 }]), 30);
});
