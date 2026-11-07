import test from 'node:test';
import assert from 'node:assert';
import { AWARDS, PORTFOLIO_RULES, TEAM_GATES } from '../src/js/inspire-data.js';
import { awardCovered, cleanState, criterionId, readiness } from '../src/js/inspire-logic.js';

const byId = (id) => AWARDS.find((a) => a.id === id);

function markRequired(marks, award) {
  award.criteria.forEach(([kind], i) => {
    if (kind === 'required') marks[criterionId(award, i)] = 'ready';
  });
  return marks;
}

const allGates = Object.fromEntries(TEAM_GATES.map(([id]) => [id, true]));

test('an award needs every required line to be ready', () => {
  const award = byId('reach');
  assert.strictEqual(awardCovered(award, {}), false);
  assert.strictEqual(awardCovered(award, { 'reach-0': 'ready', 'reach-1': 'draft' }), false);
  assert.strictEqual(awardCovered(award, { 'reach-0': 'ready', 'reach-1': 'ready' }), true);
});

test('Inspire needs one award in every category plus the team gates', () => {
  const marks = {};
  ['think', 'control', 'sustain'].forEach((id) => markRequired(marks, byId(id)));
  assert.strictEqual(readiness(AWARDS, TEAM_GATES, marks, allGates).ready, true);
  assert.strictEqual(readiness(AWARDS, TEAM_GATES, marks, {}).ready, false);
});

test('two awards in one category do not replace a missing category', () => {
  const marks = {};
  ['think', 'control', 'design'].forEach((id) => markRequired(marks, byId(id)));
  const result = readiness(AWARDS, TEAM_GATES, marks, allGates);
  assert.strictEqual(result.ready, false);
  assert.deepStrictEqual(result.missingGroups, ['ta']);
});

test('imported state keeps only known fields', () => {
  const state = cleanState({
    marks: { 'reach-0': 'ready', 'reach-1': 'hacked', 'nope-0': 'ready' },
    notes: { 'reach-0': 'page 4', 'reach-1': 42 },
    checks: { portfolio: true, cover: 'yes', unknown: true },
    extra: 1,
  }, AWARDS, TEAM_GATES, PORTFOLIO_RULES);
  assert.deepStrictEqual(state, {
    marks: { 'reach-0': 'ready' }, notes: { 'reach-0': 'page 4' }, checks: { portfolio: true },
  });
});

test('bad imports give an empty state', () => {
  const empty = { marks: {}, notes: {}, checks: {} };
  for (const bad of [null, 'text', 7, { marks: 'x', notes: [], checks: null }]) {
    assert.deepStrictEqual(cleanState(bad, AWARDS, TEAM_GATES, PORTFOLIO_RULES), empty);
  }
});
