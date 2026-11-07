/*
 * Hero light. The ray march and the idea of colouring the shadow come from the pack's
 * "webgl 7" (VFX-JS text shadow demo); the noisy pixel shockwave comes from "hero 25".
 *
 * Two passes. The first marches rays at low resolution and stores only how much logo each ray
 * crossed. The second runs at full resolution: it softens that value, then colours it, so the
 * march can be cheap while the picture stays smooth on any screen.
 */
import * as THREE from 'three';
import { RASTER_MARGIN, createRaster } from '../logo.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const rayShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform sampler2D uLogo;
  uniform vec4 uRect;
  uniform vec2 uLight;
  uniform float uAspect;

  // Interleaved gradient noise: neighbouring pixels average out, so the blur pass removes it cleanly.
  float dither(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
  }

  float blocker(vec2 uv) {
    vec2 t = (uv - uRect.xy) / uRect.zw;
    if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return 0.0;
    return texture2D(uLogo, t).r;
  }

  void main() {
    vec2 stepUv = (uLight - vUv) / SAMPLES;
    vec2 walk = vUv + stepUv * dither(gl_FragCoord.xy);
    float acc = 0.0;
    for (float i = 0.0; i < SAMPLES; i++) {
      acc += blocker(walk);
      walk += stepUv;
    }
    acc /= SAMPLES;

    vec2 gap = (uLight - vUv) * vec2(uAspect, 1.0);
    gl_FragColor = vec4(1.0 - exp(-acc * length(gap) * 9.5), 0.0, 0.0, 1.0);
  }
