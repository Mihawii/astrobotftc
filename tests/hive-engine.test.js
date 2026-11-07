import test from 'node:test';
import assert from 'node:assert';
import { LEVELS, cells, countBlocks, flatten, flattenPaths, run } from '../src/js/hive-engine.js';

const SOLUTIONS = [
  ['F', 'F', 'C', 'F', 'F'],
  ['F', 'F', 'C', 'R', 'F', 'F'],
  ['R', 'F', 'L', 'F', 'F', 'C', 'L', 'F', 'F'],
  [{ repeat: 3, body: ['F', 'C'] }, 'F'],
  [{ repeat: 6, body: ['F', 'F', 'C', 'R'] }],
];

test('every level has a solution that meets its par', () => {
  assert.strictEqual(SOLUTIONS.length, LEVELS.length);
  LEVELS.forEach((level, i) => {
    assert.strictEqual(run(level, SOLUTIONS[i]).status, 'win', `level ${i + 1}`);
    assert.strictEqual(countBlocks(SOLUTIONS[i]), level.par, `par of level ${i + 1}`);
  });
});

test('level items sit on the board and never overlap walls', () => {
  LEVELS.forEach((level, i) => {
    const board = new Set(cells(level.radius).map(String));
    const walls = new Set(level.walls.map(String));
    for (const c of [...level.pollen, level.hive, [level.start.q, level.start.r]]) {
      assert.ok(board.has(String(c)), `level ${i + 1} off board: ${c}`);
      assert.ok(!walls.has(String(c)), `level ${i + 1} inside wall: ${c}`);
    }
  });
});

test('driving into a wall or off the board crashes', () => {
  assert.strictEqual(run(LEVELS[2], ['F']).status, 'crash');
  assert.strictEqual(run(LEVELS[0], ['F', 'F', 'F', 'F', 'F', 'F']).status, 'crash');
});

test('reaching the hive without the pollen is not a win', () => {
  assert.strictEqual(run(LEVELS[0], ['F', 'F', 'F', 'F']).status, 'pollen');
});

test('collecting everything away from the hive is not a win', () => {
  assert.strictEqual(run(LEVELS[0], ['F', 'F', 'C']).status, 'lost');
});

test('an empty program does not win', () => {
  assert.strictEqual(run(LEVELS[0], []).status, 'pollen');
});

test('loops expand, including nested ones', () => {
  assert.deepStrictEqual(flatten([{ repeat: 2, body: ['F', { repeat: 2, body: ['L'] }] }]),
    ['F', 'L', 'L', 'F', 'L', 'L']);
});

test('huge loops are capped', () => {
  const result = run(LEVELS[0], [{ repeat: 9999, body: ['L'] }]);
  assert.ok(result.trace.length <= 300);
});

test('every step can be traced back to the block it came from', () => {
  const program = ['F', { repeat: 2, body: ['L', 'C'] }, 'R'];
  assert.deepStrictEqual(flattenPaths(program), [[0], [1, 0], [1, 1], [1, 0], [1, 1], [2]]);
  assert.strictEqual(flattenPaths(program).length, flatten(program).length);
});
