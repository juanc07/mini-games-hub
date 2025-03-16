// src/app/[game]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import * as solanaWeb3 from '@solana/web3.js';
import Leaderboard from '../../components/Leaderboard';
import { useWallet } from '../../lib/WalletContext';

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
  const [timeLeft, setTimeLeft] = useState<number>(2 * 60 * 60); // 2 hours
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
        const game = games.find((g: any) => g.gameName === gameName);
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
      }, 2000); // 2-second delay for user to see final score
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
      const gameData = games.find((g: any) => g.gameId === gameId);

      if (gameData) {
        const playerMap = new Map<string, number>();
        const scoresRes = await fetch('/api/update-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, fetchOnly: true }),
        });
        const scores = await scoresRes.json();
        if (Array.isArray(scores)) {
          scores.forEach((s: any) => {
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
            await fetchPotAndPlayers(); // Refresh leaderboard only if score updated
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
      {betPlaced && (
        <>
          <div className="text-white text-xl mb-4">Pot: {pot / solanaWeb3.LAMPORTS_PER_SOL} SOL</div>
          <div className="text-white text-xl mb-4">Score: {score}</div>
        </>
      )}
      {!betPlaced && (
        <div className="text-white text-xl mb-4">Practice Mode - Score: {score}</div>
      )}
      <CubeRush onGameOver={handleGameOver} onScoreUpdate={handleScoreUpdate} key={resetKey} />
      {betPlaced && <Leaderboard players={players} pot={pot} timeLeft={timeLeft} />}
      {gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center">
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