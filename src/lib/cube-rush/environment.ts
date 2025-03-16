import * as THREE from 'three';
import { CONFIG } from './config';

export function createSpaceBackground(scene: THREE.Scene, initialSpeed: number): THREE.Points {
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(CONFIG.starCount * 3);
  const starColors = new Float32Array(CONFIG.starCount * 3);

  for (let i = 0; i < CONFIG.starCount; i++) {
    const i3 = i * 3;
    starPositions[i3] = (Math.random() - 0.5) * 500;
    starPositions[i3 + 1] = (Math.random() - 0.5) * 500;
    starPositions[i3 + 2] = (Math.random() - 0.5) * 1000;
    const color = new THREE.Color().setHSL(Math.random(), 0.7, 0.9);
    starColors[i3] = color.r;
    starColors[i3 + 1] = color.g;
    starColors[i3 + 2] = color.b;
  }

  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const starMaterial = new THREE.PointsMaterial({
    size: CONFIG.starSize,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(starGeometry, starMaterial));

  const planetColors = [0x8888ff, 0xff8888, 0x88ff88, 0xffff88, 0xff88ff];
  for (let i = 0; i < CONFIG.planetCount; i++) {
    const size = Math.random() * (CONFIG.planetSizeMax - CONFIG.planetSizeMin) + CONFIG.planetSizeMin;
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(size, 32, 32),
      new THREE.MeshBasicMaterial({ color: planetColors[i % planetColors.length], transparent: true, opacity: 0.7 })
    );
    planet.position.set((Math.random() - 0.5) * 400, (Math.random() - 0.5) * 400, (Math.random() - 0.5) * 800 - 200);
    scene.add(planet);
  }

  const dustGeometry = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(CONFIG.dustCount * 3);
  const dustVelocities = new Float32Array(CONFIG.dustCount * 3);

  for (let i = 0; i < CONFIG.dustCount; i++) {
    const i3 = i * 3;
    dustPositions[i3] = (Math.random() - 0.5) * 200;
    dustPositions[i3 + 1] = (Math.random() - 0.5) * 200;
    dustPositions[i3 + 2] = (Math.random() - 0.5) * 1000;
    dustVelocities[i3] = 0;
    dustVelocities[i3 + 1] = 0;
    dustVelocities[i3 + 2] = initialSpeed * 0.3;
  }

  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('velocity', new THREE.BufferAttribute(dustVelocities, 3));
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0.0 }, particleColor: { value: new THREE.Color(0xaaaaaa) } },
    vertexShader: `
      attribute vec3 velocity;
      uniform float time;
      varying float vAlpha;
      void main() {
        vec3 newPosition = position + velocity * time;
        vAlpha = smoothstep(-500.0, 500.0, newPosition.z);
        gl_PointSize = 1.0 * vAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 particleColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(particleColor, vAlpha * 0.3);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
  const dustParticles = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dustParticles);
  return dustParticles;
}