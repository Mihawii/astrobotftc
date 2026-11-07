/*
 * The robot, made of light. Based on Interactive Particles by Bruno Imbrizi
 * (pack "webgl 9", MIT, brunoimbrizi.com): one particle per pixel, pushed around by a
 * fading touch texture. Rebuilt on Points so it can assemble as the section scrolls in.
 */
import * as THREE from 'three';
import { recentlyTouched, touchDevice } from '../input.js';
import { EYE_LEFT, EYE_RIGHT, FACE, SHELL, SMILE } from '../logo-parts.js';

const vertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aAngle;
  attribute vec2 aUv;

  uniform float uTime;
  uniform float uAssemble;
  uniform float uPointScale;
  uniform sampler2D uTouch;

  varying vec3 vColor;
  varying float vFade;

  float random(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    float spread = 1.0 - uAssemble;
    float a = aSeed * 6.2831 + uTime * 0.05;
    float r = (0.3 + random(aSeed * 7.3)) * spread * spread;

    vec3 p = position;
    p.xy += vec2(cos(a), sin(a)) * r * 900.0;
    p.z += (random(aSeed * 3.1) - 0.5) * spread * 1400.0;

    float wobble = sin(uTime * (0.6 + aSeed) + aSeed * 40.0);
    p.z += wobble * 7.0;
    p.xy += vec2(random(aSeed) - 0.5, random(aSeed + 1.0) - 0.5) * 1.4;

    float touch = texture2D(uTouch, aUv).r;
    float push = touch * (0.4 + random(aSeed * 5.0));
    p.z += push * 90.0;
    p.x += cos(aAngle) * push * 90.0;
    p.y += sin(aAngle) * push * 90.0;

    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = uPointScale * (1.05 + 0.5 * wobble * wobble) * (1.0 + touch * 1.6) / -view.z;
    vColor = aColor + touch * 0.5;
    vFade = smoothstep(0.0, 0.25, uAssemble);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.2, d) * vFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const TOUCH_SIZE = 64;
const TOUCH_LIFE = 90;

// Fading trail of pointer positions, drawn into a small texture the shader reads.
function createTouch() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TOUCH_SIZE;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  const trail = [];

  return {
    texture,
    add(x, y, strength = 1) {
      const last = trail[trail.length - 1];
      const force = last ? Math.min(((last.x - x) ** 2 + (last.y - y) ** 2) * 12000, 1) * strength : 0;
      trail.push({ x, y, age: 0, force });
    },
    update() {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, TOUCH_SIZE, TOUCH_SIZE);
      for (let i = trail.length - 1; i >= 0; i--) {
        const point = trail[i];
        point.age++;
        if (point.age > TOUCH_LIFE) { trail.splice(i, 1); continue; }
        const life = point.age / TOUCH_LIFE;
        const strength = (life < 0.3 ? life / 0.3 : 1 - (life - 0.3) / 0.7) * point.force;
        const radius = TOUCH_SIZE * 0.2 * Math.max(strength, 0.05);
        const x = point.x * TOUCH_SIZE;
        const y = (1 - point.y) * TOUCH_SIZE;
        const gradient = ctx.createRadialGradient(x, y, radius * 0.25, x, y, radius);
        gradient.addColorStop(0, 'rgba(255,255,255,0.22)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      texture.needsUpdate = true;
    },
  };
}

function sampleMark(width) {
  const height = Math.round((width * 211) / 232);
  const scale = width / 232;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff4e6';
  ctx.fill(new Path2D(FACE));
  ctx.fillStyle = '#f1631e';
  ctx.fill(new Path2D(SHELL));
  ctx.fill(new Path2D(EYE_RIGHT));
  ctx.fill(new Path2D(SMILE));
  ctx.save();
  ctx.translate(-55.51, 158.7);
  ctx.rotate((-86 * Math.PI) / 180);
  ctx.beginPath();
  ctx.ellipse(EYE_LEFT.cx, EYE_LEFT.cy, EYE_LEFT.rx, EYE_LEFT.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

export function createParticles() {
  const mobile = matchMedia('(pointer: coarse)').matches;
  const { data, width, height } = sampleMark(mobile ? 150 : 230);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 6000);

  const positions = [];
  const colors = [];
  const seeds = [];
  const angles = [];
  const uvs = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 130) continue;
      positions.push(x - width / 2, height / 2 - y, 0);
      colors.push(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
      seeds.push(Math.random());
      angles.push(Math.random() * Math.PI * 2);
      uvs.push(x / width, 1 - y / height);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('aAngle', new THREE.Float32BufferAttribute(angles, 1));
  geometry.setAttribute('aUv', new THREE.Float32BufferAttribute(uvs, 2));

  const touch = createTouch();
  const uniforms = {
    uTime: { value: 0 },
    uAssemble: { value: 0 },
    uPointScale: { value: 1 },
    uTouch: { value: touch.texture },
  };
  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
  }));
  points.frustumCulled = false;
  scene.add(points);

  const view = { width: 1, height: 1, scale: 1, distance: 1 };
  let anchor = null;

  return {
    setAssembly(value) {
      uniforms.uAssemble.value = Math.min(Math.max(value, 0), 1);
    },
    // The canvas is fixed to the screen, so the robot has to keep up with its section.
    followElement(el) {
      anchor = el;
    },
    // x and y are in screen pixels, relative to the centre of the robot.
    pointTo(x, y) {
      const u = x / (width * view.scale) + 0.5;
      const v = 0.5 - y / (height * view.scale);
      if (u > -0.2 && u < 1.2 && v > -0.2 && v < 1.2) touch.add(u, v);
    },
    pixelRatio: () => Math.min(window.devicePixelRatio, 1.5),
    resize(w, h) {
      view.width = w;
      view.height = h;
      camera.aspect = w / h;
      view.distance = h / 2 / Math.tan((camera.fov * Math.PI) / 360);
      camera.position.z = view.distance;
      camera.updateProjectionMatrix();
      view.scale = (Math.min(w, h) * (w < h ? 0.36 : 0.27)) / width;
      points.scale.set(view.scale, view.scale, view.scale);
      uniforms.uPointScale.value = view.scale * Math.min(window.devicePixelRatio, 1.5) * view.distance * 1.55;
    },
    render(renderer, delta, time) {
      uniforms.uTime.value = time;
      // No cursor on a phone: every few seconds an unseen finger brushes lightly across the robot.
      if (touchDevice && uniforms.uAssemble.value > 0.9 && !recentlyTouched() && time % 6 < 1.6) {
        const across = (time % 6) / 1.6;
        touch.add(0.12 + across * 0.76, 0.5 + Math.sin(across * 5) * 0.28, 0.4);
      }
      touch.update();
      if (anchor) {
        const box = anchor.getBoundingClientRect();
        points.position.y = view.height / 2 - (box.top + box.height / 2);
      }
      renderer.render(scene, camera);
    },
  };
}
