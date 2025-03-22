'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import GameSelector from '../components/GameSelector';
import { useWallet } from '../lib/WalletContext';

export default function Home() {
  const { walletConnected, isAdmin, connectWallet } = useWallet();
  const [serverStatus, setServerStatus] = useState<boolean | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await response.json();
        setServerStatus(response.ok && data.status === 'ok');
      } catch (error) {
        console.log("error: ", error);
        setServerStatus(false);
      }
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectWallet = async () => {
    if (serverStatus === false) {
      setShowPopup(true);
      return;
    }
    await connectWallet();
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-6 md:p-12 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            serverStatus === null ? 'bg-gray-500' : serverStatus ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-white text-sm">
          Server: {serverStatus === null ? 'Checking...' : serverStatus ? 'Online' : 'Offline'}
        </span>
      </div>

      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-[#1a1a1a] p-6 rounded-lg border-2 border-red-500 max-w-md">
            <h3 className="text-xl font-bold text-red-500 mb-4">Server Offline</h3>
            <p className="text-white mb-4">
              The server is currently offline. Please try again later when the server is back online.
            </p>
            <Button
              onClick={() => setShowPopup(false)}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      <h1 className="text-5xl md:text-6xl font-extrabold text-[#00ff00] drop-shadow-[0_0_15px_#00ff00] mb-12 text-center">
        MiniGames Hub
      </h1>
      {!walletConnected && (
        <Button
          onClick={handleConnectWallet}
          className="bg-[#00ff00] text-black hover:bg-[#00cc00] hover:shadow-[0_0_15px_#00ff00] text-2xl font-bold py-4 px-8 rounded-lg border-4 border-[#00ff00] transition-all duration-300"
        >
          Connect Phantom Wallet
        </Button>
      )}
      {walletConnected && (
        <div className="w-full flex flex-col items-center gap-12">
          <GameSelector serverStatus={serverStatus} />
          {isAdmin && (
            <Link href="/admin/dashboard" passHref>
              <Button className="bg-[#00ff00] text-black hover:bg-[#00cc00] hover:shadow-[0_0_15px_#00ff00] text-2xl font-bold py-4 px-8 rounded-lg border-4 border-[#00ff00] transition-all duration-300">
                Admin Dashboard
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}