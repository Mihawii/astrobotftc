import test from 'node:test';
import assert from 'node:assert';
import { safeName, summarize } from '../src/js/impact.js';

test('safeName keeps first name and last initial only', () => {
  assert.strictEqual(safeName('Aruzhan Kassymova'), 'Aruzhan K.');
  assert.strictEqual(safeName('  Dana   Maria  Serik '), 'Dana S.');
  assert.strictEqual(safeName('Timur'), 'Timur');
  assert.strictEqual(safeName('Әлия Қасым'), 'Әлия Қ.');
  assert.strictEqual(safeName(''), '');
  assert.strictEqual(safeName(null), '');
});

test('summarize totals outreach and the recurring share', () => {
  const s = summarize([
    { people: 40, hours: 3, recurring: true, newToFirst: 5 },
    { people: 10, hours: 1, recurring: false },
  ]);
  assert.deepStrictEqual(s, { events: 2, people: 50, hours: 4, newToFirst: 5, recurringShare: 50 });
});

test('summarize copes with empty and bad input', () => {
  assert.strictEqual(summarize([]).recurringShare, 0);
  assert.strictEqual(summarize(undefined).events, 0);
  assert.strictEqual(summarize([{ people: 'x' }]).people, 0);
});
