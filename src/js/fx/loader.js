/*
 * The logo's entrance, which doubles as the loader: the robot will not stand up until the site
 * behind it is ready. The ball runs on the compositor, so the work of loading cannot stall it.
 */
import gsap from 'gsap';
import { ANTENNA_TIP } from '../logo.js';
import { simulateBounce, simulateHop } from './bounce.js';

// Where a point in logo units sits on screen right now.
function screenPoint(lockup, x, y) {
  const point = new DOMPoint(x, y).matrixTransform(lockup.head.getScreenCTM());
  return { x: point.x, y: point.y };
}

function blink(tl, eyes, at) {
  tl.to(eyes, { scaleY: 0.08, duration: 0.05, ease: 'none', transformOrigin: '50% 50%' }, at);
  tl.to(eyes, { scaleY: 1, duration: 0.11, ease: 'back.out(3)' }, '>');
}

// Poses become a browser animation. Transforms like this run off the main thread.
function play(element, poses, radius, options) {
  const frames = poses.frames.map(({ x, y, scaleX, scaleY, angle }) => ({
    transform: `translate3d(${(x - radius).toFixed(2)}px, ${(y - radius).toFixed(2)}px, 0) rotate(${angle.toFixed(4)}rad) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`,
  }));
  return element.animate(frames, { duration: poses.duration * 1000, easing: 'linear', fill: 'forwards', ...options });
}

// The line draws itself along behind the ball, then finishes off once the ball has settled.
function drawLine(fill, path, box) {
  const tail = 0.24;
  const total = path.duration + tail;
  const frames = path.frames
    .filter((_, i) => i % 4 === 0)
    .map(({ t, x }) => ({ offset: t / total, transform: `scaleX(${Math.min(Math.max((box.right - x) / box.width, 0), 1).toFixed(4)})` }));
  frames.push({ offset: 1, transform: 'scaleX(1)' });
  return fill.animate(frames, { duration: total * 1000, easing: 'linear', fill: 'forwards' });
}

