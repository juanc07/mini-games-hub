// src/components/Leaderboard.tsx
'use client';

import React from 'react';
import { PlayerBet } from '../lib/solana';

interface LeaderboardProps {
  players: PlayerBet[];
  pot: number;
  timeLeft: number;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ players, pot, timeLeft }) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

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
        <p>Pot: {(pot / 1e9).toFixed(2)} SOL</p>
        <p>Time Left: {formatTime(timeLeft)}</p>
      </div>
      <ul className="space-y-2">
        {sortedPlayers.slice(0, 5).map((player, index) => (
          <li
            key={`${player.player.toBase58()}-${index}`} // Unique key with index fallback
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