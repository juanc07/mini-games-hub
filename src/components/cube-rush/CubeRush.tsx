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
  onGameOver: (score: number) => Promise<void>;
  onScoreUpdate: (score: number) => Promise<void>;
}

const CubeRush: React.FC<CubeRushProps> = ({ onGameOver, onScoreUpdate }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Capture the mount node at setup time
    const mountNode = mountRef.current;

    // Clear any existing children
    while (mountNode.firstChild) {
      mountNode.removeChild(mountNode.firstChild);
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      CONFIG.cameraFov,
      1, // Aspect ratio will be updated dynamically
      CONFIG.cameraNear,
      CONFIG.cameraFar
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    // Set initial size based on container
    const updateRendererSize = () => {
      if (mountNode) {
        const width = mountNode.clientWidth;
        const height = mountNode.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    mountNode.appendChild(renderer.domElement);
    updateRendererSize(); // Initial sizing

    scene.background = new THREE.Color(0x000000);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 50);
    pointLight.position.set(0, 10, 5);
    scene.add(pointLight);

    const player = createPlayer(scene);
    const track = createTrack(scene);
    const dustParticles = createSpaceBackground(scene, CONFIG.initialSpeed);

    let audioContext: AudioContext | undefined;
    let stopMusic: (() => void) | undefined;
    let gameOverSent = false;

    try {
      audioContext = new AudioContext();
      stopMusic = startBackgroundMusic(audioContext);
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
      if (game.gameOverTriggered && !gameOverSent) {
        gameOverSent = true;
        console.log('Triggering onGameOver with score:', game.score);
        onGameOver(game.score);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      updateRendererSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      console.log('Cleaning up CubeRush');
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      if (mountNode && renderer.domElement) { // Use captured mountNode
        mountNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.children.forEach(child => scene.remove(child));
      if (stopMusic) {
        stopMusic();
      }
      if (audioContext) {
        audioContext.close().catch(err => console.error('Failed to close AudioContext:', err));
      }
    };
  }, [onGameOver, onScoreUpdate]);

  return <div ref={mountRef} className="game-canvas" />;
};

export default CubeRush;