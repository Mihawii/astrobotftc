/*
 * The Hive Pilot world: a floating honeycomb, with the logo built into a 3D robot.
 * The tiles are one instanced mesh with their own shader, so light pools, the robot's shadow
 * and landing ripples are all maths on the surface: they stay smooth and always follow the robot.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { DIRS, cells, key } from '../hive-engine.js';
import { buzz } from '../input.js';
import { buildRobot, buildStars, glowTexture, tileFragment, tileGeometry, tileVertex } from './hive-look.js';
import { worldMaterial } from './planets.js';

const ROOT3 = Math.sqrt(3);
const toBoard = (q, r) => [ROOT3 * (q + r / 2), 1.5 * r];
const RADIUS = 3;
const YAW = 0.1;

const nearestAngle = (from, to) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function createHive() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
  const rig = new THREE.Group();
  scene.add(rig, buildStars());
  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x3a1a08, 1.7));
  const sun = new THREE.DirectionalLight(0xfff0e0, 2.5);
  sun.position.set(4, 9, 8);
  scene.add(sun);

  const board = cells(RADIUS);
  const indexOf = new Map(board.map(([q, r], i) => [key(q, r), i]));
  const info = new Float32Array(board.length * 4);
  const glow = new Float32Array(board.length);
  const geometry = tileGeometry();
  const infoAttribute = new THREE.InstancedBufferAttribute(info, 4);
  infoAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aInfo', infoAttribute);

  const uniforms = {
    uTime: { value: 0 },
    uIntro: { value: 0 },
    uRipple: { value: new THREE.Vector4(0, 0, -10, 0) },
    uBot: { value: new THREE.Vector3() },
    uHive: { value: new THREE.Vector3() },
    uBeacon: { value: 0 },
  };
  const tiles = new THREE.InstancedMesh(geometry, new THREE.ShaderMaterial({ vertexShader: tileVertex, fragmentShader: tileFragment, uniforms }), board.length);
  tiles.frustumCulled = false;
  const matrix = new THREE.Matrix4();
  board.forEach(([q, r], i) => {
    const [x, z] = toBoard(q, r);
    tiles.setMatrixAt(i, matrix.makeTranslation(x, 0, z));
    info[i * 4 + 1] = Math.random();
  });
  rig.add(tiles);

  // Robot: bot walks the board, hop lifts it, body squashes and turns it.
  const bot = new THREE.Group();
  const hop = new THREE.Group();
  const body = new THREE.Group();
  const lean = new THREE.Group();
  const { head, eyes } = buildRobot();
  head.position.y = 0.78;
  lean.add(head);
  lean.rotation.x = -0.5;
  body.add(lean);
  hop.add(body);
  const pointer = new THREE.Group();
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.2);
  arrowShape.lineTo(0.19, -0.1);
  arrowShape.lineTo(0, -0.02);
  arrowShape.lineTo(-0.19, -0.1);
  arrowShape.closePath();
  const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
  arrow.rotation.x = Math.PI / 2;
  arrow.position.set(0, 0.05, 0.74);
  arrow.scale.setScalar(1.3);
  pointer.add(arrow);
  bot.add(hop, pointer);
  rig.add(bot);

  // The hive: a glowing tile with a column of light and a floating ring.
  const beacon = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.84, 3.6, 6, 1, true),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uBeacon: uniforms.uBeacon },
      vertexShader: 'varying float vH; void main() { vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vH; uniform float uBeacon; void main() { float a = pow(1.0 - vH, 2.4) * (0.22 + 0.5 * uBeacon); gl_FragColor = vec4(vec3(1.0, 0.5, 0.16) * a, a); }',
    }),
  );
  column.position.y = 1.8;
  column.rotation.y = Math.PI / 6;
  const rings = Array.from({ length: 3 }, () => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.86, 0.022, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.set(Math.PI / 2, 0, Math.PI / 6);
    beacon.add(ring);
    return ring;
  });
  beacon.add(column);
  rig.add(beacon);

  const glowMap = glowTexture();
  const orbGeometry = new THREE.IcosahedronGeometry(0.3, 14);
  let orbs = [];
  let level = null;
  let facing = 0;
  let spot = { q: 0, r: 0 };

  const tilt = new THREE.Vector2();
  const tiltTarget = new THREE.Vector2();

  function addGlow(q, r) {
    const i = indexOf.get(key(q, r));
    if (i !== undefined) glow[i] = 1;
  }

  function ripple(x, z, strength) {
    uniforms.uRipple.value.set(x, z, uniforms.uTime.value, strength);
  }

  function clearOrbs() {
    orbs.forEach(({ group, material }) => { rig.remove(group); material.dispose(); });
    orbs = [];
  }

  function makeOrb(q, r, i) {
    const [x, z] = toBoard(q, r);
    const material = worldMaterial({ speed: 0.5, hue: 0.1, density: 2, strength: 0.05, offset: i });
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(orbGeometry, material);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: 0xffb648, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 }));
    halo.scale.setScalar(1.7);
    group.add(halo, mesh);
    group.position.set(x, 0.62, z);
    rig.add(group);
    return { id: key(q, r), group, mesh, material, phase: i * 1.7, home: group.position.clone(), taken: false };
  }

  function face(dir, duration = 0.24) {
    const [dx, dz] = toBoard(...DIRS[dir]);
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx / length, dz / length);
    const yaw = (dx / length) * YAW;
    gsap.to(pointer.rotation, { y: nearestAngle(pointer.rotation.y, angle), duration, ease: 'power2.inOut' });
    gsap.to(body.rotation, { y: yaw, duration, ease: 'power2.inOut' });
    gsap.to(eyes.position, { x: (dx / length) * 0.05, y: -(dz / length) * 0.03, duration: duration * 0.7 });
  }

  function reset({ drop = false } = {}) {
    gsap.killTweensOf([bot.position, hop.position, body.scale, body.rotation, pointer.rotation, eyes.position, eyes.scale, uniforms.uBeacon]);
    const { q, r, dir } = level.start;
    const [x, z] = toBoard(q, r);
    spot = { q, r };
    facing = dir;
    bot.position.set(x, 0, z);
    hop.position.set(0, drop ? 7 : 0, 0);
    body.scale.setScalar(1);
    body.rotation.z = 0;
    eyes.scale.setScalar(1);
    uniforms.uBeacon.value = 0;
    glow.fill(0);
    orbs.forEach((orb) => {
      gsap.killTweensOf([orb.group.position, orb.group.scale]);
      orb.taken = false;
      orb.group.visible = true;
      orb.group.position.copy(orb.home);
      orb.group.scale.setScalar(drop ? 0 : 1);
      if (drop) gsap.to(orb.group.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(3)', delay: 0.5 + orb.phase * 0.05 });
    });
    const [dx, dz] = toBoard(...DIRS[dir]);
    const length = Math.hypot(dx, dz);
    pointer.rotation.y = Math.atan2(dx / length, dz / length);
    body.rotation.y = (dx / length) * YAW;
    eyes.position.set((dx / length) * 0.05, -(dz / length) * 0.03, 0);
    if (drop) {
      gsap.to(hop.position, {
        y: 0,
        duration: 0.72,
        delay: 0.42,
        ease: 'bounce.out',
        onStart: () => gsap.delayedCall(0.3, () => ripple(x, z, 0.7)),
      });
    }
  }

  function load(next) {
    level = next;
    const walls = new Set(level.walls.map(([q, r]) => key(q, r)));
    const hive = key(...level.hive);
    board.forEach(([q, r], i) => {
      const id = key(q, r);
      const wall = walls.has(id);
      info[i * 4] = wall ? 1 : id === hive ? 2 : 0;
      info[i * 4 + 3] = wall ? 0.9 : 0;
    });
    infoAttribute.needsUpdate = true;

    const [hx, hz] = toBoard(...level.hive);
    uniforms.uHive.value.set(hx, 0, hz);
    beacon.position.set(hx, 0, hz);

    clearOrbs();
    orbs = level.pollen.map(([q, r], i) => makeOrb(q, r, i));
    gsap.fromTo(uniforms.uIntro, { value: 0 }, { value: 1, duration: 1.15, ease: 'power2.out' });
    reset({ drop: true });
  }

  const play = (tl) => new Promise((resolve) => { tl.eventCallback('onComplete', resolve); });

  function hopTo(frame) {
    const [x, z] = toBoard(frame.q, frame.r);
    const tl = gsap.timeline();
    tl.to(body.scale, { x: 1.14, y: 0.82, z: 1.14, duration: 0.07, ease: 'power2.in' })
      .to(body.scale, { x: 0.9, y: 1.14, z: 0.9, duration: 0.1, ease: 'power2.out' })
      .to(bot.position, { x, z, duration: 0.3, ease: 'sine.inOut' }, 0.07)
      .to(hop.position, { y: 0.8, duration: 0.15, ease: 'power2.out' }, 0.07)
      .to(hop.position, { y: 0, duration: 0.15, ease: 'power2.in' }, 0.22)
      .to(body.scale, { x: 1, y: 1, z: 1, duration: 0.14 }, 0.2)
      .add(() => { ripple(x, z, 0.75); addGlow(frame.q, frame.r); buzz(7); }, 0.37)
      .to(body.scale, { x: 1.16, y: 0.8, z: 1.16, duration: 0.05, ease: 'power2.out' }, 0.37)
      .to(body.scale, { x: 1, y: 1, z: 1, duration: 0.2, ease: 'back.out(3)' }, 0.42);
    spot = { q: frame.q, r: frame.r };
    return play(tl);
  }

  function turn(frame) {
    facing = frame.dir;
    face(frame.dir);
    const tl = gsap.timeline();
    tl.to(hop.position, { y: 0.22, duration: 0.11, ease: 'power2.out' })
      .to(hop.position, { y: 0, duration: 0.11, ease: 'power2.in' })
      .to(body.scale, { x: 1.08, y: 0.9, z: 1.08, duration: 0.05 })
      .to(body.scale, { x: 1, y: 1, z: 1, duration: 0.12 });
    return play(tl);
  }

  function collect(frame) {
    const left = new Set(frame.pollen);
    const orb = orbs.find((item) => !item.taken && !left.has(item.id));
    const tl = gsap.timeline();
    tl.to(body.scale, { x: 1.1, y: 0.86, z: 1.1, duration: 0.09 })
      .to(body.scale, { x: 1, y: 1, z: 1, duration: 0.2, ease: 'back.out(3)' });
    if (orb) {
      orb.taken = true;
      buzz([8, 30, 14]);
      tl.to(orb.group.position, { x: bot.position.x, y: 1.9, z: bot.position.z, duration: 0.26, ease: 'power2.in' }, 0)
        .to(orb.group.scale, { x: 0, y: 0, z: 0, duration: 0.16, ease: 'power2.in' }, 0.2)
        .add(() => { orb.group.visible = false; }, 0.36);
      const share = 1 - left.size / level.pollen.length;
      gsap.to(uniforms.uBeacon, { value: share, duration: 0.5 });
    }
    return play(tl);
  }

  function crash() {
    const [dx, dz] = toBoard(...DIRS[facing]);
    const length = Math.hypot(dx, dz);
    const [x, z] = toBoard(spot.q, spot.r);
    const tl = gsap.timeline();
    tl.to(bot.position, { x: x + (dx / length) * 0.62, z: z + (dz / length) * 0.62, duration: 0.14, ease: 'power2.in' })
      .add(() => { ripple(x + dx / 2, z + dz / 2, 1.2); buzz(45); })
      .to(body.scale, { x: 0.74, y: 1.2, z: 1.1, duration: 0.05 })
      .to(eyes.scale, { y: 0.2, duration: 0.05 }, '<')
      .to(bot.position, { x, z, duration: 0.34, ease: 'back.out(2.5)' })
      .to(body.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'elastic.out(1.2, 0.3)' }, '<')
      .fromTo(body.rotation, { z: 0.34 }, { z: 0, duration: 0.8, ease: 'elastic.out(1.4, 0.2)' }, '<')
      .to(eyes.scale, { y: 1, duration: 0.2 }, '>-0.3');
    return play(tl);
  }

  function step(frame) {
    if (frame.crashed) return crash();
    if (frame.op === 'F') return hopTo(frame);
    if (frame.op === 'C') return collect(frame);
    return turn(frame);
  }

  function celebrate() {
    const [x, z] = toBoard(...level.hive);
    const tl = gsap.timeline();
    gsap.to(uniforms.uBeacon, { value: 2.4, duration: 0.25, yoyo: true, repeat: 1, repeatDelay: 0.35 });
    tl.add(() => { ripple(x, z, 1.5); buzz([14, 50, 14, 50, 34]); })
      .to(hop.position, { y: 1.3, duration: 0.22, ease: 'power2.out' })
      .to(body.rotation, { y: body.rotation.y + Math.PI * 2, duration: 0.5, ease: 'power1.inOut' }, 0)
      .to(hop.position, { y: 0, duration: 0.22, ease: 'bounce.out' }, 0.26)
      .to(hop.position, { y: 0.7, duration: 0.16, ease: 'power2.out' })
      .to(hop.position, { y: 0, duration: 0.2, ease: 'bounce.out' });
    return play(tl);
  }

  // Not quite there: the robot shakes its head.
  function shrug() {
    const yaw = body.rotation.y;
    const tl = gsap.timeline();
    tl.to(body.rotation, { y: yaw - 0.42, duration: 0.11 })
      .to(body.rotation, { y: yaw + 0.42, duration: 0.15 })
      .to(body.rotation, { y: yaw - 0.28, duration: 0.13 })
      .to(body.rotation, { y: yaw, duration: 0.14 });
    return play(tl);
  }

  return {
    load,
    reset: () => reset(),
    step,
    finish(status) {
      if (status === 'win') return celebrate();
      if (status === 'crash') return Promise.resolve();
      return shrug();
    },
    pointTo(x, y) {
      tiltTarget.set(x * 2 - 1, y * 2 - 1);
    },
    pixelRatio: () => Math.min(window.devicePixelRatio, 2),
    resize(width, height) {
      camera.aspect = width / height;
      // Back the camera off until the whole board fits, with room for the controls.
      // A phone on its side puts the controls beside the board, so the board gets what is left.
      const sideways = width > height && height < 520;
      const share = 1 - Math.max(300 / width, 0.44) - 0.03;
      const span = sideways ? Math.max(12.6, 12.6 / (share * camera.aspect)) : Math.max(17.4, 13.1 / camera.aspect);
      const distance = span / 0.536;
      camera.position.set(0, distance * 0.79, distance * 0.61);
      camera.lookAt(0, 0, -0.1);
      if (sideways) camera.setViewOffset(width, height, width * (0.5 - share / 2 - 0.01), 0, width, height);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    },
    render(renderer, delta, time) {
      uniforms.uTime.value = time;
      orbs.forEach((orb) => {
        orb.material.uniforms.uTime.value = time;
        if (!orb.taken) orb.group.position.y = orb.home.y + Math.sin(time * 1.6 + orb.phase) * 0.09;
      });
      rings.forEach((ring, i) => {
        const age = (time * (0.3 + uniforms.uBeacon.value * 0.25) + i / rings.length) % 1;
        ring.position.y = 0.06 + age * 2.3;
        ring.material.opacity = (1 - age) ** 1.6 * (0.34 + uniforms.uBeacon.value * 0.6);
      });
      uniforms.uBot.value.set(bot.position.x, hop.position.y, bot.position.z);

      let fading = false;
      for (let i = 0; i < glow.length; i++) {
        if (glow[i] > 0.001) {
          glow[i] *= Math.exp(-delta * 1.1);
          fading = true;
        } else {
          glow[i] = 0;
        }
        info[i * 4 + 2] = glow[i];
      }
      if (fading) infoAttribute.needsUpdate = true;

      tilt.lerp(tiltTarget, 1 - Math.exp(-delta * 2));
      rig.rotation.set(tilt.y * 0.035, 0, -tilt.x * 0.035);
      renderer.render(scene, camera);
    },
  };
}
