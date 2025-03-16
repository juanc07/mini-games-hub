import * as THREE from 'three';

export interface GameState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  player: THREE.Mesh;
  track: THREE.Mesh;
  dustParticles: THREE.Points;
  audioContext: AudioContext;
  score: number;
  speed: number;
  maxSpeed: number;
  orbs: THREE.Mesh[];
  obstacles: THREE.Mesh[];
  particleSystems: THREE.Points[];
  debris: Array<THREE.Mesh & { velocity: THREE.Vector3; life: number }>;
  playerVelocity: number;
  time: number;
  gameOverTriggered: boolean;
}