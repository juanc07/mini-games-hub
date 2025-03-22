'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as solanaWeb3 from '@solana/web3.js';

export interface WalletContextType {
  walletConnected: boolean;
  wallet: solanaWeb3.PublicKey | null;
  isAdmin: boolean;
  connectWallet: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

const ADMIN_PUBLIC_KEY = process.env.NEXT_PUBLIC_ADMIN_WALLET;
if (!ADMIN_PUBLIC_KEY) {
  throw new Error('NEXT_PUBLIC_ADMIN_WALLET is not defined in .env');
}

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [wallet, setWallet] = useState<solanaWeb3.PublicKey | null>(null);

  const connectWallet = async () => {
    const solana = window.solana;
    if (solana && solana.isPhantom) {
      try {
        await solana.connect();
        const publicKey = new solanaWeb3.PublicKey(solana.publicKey.toString());
        setWallet(publicKey);
        setWalletConnected(true);
        setIsAdmin(publicKey.toBase58() === ADMIN_PUBLIC_KEY);
      } catch (error: any) {
        console.error('Wallet connection failed:', error);
        alert(error.message === 'User rejected the request' ? 'Wallet connection rejected.' : 'Wallet connection error.');
      }
    } else {
      alert('Please install Phantom Wallet!');
    }
  };

  useEffect(() => {
    const solana = window.solana;
    if (solana && solana.isPhantom && solana.publicKey) {
      const publicKey = new solanaWeb3.PublicKey(solana.publicKey.toString());
      setWallet(publicKey);
      setWalletConnected(true);
      setIsAdmin(publicKey.toBase58() === ADMIN_PUBLIC_KEY);
    }
  }, []);

  return (
    <WalletContext.Provider value={{ walletConnected, wallet, isAdmin, connectWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within a WalletProvider');
  return context;
};