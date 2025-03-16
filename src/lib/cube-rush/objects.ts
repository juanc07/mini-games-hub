import * as THREE from 'three';
import { CONFIG } from './config';
import { playCollectionSound, playCrashSound } from './audio';
import { checkCollision } from '../../lib/cube-rush/utils';
import { GameState } from './types';

// spawnOrb, spawnObstacle, spawnParticleBurst, spawnPlayerDebris unchanged
export function spawnOrb(scene: THREE.Scene, orbs: THREE.Mesh[]): void {
  const orbShaderMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0.0 }, glowColor: { value: new THREE.Color(CONFIG.orbColor) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 glowColor;
      varying vec3 vNormal;
      void main() {
        float pulse = abs(sin(time * 3.0)) * 0.7 + 0.3;
        float glow = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
        vec3 color = glowColor + vec3(0.2, 0.1, 0.0) * pulse;
        gl_FragColor = vec4(color * (glow * 1.5 + pulse), 1.0);
      }
    `,
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.orbSize, 32, 32), orbShaderMaterial);
  orb.position.set(
    Math.floor(Math.random() * 5) * 2 - 4,
    CONFIG.orbSize,
    CONFIG.spawnDistanceMin + Math.random() * (CONFIG.spawnDistanceMax - CONFIG.spawnDistanceMin)
  );
  scene.add(orb);
  orbs.push(orb);
}

export function spawnObstacle(scene: THREE.Scene, obstacles: THREE.Mesh[]): void {
  const obstacleShaderMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0.0 }, baseColor: { value: new THREE.Color(CONFIG.obstacleColor) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 baseColor;
      varying vec3 vNormal;
      void main() {
        float pulse = sin(time * 2.0) * 0.2 + 0.8;
        float glow = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(baseColor * (pulse + glow * 0.5), 1.0);
      }
    `,
  });
  const obstacle = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.obstacleSize, CONFIG.obstacleSize, CONFIG.obstacleSize),
    obstacleShaderMaterial
  );
  obstacle.position.set(
    Math.floor(Math.random() * 5) * 2 - 4,
    CONFIG.obstacleSize / 2,
    CONFIG.spawnDistanceMin + Math.random() * (CONFIG.spawnDistanceMax - CONFIG.spawnDistanceMin)
  );
  scene.add(obstacle);
  obstacles.push(obstacle);
}

export function spawnParticleBurst(
  scene: THREE.Scene,
  particleSystems: THREE.Points[],
  audioContext: AudioContext,
  x: number,
  y: number,
  z: number,
  color: number = 0xffff00
): void {
  const particleCount = 150;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const lifetimes = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    velocities[i3] = (Math.random() - 0.5) * 1.5;
    velocities[i3 + 1] = Math.random() * 2.0;
    velocities[i3 + 2] = (Math.random() - 0.5) * 1.5;
    lifetimes[i] = Math.random() * 0.5 + 0.3;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

  const particleShaderMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0.0 }, particleColor: { value: new THREE.Color(color) } },
    vertexShader: `
      attribute vec3 velocity;
      attribute float lifetime;
      uniform float time;
      varying float vLifetime;
      void main() {
        vLifetime = lifetime - time * 2.0;
        vec3 newPosition = position + velocity * time * 2.0;
        gl_PointSize = vLifetime * 25.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 particleColor;
      varying float vLifetime;
      void main() {
        if (vLifetime <= 0.0) discard;
        float glow = smoothstep(0.0, 1.0, vLifetime);
        gl_FragColor = vec4(particleColor * glow, vLifetime);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });

  const particleSystem = new THREE.Points(geometry, particleShaderMaterial);
  particleSystem.userData = { startTime: 0 };
  scene.add(particleSystem);
  particleSystems.push(particleSystem);
  playCollectionSound(audioContext);
}

export function spawnPlayerDebris(
  scene: THREE.Scene,
  debris: Array<THREE.Mesh & { velocity: THREE.Vector3; life: number }>,
  x: number,
  y: number,
  z: number
): void {
  const debrisCount = 20;
  const debrisMaterial = new THREE.ShaderMaterial({
    uniforms: { 
      time: { value: 0.0 }, 
      baseColor: { value: new THREE.Color(CONFIG.playerColor) }
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 baseColor;
      varying vec3 vNormal;
      void main() {
        float glow = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(baseColor * (0.8 + glow * 0.5), 1.0);
      }
    `,
  });

  for (let i = 0; i < debrisCount; i++) {
    const debrisPiece = Object.assign(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, 0.2),
        debrisMaterial
      ),
      {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.0,
          Math.random() * 2.5,
          (Math.random() - 0.5) * 2.0
        ),
        life: 1.0
      }
    );

    debrisPiece.position.set(x, y, z);
    scene.add(debrisPiece);
    debris.push(debrisPiece);
    console.log(`Debris ${i} created at (${x}, ${y}, ${z}) with velocity (${debrisPiece.velocity.x}, ${debrisPiece.velocity.y}, ${debrisPiece.velocity.z})`);
  }
}

// Updated updateObjects with type assertions for dispose
export function updateObjects(game: GameState): void {
  game.orbs.forEach(orb => {
    orb.position.z += game.speed;
    (orb.material as THREE.ShaderMaterial).uniforms.time.value = game.time;
  });

  game.obstacles.forEach(obstacle => {
    obstacle.position.z += game.speed;
    (obstacle.material as THREE.ShaderMaterial).uniforms.time.value = game.time;
  });

  game.particleSystems = game.particleSystems.filter(system => {
    if (!system.userData.startTime) system.userData.startTime = game.time;
    const elapsed = game.time - (system.userData.startTime as number);
    (system.material as THREE.ShaderMaterial).uniforms.time.value = elapsed;
    if (elapsed > 0.8) {
      game.scene.remove(system);
      system.geometry.dispose();
      (system.material as THREE.ShaderMaterial).dispose(); // Add type assertion here
      return false;
    }
    return true;
  });

  game.debris = game.debris.filter(d => {
    d.position.add(d.velocity);
    d.velocity.y -= 0.05;
    d.life -= 0.03;
    d.scale.setScalar(d.life);
    if (d.life <= 0) {
      game.scene.remove(d);
      (d.material as THREE.ShaderMaterial).dispose(); // Add type assertion here
      return false;
    }
    return true;
  });

  game.orbs = game.orbs.filter(orb => {
    if (checkCollision(game.player, orb)) {
      game.scene.remove(orb);
      game.score += CONFIG.orbScoreValue;
      spawnParticleBurst(game.scene, game.particleSystems, game.audioContext, orb.position.x, orb.position.y, orb.position.z);
      return false;
    }
    return orb.position.z < 30;
  });

  if (!game.gameOverTriggered) {
    game.obstacles.forEach(obstacle => {
      if (checkCollision(game.player, obstacle)) {
        game.gameOverTriggered = true;
        const { x, y, z } = game.player.position;
        spawnPlayerDebris(game.scene, game.debris, x, y, z);
        spawnParticleBurst(game.scene, game.particleSystems, game.audioContext, x, y, z, CONFIG.playerColor);
        playCrashSound(game.audioContext);
        game.player.visible = false;
      }
    });
  }
}