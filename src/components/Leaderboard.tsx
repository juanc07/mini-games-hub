'use client';

import React, { useState, useEffect } from 'react';
import { PlayerBet } from '../lib/solana';

interface LeaderboardProps {
  players: PlayerBet[];
  pot: number; // In lamports
  timeLeft: number; // Initial time left in seconds
  gameId: string; // To fetch specific game data
}

const Leaderboard: React.FC<LeaderboardProps> = ({ players, pot: initialPot, timeLeft: initialTimeLeft, gameId }) => {
  const [sortedPlayers, setSortedPlayers] = useState<PlayerBet[]>([]);
  const [currentPot, setCurrentPot] = useState(initialPot);
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);

  // Sort players by score
  useEffect(() => {
    setSortedPlayers([...players].sort((a, b) => b.score - a.score));
  }, [players]);

  // Sync initial props
  useEffect(() => {
    console.log(`[Leaderboard] initialPot updated to: ${initialPot} lamports (${initialPot / 1e9} SOL)`);
    setCurrentPot(initialPot);
    setTimeLeft(initialTimeLeft);
  }, [initialPot, initialTimeLeft]);

  // Fetch game data using gameId
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        const response = await fetch(`/api/game-status?gameId=${gameId}`);
        if (!response.ok) throw new Error('Failed to fetch game status');
        const { currentPot: potLamports, cycleEndTime } = await response.json();
        setCurrentPot(potLamports);

        // Calculate time left from cycleEndTime
        const endTime = new Date(cycleEndTime).getTime();
        const now = Date.now();
        const secondsLeft = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(secondsLeft);
      } catch (error) {
        console.error(`Error fetching game data for ${gameId}:`, error);
      }
    };

    fetchGameData(); // Initial fetch
    const fetchInterval = setInterval(fetchGameData, 30000); // Fetch every 30 seconds

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(countdownInterval);
    };
  }, [gameId, currentPot]); // Depend on gameId and currentPot

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed right-4 top-4 w-80 bg-[#1a1a1a] p-4 rounded-lg shadow-[0_0_20px_rgba(0,255,0,0.3)] border border-[#00ff00] text-white">
      <h2 className="text-2xl font-bold text-[#00ff00] drop-shadow-[0_0_5px_#00ff00] mb-3">
        Leaderboard
      </h2>
      <div className="text-lg mb-4">
        <p>Pot: {(currentPot / 1e9).toFixed(3)} SOL</p>
        <p>Time Left: {formatTime(timeLeft)}</p> {/* Display timeLeft */}
      </div>
      <ul className="space-y-2">
        {sortedPlayers.slice(0, 5).map((player, index) => (
          <li
            key={`${player.player.toBase58()}-${index}`}
            className="flex justify-between items-center text-sm bg-[#333] p-2 rounded-md hover:bg-[#444] transition-colors"
          >
            <span>
              {index + 1}. {player.player.toBase58().slice(0, 8)}...
            </span>
            <span className="font-semibold text-[#00ff00]">{player.score} pts</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Leaderboard;