/* What the Hive Pilot world is made of: the tile shader, the 3D robot, and the small props. */
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { EYE_LEFT, EYE_RIGHT, FACE, SHELL, SMILE } from '../logo-parts.js';

const ORANGE = 0xf1631e;

export const tileVertex = /* glsl */ `
  attribute vec4 aInfo;

  uniform float uTime;
  uniform float uIntro;
  uniform vec4 uRipple;

  varying vec3 vBoard;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec2 vFace;
  varying vec4 vInfo;
  varying float vRise;

  void main() {
    vec3 centre = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 p = position;
    p.y += aInfo.w * smoothstep(-0.7, -0.25, p.y);

    float rise = smoothstep(0.0, 1.0, clamp(uIntro * 2.4 - length(centre.xz) * 0.2, 0.0, 1.0));
    float bob = sin(uTime * 0.8 + aInfo.y * 6.2831) * 0.03;
    float d = length(centre.xz - uRipple.xy);
    float age = uTime - uRipple.z;
    float wave = sin(d * 2.1 - age * 10.0) * exp(-age * 2.6) * exp(-d * 0.42) * uRipple.w * step(0.0, age);

    vec4 local = instanceMatrix * vec4(p, 1.0);
    local.y += bob + wave * 0.26 - (1.0 - rise) * 10.0;

    vec4 world = modelMatrix * local;
    vBoard = local.xyz;
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vFace = position.xz / 0.96;
    vInfo = aInfo;
    vRise = rise;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const tileFragment = /* glsl */ `
  uniform vec3 uBot;
  uniform vec3 uHive;
  uniform float uBeacon;
  uniform float uTime;

  varying vec3 vBoard;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec2 vFace;
  varying vec4 vInfo;
  varying float vRise;

  // 0 at the centre of a pointy-top hexagon, 1 on its edge.
  float hexEdge(vec2 p) {
    p = abs(p);
    return max(p.x, p.x * 0.5 + p.y * 0.8660254) / 0.8660254;
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 sun = normalize(vec3(0.45, 0.8, 0.35));
    float top = smoothstep(0.55, 0.95, n.y);
    float facing = max(dot(n, sun), 0.0);
    float rim = smoothstep(0.84, 0.965, hexEdge(vFace)) * top;
    float sheen = pow(max(dot(reflect(-sun, n), v), 0.0), 18.0);
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);

    vec3 color = mix(vec3(0.022, 0.022, 0.044), vec3(0.086, 0.080, 0.140), top) * (0.55 + facing);
    color *= 1.0 - smoothstep(3.0, 7.4, length(vBoard.xz)) * 0.62;
    color += vec3(0.30, 0.34, 0.62) * sheen * top * 0.5;
    color += vec3(0.12, 0.14, 0.30) * rim;
    color += vec3(0.10, 0.12, 0.26) * fresnel * (1.0 - top);

    float toBot = length(vBoard.xz - uBot.xz);
    float pool = 1.0 / (1.0 + toBot * toBot * 0.75);
    color += vec3(0.945, 0.39, 0.12) * pool * (0.20 + 0.34 * top + 0.9 * rim);

    float toHive = length(vBoard.xz - uHive.xz);
    float hiveGlow = (0.3 + 0.7 * uBeacon) / (1.0 + toHive * toHive * 0.9);
    color += vec3(1.0, 0.62, 0.2) * hiveGlow * (0.12 + 0.3 * rim);

    color += vec3(1.0, 0.46, 0.14) * vInfo.z * (0.16 + 0.8 * rim);

    if (vInfo.x > 1.5) {
      float breath = 0.82 + 0.18 * sin(uTime * 2.4);
      float inner = 1.0 - smoothstep(0.1, 0.9, hexEdge(vFace));
      vec3 hive = mix(vec3(0.945, 0.36, 0.09), vec3(1.0, 0.76, 0.32), inner);
      color = mix(color, hive * breath, top * (0.72 + 0.28 * uBeacon));
    } else if (vInfo.x > 0.5) {
      float height = clamp(vBoard.y / 1.2 + 0.5, 0.0, 1.0);
      vec3 petal = mix(vec3(0.02, 0.05, 0.42), vec3(0.08, 0.26, 1.0), height);
      color = petal * (0.5 + 0.8 * facing) + vec3(0.46, 0.74, 1.0) * (rim * 0.8 + fresnel * 0.35);
    }

    // A soft contact shadow, worked out from where the robot is right now.
    float lift = clamp(uBot.y / 0.8, 0.0, 1.0);
    float shade = 1.0 - smoothstep(0.1, 0.92 + lift * 0.3, toBot);
    color *= 1.0 - shade * top * (0.62 - lift * 0.34);

    gl_FragColor = vec4(color * vRise, 1.0);
  }
`;

function hexShape(radius) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function tileGeometry() {
  const geometry = new THREE.ExtrudeGeometry(hexShape(0.9), {
    depth: 1, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -1.07, 0);
  return geometry;
}

const svgShapes = (markup) => new SVGLoader()
  .parse(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`)
  .paths.flatMap((path) => path.toShapes(false));

export function buildRobot() {
  const depth = 46;
  const bevel = 7;
  const scale = 1.62 / 232;
  const shell = new THREE.ExtrudeGeometry(svgShapes(`<path d="${SHELL}"/>`), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: 4, bevelOffset: -4, bevelSegments: 5, curveSegments: 24,
  });
  shell.computeBoundingBox();
  const centre = shell.boundingBox.getCenter(new THREE.Vector3());
  const finish = (geometry, z) => {
    geometry.translate(-centre.x, -centre.y, z);
    geometry.rotateX(Math.PI);
    geometry.scale(scale, scale, scale);
    return geometry;
  };

  const head = new THREE.Group();
  const flat = (color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  head.add(new THREE.Mesh(finish(shell, -centre.z), new THREE.MeshStandardMaterial({
    color: ORANGE, roughness: 0.38, metalness: 0.05, emissive: ORANGE, emissiveIntensity: 0.3,
  })));

  const front = -(depth / 2 + bevel);
  head.add(new THREE.Mesh(finish(new THREE.ShapeGeometry(svgShapes(`<path d="${FACE}"/>`), 24), front * 0.42), flat(0xfff6ea)));

  const eyes = new THREE.Group();
  const eyeMarkup = `<ellipse cx="${EYE_LEFT.cx}" cy="${EYE_LEFT.cy}" rx="${EYE_LEFT.rx}" ry="${EYE_LEFT.ry}" transform="${EYE_LEFT.transform}"/><path d="${EYE_RIGHT}"/>`;
  eyes.add(new THREE.Mesh(finish(new THREE.ShapeGeometry(svgShapes(eyeMarkup), 20), front * 0.42 - 1.5), flat(ORANGE)));
  head.add(eyes);
  head.add(new THREE.Mesh(finish(new THREE.ShapeGeometry(svgShapes(`<path d="${SMILE}"/>`), 20), front * 0.42 - 1.5), flat(ORANGE)));
  return { head, eyes };
}

export function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,.34)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function buildStars() {
  const count = 520;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 26 + Math.random() * 44;
    positions.set([Math.cos(a) * r, -16 - Math.random() * 22, Math.sin(a) * r], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xf4eee2, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.6, depthWrite: false }));
}
