'use client';

import React from 'react';
import { WalletProvider } from '../lib/WalletContext';
import '../app/globals.css'; // Import Tailwind styles (adjust path if needed)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>MiniGames Hub</title>
      </head>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}