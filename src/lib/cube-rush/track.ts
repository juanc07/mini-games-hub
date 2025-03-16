import * as THREE from 'three';
import { CONFIG } from './config';

export function createTrack(scene: THREE.Scene): THREE.Mesh {
  const trackGeometry = new THREE.PlaneGeometry(CONFIG.trackWidth, CONFIG.trackLength, 10, 100);
  const vertices = trackGeometry.attributes.position.array;
  for (let i = 0; i < vertices.length; i += 3) {
    const z = vertices[i + 2];
    vertices[i] += Math.sin(z * CONFIG.trackCurveFactor) * CONFIG.trackCurveAmplitude;
  }
  trackGeometry.computeVertexNormals();

  const trackShaderMaterial = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0.0 }, baseColor: { value: new THREE.Color(CONFIG.trackColor) } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 baseColor;
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        float flow = sin(vUv.y * 10.0 - time * 2.0) * 0.1 + 0.9;
        float glow = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        vec3 color = baseColor + vec3(0.1, 0.2, 0.3) * glow;
        float alpha = 0.4 + glow * 0.3 + flow * 0.2;
        gl_FragColor = vec4(color * flow, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const track = new THREE.Mesh(trackGeometry, trackShaderMaterial);
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0;
  scene.add(track);
  console.log("Curved glass track added at position:", track.position);
  return track;
}