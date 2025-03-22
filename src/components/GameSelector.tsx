'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useWallet } from '../lib/WalletContext';
import * as solanaWeb3 from '@solana/web3.js';
import { Toaster, toast } from 'sonner';

interface Game {
  gameId: string;
  gameName: string;
  taxPercentage: number;
  cycleEndTime: string;
}

interface GameStatus {
  gameId: string;
  gameName: string;
  timeLeft: number;
  cycleActive: boolean;
  currentPot: number; // Add currentPot to GameStatus
}

interface GameSelectorProps {
  serverStatus: boolean | null;
}

const GameSelector: React.FC<GameSelectorProps> = ({ serverStatus }) => {
  const { wallet, walletConnected } = useWallet();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [gameStatuses, setGameStatuses] = useState<Map<string, GameStatus>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [betAmount, setBetAmount] = useState<number>(0.001);
  const [bettingGameId, setBettingGameId] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  useEffect(() => {
    const fetchGamesAndStatuses = async () => {
      try {
        const res = await fetch('/api/game-registry', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error('Failed to fetch games');
        const data: Game[] = await res.json();
        setGames(data);

        const statusRes = await fetch('/api/game-status');
        if (!statusRes.ok) throw new Error('Failed to fetch game statuses');
        const statuses: GameStatus[] = await statusRes.json();
        const statusMap = new Map<string, GameStatus>();
        statuses.forEach(status => statusMap.set(status.gameId, { ...status }));
        setGameStatuses(statusMap);
      } catch (error) {
        console.error('Error fetching games or statuses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGamesAndStatuses();
    const fetchInterval = setInterval(fetchGamesAndStatuses, 10 * 1000); // Sync every 10 seconds

    const countdownInterval = setInterval(() => {
      setGameStatuses(prev => {
        const updated = new Map(prev);
        updated.forEach(status => {
          if (status.timeLeft > 0) {
            status.timeLeft = Math.max(0, status.timeLeft - 1);
          }
        });
        return updated;
      });
    }, 1000); // Update every second

    return () => {
      clearInterval(fetchInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  const handlePlaceBet = async (game: Game) => {
    if (!wallet || !walletConnected) {
      toast.error('Please connect your wallet to place a bet.', {
        description: 'Connect via the wallet button in the header.',
      });
      return;
    }

    if (serverStatus === false) {
      toast.error('Cannot place bet: Server is currently offline.', {
        description: 'Please try again when the server is back online.',
      });
      return;
    }

    const solana = window.solana;
    if (!solana || !solana.isPhantom) {
      toast.error('Please install Phantom Wallet to proceed.', {
        description: 'Download it from phantom.app.',
      });
      return;
    }

    const gameStatus = gameStatuses.get(game.gameId);
    if (!gameStatus || gameStatus.timeLeft < 300) {
      toast.error('Cannot place bet: Less than 5 minutes remaining in this cycle.', {
        description: 'Wait for the next cycle to start.',
      });
      return;
    }

    setBettingGameId(game.gameId);
    try {
      const response = await fetch('/api/place-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: wallet.toBase58(),
          amountSol: betAmount,
          gameId: game.gameId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get transaction');

      const tx = solanaWeb3.Transaction.from(Buffer.from(data.transaction, 'base64'));
      const signedTx = await solana.signTransaction(tx);
      const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'), 'confirmed');
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature);

      const confirmResponse = await fetch('/api/place-bet-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: wallet.toBase58(),
          amountSol: betAmount,
          gameId: game.gameId,
          signature,
        }),
      });
      if (!confirmResponse.ok) {
        const confirmData = await confirmResponse.json();
        throw new Error(confirmData.error || 'Failed to confirm bet');
      }

      router.push(`/${game.gameName.replace(' ', '-')}/?betPlaced=true`);
      toast.success(`Successfully placed bet of ${betAmount} SOL on ${game.gameName}.`, {
        description: 'Good luck!',
      });
    } catch (error: any) {
      console.error('Error placing bet:', error);
      toast.error(`Failed to place bet: ${error.message || 'Unknown error'}`, {
        description: 'Please try again or check the console for details.',
      });
    } finally {
      setBettingGameId(null);
      setSelectedGame(null);
    }
  };

  const handlePlayWithoutBet = (game: Game) => {
    router.push(`/${game.gameName.replace(' ', '-')}/?betPlaced=false`);
    setSelectedGame(null);
  };

  const toggleGameOptions = (gameId: string) => {
    setSelectedGame(selectedGame === gameId ? null : gameId);
  };

  const formatTimeLeft = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return <div className="text-white text-center text-xl">Loading games...</div>;
  }

  if (!walletConnected) {
    return null;
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
      <h2 className="text-3xl md:text-4xl font-bold text-[#00ff00] drop-shadow-[0_0_10px_#00ff00] mb-8 text-center">
        Select a Game
      </h2>
      <div className="mb-6 flex justify-center items-center gap-4">
        <label className="text-white text-lg">Bet Amount (SOL):</label>
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
          className="text-black p-2 rounded w-24"
          min="0.001"
          step="0.001"
          disabled={serverStatus === false}
        />
      </div>
      {games.length === 0 ? (
        <p className="text-white text-center text-xl">No games available</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {games.map((game) => {
            const status = gameStatuses.get(game.gameId);
            const timeLeft = status ? formatTimeLeft(status.timeLeft) : 'Loading...';
            const currentPot = status ? status.currentPot / solanaWeb3.LAMPORTS_PER_SOL : 0; // Convert to SOL
            const canBet = status && status.timeLeft >= 300 && status.cycleActive;

            return (
              <div key={game.gameId} className="relative">
                <Button
                  onClick={() => toggleGameOptions(game.gameId)}
                  className="w-full h-56 bg-[#00ff00] text-black hover:bg-[#00cc00] hover:shadow-[0_0_20px_#00ff00,0_0_40px_#00ff00] transition-all duration-300 transform hover:scale-105 border-4 border-[#00ff00] text-2xl font-bold uppercase flex flex-col justify-center items-center"
                  disabled={bettingGameId === game.gameId}
                >
                  <span>{bettingGameId === game.gameId ? 'Placing Bet...' : game.gameName.replace('-', ' ')}</span>
                  <span className="text-sm mt-2">Time Left: {timeLeft}</span>
                  <span className="text-sm mt-2">Pot: {currentPot.toFixed(3)} SOL</span>
                </Button>
                {selectedGame === game.gameId && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border-2 border-[#00ff00] rounded-lg p-2 z-10 shadow-lg">
                    <Button
                      onClick={() => handlePlayWithoutBet(game)}
                      className="w-full mb-2 bg-gray-500 text-white hover:bg-gray-600 text-lg py-2"
                    >
                      Play Without Bet
                    </Button>
                    <Button
                      onClick={() => handlePlaceBet(game)}
                      className="w-full bg-[#00ff00] text-black hover:bg-[#00cc00] disabled:opacity-50 text-lg py-2"
                      disabled={serverStatus === false || bettingGameId === game.gameId || !canBet}
                    >
                      {serverStatus === false
                        ? 'Server Offline'
                        : !canBet
                        ? 'Cycle Ending Soon'
                        : 'Place Bet'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Toaster />
    </div>
  );
};

export default GameSelector;