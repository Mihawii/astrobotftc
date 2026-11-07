/*
 * Loaded after the logo is on screen, so the heavy WebGL code never delays the loader.
 * Building the scenes is plain JavaScript. Nothing touches the GPU until connect is called,
 * because GPU work can hold up the compositor, and with it the bouncing ball.
 */
import { createEclipse } from './eclipse.js';
import { createHive } from './hive.js';
import { createStage } from './index.js';
import { createParticles } from './particles.js';
import { createPlanets } from './planets.js';

// Handing back to the browser between scenes keeps clicks and keys responsive while this builds.
const breathe = () => new Promise((resolve) => { setTimeout(resolve); });

export async function createWorld() {
  const eclipse = createEclipse();
  await breathe();
  const particles = createParticles();
  await breathe();
  const planets = createPlanets();
  await breathe();
  const hive = createHive();
  return {
    eclipse,
    particles,
    planets,
    hive,
    stage: null,
    connect(canvas) {
      this.stage = createStage(canvas);
      this.stage.add('eclipse', eclipse);
      this.stage.add('particles', particles);
      this.stage.add('planets', planets);
      this.stage.add('hive', hive);
      eclipse.warm(this.stage.renderer);
    },
  };
}
