/*
 * One answer to "where is this person pointing", for a mouse or a finger, plus phone tilt.
 * Touch events are used for fingers because, unlike pointer events, they keep arriving
 * while the page scrolls.
 */
const points = new Set();
const tilts = new Set();

export const touchDevice = matchMedia('(hover: none) and (pointer: coarse)').matches;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

let lastTouch = -Infinity;

export const onPoint = (listener) => points.add(listener);
export const onTilt = (listener) => tilts.add(listener);

// True for a moment after a finger lifts, so idle effects do not fight with a real touch.
export const recentlyTouched = (seconds = 1.4) => performance.now() - lastTouch < seconds * 1000;

function emit(x, y) {
  for (const listener of points) listener(x, y);
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'touch') emit(event.clientX, event.clientY);
}, { passive: true });

function onTouch(event) {
  const touch = event.touches[0];
  if (!touch) return;
  lastTouch = performance.now();
  emit(touch.clientX, touch.clientY);
}

window.addEventListener('touchstart', onTouch, { passive: true });
window.addEventListener('touchmove', onTouch, { passive: true });
window.addEventListener('touchend', () => { lastTouch = performance.now(); }, { passive: true });

const TILT_RANGE = 16;
const clamp = (value) => Math.min(Math.max(value, -1), 1);
let rest = null;

// Screen-relative tilt, whichever way up the phone is held.
function screenTilt(gamma, beta) {
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  if (angle === 90) return [beta, -gamma];
  if (angle === 270 || angle === -90) return [-beta, gamma];
  if (angle === 180) return [-gamma, -beta];
  return [gamma, beta];
}

// iPhones hide this behind a permission prompt, so there it simply stays silent.
if (touchDevice && !calm) {
  window.addEventListener('deviceorientation', ({ gamma, beta }) => {
    if (gamma === null || beta === null) return;
    const [x, y] = screenTilt(gamma, beta);
    // Measure from however the phone is being held, and follow slowly if that changes.
    rest ??= { x, y };
    rest.x += (x - rest.x) * 0.006;
    rest.y += (y - rest.y) * 0.006;
    const dx = clamp((x - rest.x) / TILT_RANGE);
    const dy = clamp((y - rest.y) / TILT_RANGE);
    for (const listener of tilts) listener(dx, dy);
  });
}

// A small tap of feedback. Android phones only: iPhones do not offer this to websites.
export function buzz(pattern) {
  if (!calm && touchDevice) navigator.vibrate?.(pattern);
}
