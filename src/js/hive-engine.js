/* Rules of the Hive Pilot game. No DOM here, so the levels can be tested. */
// Axial hex directions, clockwise from east.
export const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const MAX_STEPS = 300;

export const LEVELS = [
  { radius: 3, start: { q: -2, r: 0, dir: 0 }, pollen: [[0, 0]], walls: [], hive: [2, 0], par: 5 },
  { radius: 3, start: { q: -2, r: 0, dir: 0 }, pollen: [[0, 0]], walls: [], hive: [0, 2], par: 6 },
  { radius: 3, start: { q: -2, r: 0, dir: 0 }, pollen: [[0, 1]], walls: [[-1, 0], [0, 0]], hive: [2, -1], par: 9 },
  { radius: 3, start: { q: -3, r: 0, dir: 0 }, pollen: [[-2, 0], [-1, 0], [0, 0]], walls: [], hive: [1, 0], par: 4 },
  {
    radius: 3,
    start: { q: 2, r: -2, dir: 1 },
    pollen: [[2, 0], [0, 2], [-2, 2], [-2, 0], [0, -2]],
    walls: [[0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]],
    hive: [2, -2],
    par: 5,
  },
];

export const key = (q, r) => `${q},${r}`;
const inBounds = (q, r, radius) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius;

export function cells(radius) {
  const out = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (inBounds(q, r, radius)) out.push([q, r]);
    }
  }
  return out;
}

// A program holds 'F', 'L', 'R', 'C' and { repeat, body } blocks.
export function flatten(program) {
  const ops = [];
  for (const block of program) {
    if (typeof block === 'string') ops.push(block);
    else for (let i = 0; i < block.repeat; i++) ops.push(...flatten(block.body));
  }
  return ops;
}

// The same order as flatten, as positions in the program: [2] is a block, [1, 0] is inside a loop.
export function flattenPaths(program, prefix = []) {
  const paths = [];
  program.forEach((block, i) => {
    const path = [...prefix, i];
    if (typeof block === 'string') paths.push(path);
    else for (let n = 0; n < block.repeat; n++) paths.push(...flattenPaths(block.body, path));
  });
  return paths;
}

export function countBlocks(program) {
  return program.reduce((n, b) => n + (typeof b === 'string' ? 1 : 1 + countBlocks(b.body)), 0);
}

export function run(level, program) {
  const walls = new Set(level.walls.map(([q, r]) => key(q, r)));
  const pollen = new Set(level.pollen.map(([q, r]) => key(q, r)));
  const bot = { ...level.start };
  const trace = [];
  const ops = flatten(program).slice(0, MAX_STEPS);

  for (const op of ops) {
    if (op === 'L') bot.dir = (bot.dir + 5) % 6;
    if (op === 'R') bot.dir = (bot.dir + 1) % 6;
    if (op === 'C') pollen.delete(key(bot.q, bot.r));
    if (op === 'F') {
      const q = bot.q + DIRS[bot.dir][0];
      const r = bot.r + DIRS[bot.dir][1];
      if (!inBounds(q, r, level.radius) || walls.has(key(q, r))) {
        trace.push({ ...bot, op, pollen: [...pollen], crashed: true });
        return { status: 'crash', trace };
      }
      bot.q = q;
      bot.r = r;
    }
    trace.push({ ...bot, op, pollen: [...pollen], crashed: false });
  }

  const home = bot.q === level.hive[0] && bot.r === level.hive[1];
  let status = 'win';
  if (pollen.size > 0) status = 'pollen';
  else if (!home) status = 'lost';
  return { status, trace };
}
