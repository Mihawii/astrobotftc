import test from 'node:test';
import assert from 'node:assert';
import { hashForView, viewFromHash } from '../src/js/routes.js';

test('hashes map to views and unknown ones fall back to home', () => {
  assert.strictEqual(viewFromHash('#/play'), 'play');
  assert.strictEqual(viewFromHash('#/story'), 'story');
  assert.strictEqual(viewFromHash('#/'), 'home');
  assert.strictEqual(viewFromHash(''), 'home');
  assert.strictEqual(viewFromHash('#/nope'), 'home');
  assert.strictEqual(viewFromHash('#/season?x=1'), 'season');
});

test('views map back to hashes', () => {
  assert.strictEqual(hashForView('home'), '#/');
  assert.strictEqual(hashForView('play'), '#/play');
});
