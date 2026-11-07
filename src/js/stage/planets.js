/*
 * BIOBUZZ worlds. Geometry and shading follow the pack's "webgl 11" (Creative WebGL Blobs,
 * Mario Carrillo); the noise is inlined from "hero 25" so no glslify build step is needed.
 */
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying float vDistort;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uNoiseStrength;
  uniform float uNoiseDensity;
  uniform float uFreq;
  uniform float uAmp;
  uniform float uOffset;

  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

  float cnoise(vec3 P) {
    vec3 Pi0 = mod(floor(P), 289.0);
    vec3 Pi1 = mod(Pi0 + vec3(1.0), 289.0);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + Pi0.zzzz);
    vec4 ixy1 = permute(ixy + Pi1.zzzz);

    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
    vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
    vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
    vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
    vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
    vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
    vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
    vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g100, g100), dot(g010, g010), dot(g110, g110)));
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g101, g101), dot(g011, g011), dot(g111, g111)));
    g000 *= norm0.x; g100 *= norm0.y; g010 *= norm0.z; g110 *= norm0.w;
    g001 *= norm1.x; g101 *= norm1.y; g011 *= norm1.z; g111 *= norm1.w;

    vec3 f = fade(Pf0);
    vec4 z = mix(
      vec4(dot(g000, Pf0), dot(g100, vec3(Pf1.x, Pf0.yz)), dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z)), dot(g110, vec3(Pf1.xy, Pf0.z))),
      vec4(dot(g001, vec3(Pf0.xy, Pf1.z)), dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z)), dot(g011, vec3(Pf0.x, Pf1.yz)), dot(g111, Pf1)),
      f.z
    );
    vec2 yz = mix(z.xy, z.zw, f.y);
    return 2.2 * mix(yz.x, yz.y, f.x);
  }

  vec3 rotateY(vec3 v, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
  }

  void main() {
    float t = uTime * uSpeed;
    float distortion = cnoise((normal + t) * uNoiseDensity) * uNoiseStrength;
    vec3 pos = position + normal * distortion;
    pos = rotateY(pos, sin(uv.y * uFreq + t) * uAmp);
    pos *= 1.0 + 0.1 * (sin(uTime + uOffset) * 0.5 + 0.5);
    vDistort = distortion;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vDistort;
  uniform float uHue;
  uniform float uAlpha;

  vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
  }

  void main() {
    vec3 color = cosPalette(uHue + vDistort * 2.0, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.1, 0.2));
    gl_FragColor = vec4(color, uAlpha);
  }
`;

export function worldMaterial({ speed, hue, density, strength, offset }) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uNoiseDensity: { value: density },
      uNoiseStrength: { value: strength },
      uFreq: { value: 3 },
      uAmp: { value: 6 },
      uHue: { value: hue },
      uOffset: { value: offset },
      uAlpha: { value: 1 },
    },
  });
}

const lerp = (a, b, t) => a + (b - a) * t;

// Where each world sits at each step of the page, as [x, y, z, scale].
const PATHS = [
  [[8.5, -2.6, -6, 1], [-9, 1.2, -8, 1], [9.5, 0.4, -10, 1.15], [-7, -1.4, -6, 0.9]],
  [[-8.6, 3.5, 2, 1], [8.4, 3.2, 0, 0.72], [-8.5, -3.2, 2, 0.9], [8.8, 3.4, 1, 0.8]],
  [[-1.5, -5.4, 4, 1], [6, -4.6, 3, 1.2], [1.6, 4.8, 3, 0.8], [3, -4.6, 4, 1.5]],
];

export function createPlanets() {
  const mobile = matchMedia('(pointer: coarse)').matches;
  const detail = mobile ? 28 : 56;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 18;

  const specs = [
    { size: 6, speed: 0.15, hue: 0.4, density: 2, strength: 0.3, offset: Math.PI * 2 },
    { size: 1.75, speed: 0.3, hue: 0.5, density: 1.5, strength: 0.12, offset: Math.PI },
    { size: 0.8, speed: 0.5, hue: 0.1, density: 2, strength: 0.05, offset: Math.PI * 0.5 },
  ];
  const worlds = specs.map((spec) => {
    const material = worldMaterial(spec);
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(spec.size, detail), material);
    scene.add(mesh);
    return { mesh, material };
  });
  worlds[0].mesh.rotation.set(0.4, 1, -0.4);
  worlds[1].mesh.rotation.set(-0.4, 0, 0.5);

  const pointer = new THREE.Vector2();
  const eased = new THREE.Vector2();
  let progress = 0;
  let narrow = false;

  function place() {
    const step = progress * (PATHS[0].length - 1);
    const from = Math.min(Math.floor(step), PATHS[0].length - 2);
    const t = step - from;
    const smooth = t * t * (3 - 2 * t);
    worlds.forEach(({ mesh }, i) => {
      const a = PATHS[i][from];
      const b = PATHS[i][from + 1];
      const x = lerp(a[0], b[0], smooth) * (narrow ? 0.42 : 1);
      // On a tall screen the words sit low, so the worlds move up out of their way.
      mesh.position.set(x, lerp(a[1], b[1], smooth) + (narrow ? 3.4 : 0), lerp(a[2], b[2], smooth));
      mesh.scale.setScalar(lerp(a[3], b[3], smooth) * (narrow ? 0.7 : 1));
    });
  }

  place();

  return {
    setProgress(value) {
      progress = Math.min(Math.max(value, 0), 1);
      place();
    },
    pointTo(x, y) {
      pointer.set(x * 2 - 1, -(y * 2 - 1));
    },
    pixelRatio: () => Math.min(window.devicePixelRatio, 1.5),
    resize(width, height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      narrow = width / height < 0.9;
      place();
    },
    render(renderer, delta, time) {
      eased.lerp(pointer, 1 - Math.exp(-delta * 1.8));
      scene.rotation.set(eased.y * 0.16, eased.x * 0.16, 0);
      worlds.forEach(({ material }) => { material.uniforms.uTime.value = time; });
      renderer.render(scene, camera);
    },
  };
}
