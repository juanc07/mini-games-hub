'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import * as solanaWeb3 from '@solana/web3.js';
import Leaderboard from '../../components/Leaderboard';
import { useWallet } from '../../lib/WalletContext';
import {GameSchema} from '../../models/Game';
import {ScoreSchema} from '../../models/Score';


const CubeRush = dynamic(() => import('../../components/cube-rush/CubeRush'), { ssr: false });

interface GamePageProps {
  params: Promise<{ game: string }>;
}

interface PlayerBet {
  player: solanaWeb3.PublicKey;
  amount: number;
  score: number;
}

export default function GamePage({ params }: GamePageProps) {
  const resolvedParams = React.use(params);
  const gameName = resolvedParams.game;
  const { wallet, walletConnected } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();
  const betPlaced = searchParams.get('betPlaced') === 'true';

  const [gameOver, setGameOver] = useState<boolean>(false);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [players, setPlayers] = useState<PlayerBet[]>([]);
  const [pot, setPot] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(2 * 60 * 60);
  const [resetKey, setResetKey] = useState<number>(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasEnded, setHasEnded] = useState<boolean>(false);

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        const res = await fetch('/api/game-registry');
        if (!res.ok) throw new Error('Failed to fetch game registry');
        const games = await res.json();
        const game = games.find((g: GameSchema) => g.gameName === gameName);
        if (!game) {
          setError('Game not found in registry');
          console.error('Game not found in registry:', gameName);
          return;
        }
        setGameId(game.gameId);

        if (wallet && betPlaced) {
          const userId = wallet.toBase58();
          if (!game.activePlayers.some((p: { userId: string }) => p.userId === userId)) {
            setError('You must place a bet to participate in leaderboard');
            router.push('/');
          }
        }
      } catch (err) {
        setError('Error loading game data');
        console.error('Fetch error:', err);
      }
    };
    fetchGameData();
  }, [gameName, wallet, router, betPlaced]);

  useEffect(() => {
    if (gameId && !gameOver && betPlaced) {
      fetchPotAndPlayers();
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0) {
            handleCycleEnd();
            return 2 * 60 * 60;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameId, gameOver, betPlaced]);

  useEffect(() => {
    if (gameOver && hasEnded && !error) {
      const timeout = setTimeout(() => {
        console.log('Redirecting to home page after game over');
        router.push('/');
      }, 2000);
      return () => {
        console.log('Cleaning up redirect timeout');
        clearTimeout(timeout);
      };
    }
  }, [gameOver, hasEnded, router, error]);

  const fetchPotAndPlayers = async () => {
    if (!gameId || !betPlaced) return;
    try {
      const potRes = await fetch('/api/get-pot-amount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      });
      const { potAmount } = await potRes.json();
      setPot(potAmount);

      const gameRes = await fetch('/api/game-registry');
      const games = await gameRes.json();
      const gameData = games.find((g: GameSchema) => g.gameId === gameId);

      if (gameData) {
        const playerMap = new Map<string, number>();
        const scoresRes = await fetch('/api/update-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, fetchOnly: true }),
        });
        const scores = await scoresRes.json();
        if (Array.isArray(scores)) {
          scores.forEach((s: ScoreSchema) => {
            if (s.userId && typeof s.score === 'number') {
              playerMap.set(s.userId, s.score);
            }
          });
        }
        const uniquePlayers = new Map<string, { userId: string }>();
        gameData.activePlayers.forEach((p: { userId: string }) => {
          uniquePlayers.set(p.userId, p);
        });
        const activePlayers = Array.from(uniquePlayers.values()).map((p: { userId: string }) => ({
          player: new solanaWeb3.PublicKey(p.userId),
          amount: 0.001 * solanaWeb3.LAMPORTS_PER_SOL,
          score: playerMap.get(p.userId) || 0,
        }));
        setPlayers(activePlayers);
      }
    } catch (error) {
      console.error('Failed to fetch pot and players:', error);
    }
  };

  const handleGameOver = useCallback(
    async (newScore: number) => {
      console.log('handleGameOver called with score:', newScore);
      if (hasEnded) {
        console.log('Game already ended, skipping');
        return;
      }

      setHasEnded(true);
      setGameOver(true);
      setFinalScore(newScore);
      setScore(newScore);

      if (wallet && gameId && betPlaced) {
        try {
          const userId = wallet.toBase58();
          console.log('Updating score for user:', userId);
          const response = await fetch('/api/update-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId, userId, score: newScore }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update score');
          }
          const result = await response.json();
          if (result.updated) {
            console.log(`Score updated from ${result.previousScore} to ${result.newScore}`);
            await fetchPotAndPlayers();
          } else {
            console.log(`Score not updated: ${newScore} <= ${result.previousScore}`);
          }
        } catch (error) {
          console.error('Failed to update score on game over:', error);
        }
      }
    },
    [wallet, gameId, betPlaced, hasEnded]
  );

  const handleScoreUpdate = useCallback(async (newScore: number) => {
    setScore(newScore);
    return Promise.resolve();
  }, []);

  const handleCycleEnd = async () => {
    if (!gameId || !betPlaced) return;
    try {
      await fetch('/api/distribute-winnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      });
      await fetchPotAndPlayers();
      setTimeLeft(2 * 60 * 60);
    } catch (error) {
      console.error('Cycle end failed:', error);
    }
  };

  if (!walletConnected) {
    return <div className="text-white text-center">Please connect your wallet from the home page.</div>;
  }

  if (error) {
    return <div className="text-white text-center">{error}</div>;
  }

  if (!gameId) {
    return <div className="text-white text-center">Loading game data...</div>;
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center p-4 md:p-8">
      <h1 className="text-4xl md:text-5xl font-bold text-[#00ff00] drop-shadow-[0_0_10px_#00ff00] mb-6">
        {gameName.replace('-', ' ').toUpperCase()}
      </h1>
      <div className="w-full max-w-7xl flex flex-col md:flex-row gap-4">
        {/* Game Area */}
        <div className="flex-1 md:w-2/3">
          {betPlaced && (
            <div className="text-white text-xl mb-4">
              Pot: {pot / solanaWeb3.LAMPORTS_PER_SOL} SOL | Score: {score}
            </div>
          )}
          {!betPlaced && (
            <div className="text-white text-xl mb-4">Practice Mode - Score: {score}</div>
          )}
          <div className="game-container">
            <CubeRush onGameOver={handleGameOver} onScoreUpdate={handleScoreUpdate} key={resetKey} />
          </div>
        </div>

        {/* Leaderboard */}
        {betPlaced && (
          <div className="md:w-1/3">
            <Leaderboard players={players} pot={pot} timeLeft={timeLeft} />
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="w-full max-w-7xl mt-8">
        <div className="bg-[#333] p-4 rounded-lg text-white">
          <h2 className="text-2xl font-bold text-[#00ff00] mb-4">Comments</h2>
          <p className="text-gray-400">Comments section coming soon...</p>
          {/* Add comment form or list here later */}
        </div>
      </div>

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-[#333] p-8 rounded-lg text-white text-center shadow-[0_0_20px_rgba(0,255,0,0.5)]">
            <h2 className="text-3xl text-red-500 mb-4">Game Over!</h2>
            <p className="text-xl mb-6">Final Score: {finalScore}</p>
            <p className="text-lg">Redirecting to game selection...</p>
          </div>
        </div>
      )}
    </div>
  );
}