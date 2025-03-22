// src/app/admin/games/page.tsx
'use server';

import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function AdminGamesPage() {
  async function createGame(formData: FormData) {
    'use server';
    const gameName = formData.get('gameName') as string;
    const taxPercentage = parseFloat(formData.get('taxPercentage') as string);
    const gameId = `${gameName}-${Date.now()}`;

    const res = await fetch('http://localhost:3000/api/game-registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, gameName, taxPercentage }),
    });

    if (res.ok) {
      redirect('/admin/games');
    } else {
      const errorData = await res.json();
      console.error('Failed to create game:', errorData.error || res.statusText);
      throw new Error('Failed to create game');
    }
  }

  const gamesRes = await fetch('http://localhost:3000/api/game-registry');
  if (!gamesRes.ok) {
    return <div>Error loading games: {gamesRes.statusText}</div>;
  }
  const games = await gamesRes.json();

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-4 md:p-8 flex flex-col items-center">
      <h1 className="text-3xl md:text-4xl font-bold text-[#00ff00] drop-shadow-[0_0_10px_#00ff00] mb-8 text-center">
        Admin: Manage Games
      </h1>
      <div className="w-full max-w-3xl space-y-8">
        <Card className="bg-[#222] border-[#333] shadow-[0_0_15px_rgba(0,255,0,0.2)]">
          <CardHeader>
            <CardTitle className="text-xl text-white">Create New Game</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createGame} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="gameName" className="text-white">Game Name</Label>
                <Input
                  id="gameName"
                  name="gameName"
                  type="text"
                  placeholder="e.g., cube-rush"
                  required
                  className="bg-[#333] text-white border-[#00ff00] focus:border-[#00cc00] focus:ring-[#00ff00]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxPercentage" className="text-white">Tax Percentage</Label>
                <Input
                  id="taxPercentage"
                  name="taxPercentage"
                  type="number"
                  placeholder="Tax %"
                  defaultValue="10"
                  step="0.1"
                  required
                  className="bg-[#333] text-white border-[#00ff00] focus:border-[#00cc00] focus:ring-[#00ff00]"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#00ff00] text-black hover:bg-[#00cc00] hover:shadow-[0_0_10px_#00ff00]"
              >
                Create Game
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="bg-[#222] border-[#333] shadow-[0_0_15px_rgba(0,255,0,0.2)]">
          <CardHeader>
            <CardTitle className="text-xl text-white">Existing Games</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white">Game Name</TableHead>
                  <TableHead className="text-white">Game ID</TableHead>
                  <TableHead className="text-white">Tax Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((game: any) => (
                  <TableRow key={game.gameId}>
                    <TableCell className="text-white">{game.gameName}</TableCell>
                    <TableCell className="text-white">{game.gameId}</TableCell>
                    <TableCell className="text-white">{game.taxPercentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}