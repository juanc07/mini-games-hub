import * as THREE from 'three';
import { CONFIG } from './config';

export function createPlayer(scene: THREE.Scene): THREE.Mesh {
  const playerShaderMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0.0 }, baseColor: { value: new THREE.Color(CONFIG.playerColor) } },
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
        float pulse = sin(time * 4.0) * 0.2 + 0.8;
        float glow = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(baseColor * (pulse + glow * 0.5), 1.0);
      }
    `,
  });
  const player = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.playerSize, CONFIG.playerSize, CONFIG.playerSize),
    playerShaderMaterial
  );
  player.position.set(0, CONFIG.playerSize / 2, 20);
  scene.add(player);
  return player;
}