import test from 'node:test';
import assert from 'node:assert';
import { simulateBounce, simulateHop } from '../src/js/fx/bounce.js';

const options = { top: -60, floor: 470, radius: 19, impactX: 1100, targetX: 200, fallTime: 0.4, restitution: 0.66, friction: 0.92 };
const path = simulateBounce(options);
const flights = path.segments.filter((segment) => segment.air).slice(1);

const apex = ({ vy }) => (vy * vy) / (2 * path.gravity);

test('each bounce reaches restitution squared of the height before it', () => {
  assert.ok(flights.length >= 4, 'several bounces');
  for (let i = 1; i < flights.length; i++) {
    assert.ok(Math.abs(apex(flights[i]) / apex(flights[i - 1]) - options.restitution ** 2) < 1e-9);
  }
});

test('gravity is constant through the whole of a flight', () => {
  let start = 0;
  for (const segment of path.segments) {
    if (segment.air && segment.vy < 0 && segment.duration > 0.15) {
      const air = path.frames.filter(({ t }) => t > start + 0.03 && t < start + segment.duration - 0.03);
      const dt = air[1].t - air[0].t;
      // Stretch keeps the ball off the floor near the ends, so read the shape from the middle.
      const middle = air.slice(Math.floor(air.length * 0.2), Math.ceil(air.length * 0.8));
      for (let i = 1; i < middle.length - 1; i++) {
        const acceleration = (middle[i + 1].y - 2 * middle[i].y + middle[i - 1].y) / (dt * dt);
        assert.ok(Math.abs(acceleration - path.gravity) / path.gravity < 0.02, `measured ${acceleration}`);
      }
    }
    start += segment.duration;
  }
});

test('sideways speed holds steady in the air and only drops on impact', () => {
  const speeds = path.segments.filter((segment) => segment.air).map((segment) => Math.abs(segment.vx));
  for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] < speeds[i - 1]);
  const first = flights[0];
  const start = path.segments[0].duration + path.segments[1].duration;
  const air = path.frames.filter(({ t }) => t > start && t < start + first.duration);
  for (let i = 2; i < air.length; i++) {
    const step = air[i].x - air[i - 1].x;
    const before = air[i - 1].x - air[i - 2].x;
    assert.ok(Math.abs(step - before) < 1e-6);
  }
});

test('the ball never teleports', () => {
  const fastest = path.gravity * options.fallTime * 1.05;
  for (let i = 1; i < path.frames.length; i++) {
    const a = path.frames[i - 1];
    const b = path.frames[i];
    const moved = Math.hypot(b.x - a.x, b.y - a.y);
    assert.ok(moved <= fastest * (b.t - a.t) + options.radius * 0.5, `jumped ${moved}px at ${b.t}`);
  }
});

test('the ball never passes through the floor', () => {
  for (const { y, scaleY } of path.frames) {
    assert.ok(y + options.radius * scaleY <= options.floor + 0.01);
  }
});

test('it lands where asked and comes to rest on the target', () => {
  const last = path.frames[path.frames.length - 1];
  const secondLast = path.frames[path.frames.length - 2];
  assert.strictEqual(last.x, options.targetX);
  assert.strictEqual(last.y, options.floor - options.radius);
  assert.deepStrictEqual([last.scaleX, last.scaleY, last.angle], [1, 1, 0]);
  assert.ok(Math.abs(secondLast.x - options.targetX) < 2, 'no slide at the end');
});

test('squash happens only on the floor, and harder hits squash more', () => {
  const contacts = path.segments.filter((segment) => !segment.air);
  for (let i = 1; i < contacts.length; i++) assert.ok(contacts[i].squash < contacts[i - 1].squash);
  const up = path.frames.filter(({ y }) => y < path.ground - 30);
  assert.ok(up.every(({ scaleY }) => scaleY >= 1));
});

test('it works in either direction', () => {
  const right = simulateBounce({ ...options, impactX: 100, targetX: 900 });
  assert.ok(right.startX < 100);
  assert.strictEqual(right.frames[right.frames.length - 1].x, 900);
});

test('a waiting hop starts and ends at rest, so it can loop without a jump', () => {
  const hop = simulateHop({ floor: 470, radius: 19, x: 200, gravity: path.gravity, apex: 30 });
  const first = hop.frames[0];
  const last = hop.frames[hop.frames.length - 1];
  assert.strictEqual(first.y, 451);
  assert.strictEqual(last.y, 451);
  assert.deepStrictEqual([first.scaleX, first.scaleY], [1, 1]);
  assert.deepStrictEqual([last.scaleX, last.scaleY], [1, 1]);
  assert.ok(Math.min(...hop.frames.map(({ y }) => y)) < 451 - 25);
});
