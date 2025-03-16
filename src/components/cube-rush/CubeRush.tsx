'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CONFIG } from '../../lib/cube-rush/config';
import { createPlayer } from '../../lib/cube-rush/player';
import { createSpaceBackground } from '../../lib/cube-rush/environment';
import { createTrack } from '../../lib/cube-rush/track';
import { spawnOrb, spawnObstacle, updateObjects } from '../../lib/cube-rush/objects';
import { startBackgroundMusic } from '../../lib/cube-rush/audio';
import { GameState } from '../../lib/cube-rush/types';

interface CubeRushProps {
  onGameOver: (score: number) => Promise<void>; // Match GamePage's async signature
  onScoreUpdate: (score: number) => Promise<void>; // Match GamePage's async signature
}

const CubeRush: React.FC<CubeRushProps> = ({ onGameOver, onScoreUpdate }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      CONFIG.cameraFov,
      window.innerWidth / window.innerHeight,
      CONFIG.cameraNear,
      CONFIG.cameraFar
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    scene.background = new THREE.Color(0x000000);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 50);
    pointLight.position.set(0, 10, 5);
    scene.add(pointLight);

    const player = createPlayer(scene);
    const track = createTrack(scene);
    const dustParticles = createSpaceBackground(scene, CONFIG.initialSpeed);

    let audioContext: AudioContext;
    try {
      audioContext = new AudioContext();
      startBackgroundMusic(audioContext);
    } catch (e) {
      console.error('AudioContext initialization failed:', e);
      return;
    }

    camera.position.set(CONFIG.cameraPosition.x, CONFIG.cameraPosition.y, CONFIG.cameraPosition.z);
    camera.lookAt(CONFIG.cameraLookAt.x, CONFIG.cameraLookAt.y, CONFIG.cameraLookAt.z);

    const game: GameState = {
      scene,
      camera,
      renderer,
      player,
      track,
      dustParticles,
      audioContext,
      score: 0,
      speed: CONFIG.initialSpeed,
      maxSpeed: CONFIG.maxSpeed,
      orbs: [],
      obstacles: [],
      particleSystems: [],
      debris: [],
      playerVelocity: 0,
      time: 0,
      gameOverTriggered: false,
    };

    gameRef.current = game;

    spawnOrb(scene, game.orbs);
    spawnObstacle(scene, game.obstacles);

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
        case 'a':
          game.playerVelocity = -CONFIG.playerVelocity;
          break;
        case 'ArrowRight':
        case 'd':
          game.playerVelocity = CONFIG.playerVelocity;
          break;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'ArrowRight', 'd'].includes(event.key)) {
        game.playerVelocity = 0;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      game.time += 0.016;

      if (game.player.visible) {
        game.player.position.x += game.playerVelocity;
        game.player.position.x = Math.max(-CONFIG.playerBoundaryX, Math.min(CONFIG.playerBoundaryX, game.player.position.x));
        game.playerVelocity *= 0.9;
      }

      updateObjects(game);

      if (game.speed < game.maxSpeed) {
        game.speed += CONFIG.speedIncreaseRate;
      }
      if (Math.random() < CONFIG.orbSpawnChance) spawnOrb(scene, game.orbs);
      if (Math.random() < CONFIG.obstacleSpawnChance) spawnObstacle(scene, game.obstacles);

      onScoreUpdate(game.score);
      if (game.gameOverTriggered) {
        onGameOver(game.score);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.children.forEach(child => scene.remove(child));
      audioContext.close().catch(err => console.error('Failed to close AudioContext:', err));
    };
  }, [onGameOver, onScoreUpdate]);

  return <div ref={mountRef} style={{ width: '100%', height: '100vh', position: 'relative' }} />;
};

export default CubeRush;