`;

const compositeShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform sampler2D uRays;
  uniform vec2 uTexel;
  uniform vec2 uLight;
  uniform vec2 uOrigin;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uReveal;
  uniform float uPower;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    return noise(p) * 0.5 + noise(p * 2.1) * 0.3 + noise(p * 4.3) * 0.2;
  }

  // Thirteen taps of soft blur over the ray pass. Blurring before colouring is what keeps the bands clean.
  float rays(vec2 uv) {
    float sum = texture2D(uRays, uv).r * 0.16;
    for (float i = 0.0; i < 6.0; i++) {
      float a = i * 1.0472;
      vec2 ring = vec2(cos(a), sin(a)) * uTexel;
      vec2 outer = vec2(cos(a + 0.5236), sin(a + 0.5236)) * uTexel;
      sum += texture2D(uRays, uv + ring * 1.7).r * 0.09;
      sum += texture2D(uRays, uv + outer * 3.6).r * 0.05;
    }
    return sum;
  }

  // Blue through white to gold, then down into deep amber. Bright orange is left out on purpose:
  // the logo owns it, which keeps the logo clear against the light with no outline or shadow.
  vec3 ramp(float t) {
    vec3 c = mix(vec3(0.015, 0.04, 0.34), vec3(0.04, 0.2, 0.95), smoothstep(0.02, 0.24, t));
    c = mix(c, vec3(0.26, 0.62, 1.0), smoothstep(0.22, 0.42, t));
    c = mix(c, vec3(0.88, 0.96, 1.0), smoothstep(0.40, 0.54, t));
    c = mix(c, vec3(1.0, 0.82, 0.46), smoothstep(0.52, 0.64, t));
    c = mix(c, vec3(0.46, 0.17, 0.05), smoothstep(0.64, 0.78, t));
    c = mix(c, vec3(0.16, 0.05, 0.05), smoothstep(0.78, 0.90, t));
    c = mix(c, vec3(0.05, 0.015, 0.05), smoothstep(0.90, 1.0, t));
    return c;
  }

  void main() {
    if (uReveal <= 0.0) {
      gl_FragColor = vec4(0.031, 0.027, 0.047, 1.0);
      return;
    }

    float aspect = uResolution.x / uResolution.y;
    vec2 uv = vUv;
    vec2 p = vec2(uv.x * aspect, uv.y);
    vec2 l = vec2(uLight.x * aspect, uLight.y);

    float thickness = rays(uv);
    float dist = length(p - l);
    float reach = pow(0.16 / max(dist, 0.03), 0.5);

    vec3 color = vec3(0.008, 0.008, 0.02);
    color += vec3(0.05, 0.05, 0.13) * reach * reach * (1.0 - thickness);
    color += ramp(thickness) * smoothstep(0.015, 0.2, thickness) * (0.5 + 0.9 * thickness) * reach * 1.25 * uPower;

    float core = 0.00042 / (dist * dist + 0.00016);
    float halo = 0.012 / (dist + 0.03);
    float flare = 0.0016 / (abs(p.y - l.y) * 7.0 + 0.012) * exp(-abs(p.x - l.x) * 2.6);
    color += vec3(1.0, 0.93, 0.84) * core * uPower;
    color += vec3(1.0, 0.45, 0.16) * halo * uPower;
    color += vec3(1.0, 0.58, 0.30) * flare * uPower;

    // A little dark at the very top keeps the menu readable over the brightest rays.
    color *= 1.0 - 0.55 * smoothstep(0.88, 1.0, uv.y);

    color += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.012;

    // Shockwave: pixel blocks of noise eat outward from the star.
    float block = 12.0 / uResolution.y;
    vec2 snapped = floor(uv / vec2(block / aspect, block)) * vec2(block / aspect, block);
    vec2 q = vec2(snapped.x * aspect, snapped.y);
    vec2 o = vec2(uOrigin.x * aspect, uOrigin.y);
    float radius = uReveal * (length(vec2(aspect, 1.0)) * 1.15 + 0.5);
    float edge = length(q - o) + (fbm(q * 7.0 + uTime * 0.25) - 0.5) * 0.55 - radius;
    float shown = 1.0 - smoothstep(-0.02, 0.0, edge);
    float rim = smoothstep(-0.2, 0.0, edge) * (1.0 - smoothstep(0.0, 0.05, edge));
    color = mix(vec3(0.031, 0.027, 0.047), color, shown);
    color += vec3(0.945, 0.36, 0.09) * rim * 2.6 * (1.0 - smoothstep(0.86, 1.0, uReveal));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createEclipse() {
  const mobile = matchMedia('(pointer: coarse)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const shared = {
    uLight: { value: new THREE.Vector2(0.72, 0.8) },
    uReveal: { value: 0 },
  };
  const rayUniforms = {
    uLogo: { value: null },
    uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uLight: shared.uLight,
    uAspect: { value: 1 },
  };
  const uniforms = {
    uRays: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uLight: shared.uLight,
    uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uReveal: shared.uReveal,
    uPower: { value: 1 },
  };

  const material = (fragmentShader, values, defines = {}) => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms: values, defines, depthTest: false, depthWrite: false,
  });
  const rayPass = material(rayShader, rayUniforms, { SAMPLES: mobile ? '44.0' : '72.0' });
  const compositePass = material(compositeShader, uniforms);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compositePass);
  scene.add(quad);

  let target = null;
  let raster = null;
  let logo = null;
  const view = { width: 1, height: 1 };
  const aim = new THREE.Vector2(0.72, 0.8);
  const tilt = new THREE.Vector2();
  const tiltAim = new THREE.Vector2();
  let quality = mobile ? 0.5 : 0.7;
  let sharpness = 1;
  let lastPointer = -Infinity;
  let elapsed = 0;
  let slow = 0;
  let fast = 0;

  function sizeTarget() {
    if (!target) return;
    const width = Math.max(Math.round(view.width * quality), 2);
    const height = Math.max(Math.round(view.height * quality), 2);
    target.setSize(width, height);
    uniforms.uTexel.value.set(1 / width, 1 / height);
  }

  // Half-float keeps the gradient free of banding where the hardware allows it.
  function ensureTarget(renderer) {
    if (target) return;
    const extensions = renderer.extensions;
    const float = extensions.has('EXT_color_buffer_float') || extensions.has('EXT_color_buffer_half_float');
    target = new THREE.WebGLRenderTarget(2, 2, {
      type: float ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    uniforms.uRays.value = target.texture;
    sizeTarget();
  }

  function syncLogo() {
    if (!raster?.draw()) return;
    if (!logo || logo.image.height !== raster.canvas.height) {
      logo?.dispose();
      logo = new THREE.CanvasTexture(raster.canvas);
      logo.minFilter = THREE.LinearFilter;
      logo.generateMipmaps = false;
      rayUniforms.uLogo.value = logo;
    }
    logo.needsUpdate = true;
  }

  return {
    uniforms,
    light: shared.uLight.value,
    reveal: shared.uReveal,
    useLockup(lockup) {
      raster = createRaster(lockup, mobile ? 768 : 1280);
    },
    // Keep the shader's silhouette exactly under the SVG logo.
    setRect(rect) {
      const margin = rect.width * RASTER_MARGIN;
      rayUniforms.uRect.value.set(
        (rect.left - margin) / view.width,
        1 - (rect.bottom + margin) / view.height,
        (rect.width + margin * 2) / view.width,
        (rect.height + margin * 2) / view.height,
      );
    },
    pointTo(x, y) {
      aim.set(x / view.width, 1 - y / view.height);
      lastPointer = elapsed;
    },
    // Phone tilt, from -1 to 1. It leans the star's drift rather than replacing it.
    lean(x, y) {
      tiltAim.set(x, y);
    },
    placeLight(x, y) {
      aim.set(x / view.width, 1 - y / view.height);
      shared.uLight.value.copy(aim);
      uniforms.uOrigin.value.copy(aim);
      lastPointer = elapsed + 3;
    },
    // Compile the ray shader now, so the star does not hitch at the moment it lights up.
    warm(renderer) {
      ensureTarget(renderer);
      quad.material = rayPass;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      quad.material = compositePass;
    },
    pixelRatio: () => Math.min(window.devicePixelRatio, 2) * sharpness,
    resize(width, height) {
      view.width = width;
      view.height = height;
      rayUniforms.uAspect.value = width / height;
      uniforms.uResolution.value.set(width, height);
      sizeTarget();
    },
    // The hidden ray pass gets cheaper first on slow machines, so what you see stays sharp.
    tune(delta) {
      if (delta > 1 / 40) { slow++; fast = 0; } else { fast++; slow = 0; }
      if (slow > 45 && quality > 0.3) { quality -= 0.1; slow = 0; sizeTarget(); }
      if (fast > 600 && quality < 0.7) { quality += 0.1; fast = 0; sizeTarget(); }
      // Still struggling at the lowest ray quality: a budget phone. Ease off the screen resolution too.
      if (slow > 90 && sharpness > 0.6) { sharpness -= 0.2; slow = 0; return true; }
      return false;
    },
    render(renderer, delta, time) {
      elapsed = time;
      uniforms.uTime.value = time;
      // Left alone, the star drifts around the logo so the rays keep moving.
      const idle = time - lastPointer > 4;
      if (idle) {
        const orbit = time * 0.2;
        tilt.lerp(tiltAim, 1 - Math.exp(-delta * 5));
        aim.set(0.5 + Math.cos(orbit) * 0.34 + tilt.x * 0.3, 0.56 + Math.sin(orbit * 1.3) * 0.26 - tilt.y * 0.26);
      }
      shared.uLight.value.lerp(aim, 1 - Math.exp(-delta * (idle ? 1.6 : 4.5)));

      if (shared.uReveal.value > 0) {
        ensureTarget(renderer);
        syncLogo();
        quad.material = rayPass;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
      }
      quad.material = compositePass;
      renderer.render(scene, camera);
    },
  };
}