export function createLoader({ root, host, lockup, ready, wake, onLaunch, onDone }) {
  const floor = root.querySelector('.loader__floor');
  const fill = root.querySelector('.loader__fill');
  const ball = root.querySelector('.loader__ball');
  const spark = root.querySelector('.loader__spark');
  const skip = root.querySelector('.loader__skip');
  const { head, antenna, face, eyes, smile, letters } = lockup;

  // Everything rises through the same floor: the bottom edge of the logo. Measured from the
  // head's parent, because the head itself is about to be moved.
  const box = host.getBoundingClientRect();
  const floorY = box.bottom;
  const slot = head.parentNode.getScreenCTM();
  const sunk = (floorY - slot.f) / slot.a;
  const peek = sunk - 136;
  // With the head here, its antenna tip sits exactly where the ball comes to rest.
  const tipOnFloor = sunk - (ANTENNA_TIP.y + ANTENNA_TIP.r);

  gsap.ticker.lagSmoothing(500, 33);
  gsap.set(floor, { top: floorY, left: box.left, width: box.width });
  gsap.set(head, { y: sunk + 8, transformOrigin: '50% 100%' });
  gsap.set(antenna, { svgOrigin: '104 46' });
  gsap.set(eyes, { transformOrigin: '50% 50%' });
  gsap.set(smile, { scale: 0, transformOrigin: '50% 20%' });
  gsap.set(letters, { y: 300, transformOrigin: '50% 100%' });

  // Act 1: the ball drops in, bounces along the floor and runs out of energy on the antenna's spot.
  const radius = Math.max(ANTENNA_TIP.r * slot.a, 7);
  const restX = slot.e + ANTENNA_TIP.x * slot.a;
  const path = simulateBounce({ top: -radius * 3, floor: floorY, radius, impactX: box.right, targetX: restX, fallTime: 0.4 });
  Object.assign(ball.style, { width: `${radius * 2}px`, height: `${radius * 2}px`, opacity: 1 });
  const flight = play(ball, path, radius);
  drawLine(fill, path, box);

  // If loading takes longer, the ball hops on the spot until the site is ready.
  let loaded = false;
  let waiting = null;
  ready.then(() => { loaded = true; });
  flight.finished.then(() => {
    if (loaded) return;
    const hop = simulateHop({ floor: floorY, radius, x: restX, gravity: path.gravity, apex: radius * 1.5 });
    waiting = play(ball, hop, radius, { iterations: Infinity });
  }).catch(() => {});

  // Let the hop in progress land before the head comes up.
  function ballAtRest() {
    if (!waiting) return Promise.resolve();
    waiting.effect.updateTiming({ iterations: waiting.effect.getComputedTiming().currentIteration + 1 });
    return waiting.finished;
  }

  let show = null;
  let launched = false;

  function perform() {
    const tl = gsap.timeline({ onComplete: finish });
    show = tl;

    // Act 2: the ball was the antenna all along. Only the top comes up, to see if the coast is clear.
    tl.set(head, { y: tipOnFloor }, 0.14)
      .set(ball, { opacity: 0 }, 0.14)
      .to(head, { y: peek, duration: 0.36, ease: 'back.out(1.8)' }, 0.14)
      .to(eyes, { x: -11, duration: 0.1, ease: 'power2.out' }, '+=0.02')
      .to(eyes, { x: 11, duration: 0.12, ease: 'power2.inOut' }, '+=0.1')
      .to(eyes, { x: 0, duration: 0.09, ease: 'power2.inOut' }, '+=0.1');
    blink(tl, eyes, '+=0.02');

    // Act 3: duck, then pop.
    tl.addLabel('pop', '+=0.04')
      .to(head, { y: peek + 24, scaleY: 0.84, scaleX: 1.1, duration: 0.12, ease: 'power2.in' }, 'pop')
      .to(head, { y: -30, scaleX: 0.91, scaleY: 1.12, duration: 0.17, ease: 'power3.out' })
      .to(head, { y: 0, scaleX: 1.13, scaleY: 0.86, duration: 0.11, ease: 'power2.in' })
      .to(head, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.34)' })
      .to(floor, { opacity: 0, duration: 0.25 }, '<')
      .fromTo(antenna, { rotation: 22 }, { rotation: 0, duration: 1.2, ease: 'elastic.out(1.4, 0.16)' }, '<')
      .to(smile, { scale: 1, duration: 0.42, ease: 'back.out(4)' }, '<+=0.05');

    // Act 4: the letters arrive and the robot watches them go by.
    tl.addLabel('word', 'pop+=0.5');
    letters.slice(0, 7).forEach((letter, i) => {
      const at = `word+=${i * 0.07}`;
      tl.to(letter, { y: -24, scaleY: 1.12, duration: 0.14, ease: 'power3.out' }, at)
        .to(letter, { y: 0, scaleY: 1, duration: 0.36, ease: 'bounce.out' }, '>')
        .to(eyes, { x: 3 + i * 1.5, duration: 0.08, ease: 'power1.out' }, at);
    });

    // Act 5: the last T arrives crooked. The robot notices and nudges the whole word straight.
    const last = letters[7];
    tl.addLabel('late', 'word+=0.72')
      .to(last, { y: 12, rotation: 22, transformOrigin: '0% 100%', duration: 0.3, ease: 'back.out(2.4)' }, 'late')
      .to(eyes, { x: 13, y: 2, duration: 0.12, ease: 'power2.out' }, 'late+=0.1');
    blink(tl, eyes, 'late+=0.3');
    tl.to(head, { rotation: 7, x: 11, duration: 0.12, ease: 'power2.in', transformOrigin: '50% 100%' }, 'late+=0.5')
      .to(head, { rotation: 0, x: 0, duration: 0.45, ease: 'elastic.out(1, 0.45)' }, '>')
      .to(letters.slice(0, 7), { x: 9, duration: 0.05, ease: 'power2.in', stagger: 0.012 }, 'late+=0.58')
      .to(letters.slice(0, 7), { x: 0, duration: 0.28, ease: 'back.out(3)', stagger: 0.012 }, '>')
      .to(last, { y: 0, rotation: 0, duration: 0.38, ease: 'back.out(3)' }, 'late+=0.68')
      .to(eyes, { x: 0, y: 0, duration: 0.18, ease: 'power2.out' }, 'late+=0.86');

    // Act 6: a big breath, then the antenna fires the spark that becomes the star.
    tl.addLabel('fire', 'late+=1.05')
      .to(head, { scaleY: 0.9, scaleX: 1.07, duration: 0.26, ease: 'power2.inOut' }, 'fire')
      .to(eyes, { scaleY: 1.24, duration: 0.26, ease: 'power2.inOut' }, 'fire')
      .to(antenna, { rotation: -7, duration: 0.26, ease: 'power2.inOut' }, 'fire')
      .add(launchSpark, 'fire+=0.26')
      .to(head, { scaleX: 0.95, scaleY: 1.1, duration: 0.08, ease: 'power3.out' }, 'fire+=0.26')
      .to(head, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.3)' }, '>')
      .to(eyes, { scaleY: 1, duration: 0.26, ease: 'back.out(3)' }, 'fire+=0.26')
      .to(antenna, { rotation: 0, duration: 0.9, ease: 'elastic.out(1.6, 0.14)' }, 'fire+=0.26');
  }

  function launchSpark() {
    if (launched) return;
    launched = true;
    const from = screenPoint(lockup, ANTENNA_TIP.x, ANTENNA_TIP.y);
    const to = starPosition();
    const size = Math.max(radius * 1.6, 12);
    const duration = 0.6;
    gsap.set(spark, { width: size, height: size, x: from.x - size / 2, y: from.y - size / 2, opacity: 1, scale: 1 });
    // A true arc: steady sideways, slowing as it climbs, and igniting at the very top.
    gsap.to(spark, { x: to.x - size / 2, duration, ease: 'none' });
    gsap.to(spark, {
      y: to.y - size / 2,
      scale: 1.8,
      duration,
      ease: 'power1.out',
      onComplete() {
        gsap.set(spark, { opacity: 0 });
        onLaunch(to, face);
      },
    });
  }

  function finish() {
    window.removeEventListener('pointerdown', skipOnce);
    window.removeEventListener('keydown', onKey);
    gsap.ticker.lagSmoothing(0);
    gsap.to(root, { opacity: 0, duration: 0.3, onComplete: () => { root.hidden = true; onDone(); } });
  }

  // The star needs the stage to exist, so a skip still has to wait for loading to finish.
  async function skipShow() {
    await ready;
    wake();
    flight.cancel();
    waiting?.cancel();
    show?.kill();
    gsap.set([head, antenna, eyes, smile, ...letters], { clearProps: 'all' });
    gsap.set([ball, floor], { opacity: 0 });
    if (!launched) launchSpark();
    finish();
  }

  // No visible button: a click anywhere, or Escape, skips. The real button stays for keyboards and screen readers.
  function onKey(event) {
    if (event.key === 'Escape') skipOnce();
  }
  function skipOnce() {
    window.removeEventListener('pointerdown', skipOnce);
    window.removeEventListener('keydown', onKey);
    skipShow();
  }
  skip.addEventListener('click', skipOnce);
  window.addEventListener('pointerdown', skipOnce);
  window.addEventListener('keydown', onKey);

  return {
    async start() {
      await Promise.all([ready, flight.finished.catch(() => {})]);
      await ballAtRest();
      // The GPU is left alone until now: nothing is moving, so its busiest moment cannot show.
      wake();
      if (!launched) perform();
    },
  };
}

const starPosition = () => ({ x: window.innerWidth * 0.76, y: window.innerHeight * 0.2 });

// Reduced motion or a deep link: straight to the finished logo.
export function skipLoader({ root, lockup, onLaunch, onDone }) {
  root.hidden = true;
  onLaunch(starPosition(), lockup.face);
  onDone();
}
