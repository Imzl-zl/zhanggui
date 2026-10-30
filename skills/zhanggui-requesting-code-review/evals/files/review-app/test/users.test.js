import assert from 'node:assert/strict';
import test from 'node:test';

import { findUser, findUserByName, isActive } from '../src/users.js';

function fakeDb(rows) {
  return { query: () => rows };
}

test('findUser returns the first row', () => {
  assert.deepEqual(findUser(fakeDb([{ id: 1 }]), 1), { id: 1 });
});

test('findUserByName returns the first row', () => {
  assert.deepEqual(findUserByName(fakeDb([{ name: 'ada' }]), 'ada'), { name: 'ada' });
});

test('isActive compares status', () => {
  assert.equal(isActive({ status: 'active' }), true);
});
