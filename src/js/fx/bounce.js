/*
 * A real bounce, worked out in advance. Gravity is constant, every impact keeps a set share of
 * the speed, and the ball squashes only while it is touching the floor. The result is a list of
 * poses that can be handed to the browser's compositor, so nothing on the page can make it stutter.
 */
const STEP = 1 / 120;
const MAX_SQUASH = 0.42;
const MAX_STRETCH = 0.2;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Harder impacts stay on the floor a little longer.
const contactTime = (speed) => clamp(0.016 + speed * 0.00001, 0.016, 0.045);

function stretchFor(vy, reference) {
  return MAX_STRETCH * Math.min(Math.abs(vy) / reference, 1);
}

// Lean along the direction of travel, easing to upright at the top of each arc.
function leanFor(vx, vy, reference) {
  if (vy === 0) return 0;
  return -Math.atan2(vx * Math.sign(vy), Math.abs(vy)) * Math.min(Math.abs(vy) / (reference * 0.25), 1);
}

function airPose(segment, time, ground, radius, gravity, reference) {
  const vy = segment.vy + gravity * time;
  const stretch = stretchFor(vy, reference);
  const y = segment.y + segment.vy * time + 0.5 * gravity * time * time;
  return {
    x: segment.x + segment.vx * time,
    y: Math.min(y, ground - radius * stretch),
    scaleX: 1 - stretch * 0.7,
    scaleY: 1 + stretch,
    angle: leanFor(segment.vx, vy, reference),
  };
}

function contactPose(segment, time, ground, radius) {
  const progress = time / segment.duration;
  const arriving = Math.max(0, 1 - progress * 3);
  const leaving = Math.max(0, progress * 3 - 2);
  const amount = -segment.squash * Math.sin(Math.PI * progress) + segment.stretchIn * arriving + segment.stretchOut * leaving;
  const scaleY = 1 + amount;
  return {
    x: segment.x + segment.vx * time,
    y: ground + radius * (1 - scaleY),
    scaleX: 1 - amount * 0.7,
    scaleY,
    angle: segment.leanIn * arriving + segment.leanOut * leaving,
  };
}

function sample(segments, { ground, radius, gravity, reference, x, y }) {
  const duration = segments.reduce((total, segment) => total + segment.duration, 0);
  const frames = [];
  const count = Math.ceil(duration / STEP);
  let index = 0;
  let start = 0;
  for (let i = 0; i <= count; i++) {
    const t = Math.min(i * STEP, duration);
    while (index < segments.length - 1 && t >= start + segments[index].duration) {
      start += segments[index].duration;
      index += 1;
    }
    const segment = segments[index];
    const local = Math.min(t - start, segment.duration);
    const pose = segment.air
      ? airPose(segment, local, ground, radius, gravity, reference)
      : contactPose(segment, local, ground, radius);
    frames.push({ t, ...pose });
  }
  frames[frames.length - 1] = { t: duration, x, y, scaleX: 1, scaleY: 1, angle: 0 };
  return { frames, duration, segments };
}

function contactSegment({ x, vx, speed, reference, stretchIn, leanIn, stretchOut, leanOut }) {
  return {
    air: false,
    duration: contactTime(speed),
    x,
    vx,
    squash: MAX_SQUASH * Math.min(speed / reference, 1),
    stretchIn,
    leanIn,
    stretchOut,
    leanOut,
  };
}

/*
 * Dropped from `top`, the ball lands at `impactX` and travels on to rest at `targetX`.
 * `restitution` is the share of speed each bounce keeps, so each arc reaches restitution²
 * of the height of the last. `friction` is the share of sideways speed each impact keeps.
 */
export function simulateBounce({ top, floor, radius, impactX, targetX, fallTime, restitution = 0.66, friction = 0.92, minApex = 1.5 }) {
  const ground = floor - radius;
  const gravity = (2 * (ground - top)) / (fallTime * fallTime);
  const reference = gravity * fallTime;
  const direction = Math.sign(targetX - impactX) || 1;

  // Launch speed of every bounce that clears the minimum height.
  const launches = [];
  for (let speed = reference * restitution; (speed * speed) / (2 * gravity) >= minApex; speed *= restitution) launches.push(speed);

  // Choose the starting sideways speed so the ball runs out of energy exactly on the target.
  const flightTime = (speed) => (2 * speed) / gravity;
  const impactSpeeds = [reference, ...launches];
  let weighted = 0;
  impactSpeeds.forEach((speed, i) => {
    const share = friction ** (i + 1);
    weighted += share * contactTime(speed);
    if (launches[i]) weighted += share * flightTime(launches[i]);
  });
  const entry = Math.abs(targetX - impactX) / weighted;

  const segments = [];
  const startX = impactX - direction * entry * fallTime;
  segments.push({ air: true, duration: fallTime, x: startX, vx: direction * entry, y: top, vy: 0 });

  let x = impactX;
  impactSpeeds.forEach((speed, i) => {
    const vx = direction * entry * friction ** (i + 1);
    const previous = direction * entry * friction ** i;
    const launch = launches[i] ?? 0;
    const contact = contactSegment({
      x,
      vx,
      speed,
      reference,
      stretchIn: stretchFor(speed, reference),
      leanIn: leanFor(previous, speed, reference),
      stretchOut: stretchFor(launch, reference),
      leanOut: launch ? leanFor(vx, -launch, reference) : 0,
    });
    segments.push(contact);
    x += vx * contact.duration;
    if (launch) {
      segments.push({ air: true, duration: flightTime(launch), x, vx, y: ground, vy: -launch });
      x += vx * flightTime(launch);
    }
  });

  return { ...sample(segments, { ground, radius, gravity, reference, x: targetX, y: ground }), gravity, ground, startX };
}

// One small hop on the spot. It starts and ends at rest, so it can loop while the site finishes loading.
export function simulateHop({ floor, radius, x, gravity, apex }) {
  const ground = floor - radius;
  const speed = Math.sqrt(2 * gravity * apex);
  const reference = speed * 1.6;
  const shared = { x, vx: 0, speed, reference, leanIn: 0, leanOut: 0 };
  const stretch = stretchFor(speed, reference);
  const segments = [
    contactSegment({ ...shared, stretchIn: 0, stretchOut: stretch }),
    { air: true, duration: (2 * speed) / gravity, x, vx: 0, y: ground, vy: -speed },
    contactSegment({ ...shared, stretchIn: stretch, stretchOut: 0 }),
  ];
  return sample(segments, { ground, radius, gravity, reference, x, y: ground });
}
