// types/solana.d.ts
import { PublicKey, Transaction } from '@solana/web3.js';

interface PhantomWallet {
  isPhantom: boolean;
  publicKey: PublicKey;
  connect: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  disconnect: () => Promise<void>;
}

declare global {
  interface Window {
    solana?: PhantomWallet;
  }
}