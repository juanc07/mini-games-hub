"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import * as solanaWeb3 from "@solana/web3.js";

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
  currentPot: number; // In lamports
}

export default function AdminDashboard() {
  const [games, setGames] = useState<(Game & { currentPot: number })[]>([]);
  const [fetchingGames, setFetchingGames] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchGamesAndStatuses() {
      try {
        const registryRes = await fetch("http://localhost:3000/api/game-registry");
        if (!registryRes.ok) throw new Error(registryRes.statusText);
        const registryData: Game[] = await registryRes.json();

        const statusRes = await fetch("http://localhost:3000/api/game-status");
        if (!statusRes.ok) throw new Error(statusRes.statusText);
        const statusData: GameStatus[] = await statusRes.json();

        const mergedGames = registryData.map((game) => {
          const status = statusData.find((s) => s.gameId === game.gameId);
          return {
            ...game,
            currentPot: status ? status.currentPot : 0,
          };
        });

        setGames(mergedGames);
      } catch (err) {
        setError("Error loading games");
        console.error("Fetch error:", err);
      } finally {
        setFetchingGames(false);
      }
    }
    fetchGamesAndStatuses();
  }, []);

  async function handleDelete() {
    if (!gameToDelete) return;

    try {
      const res = await fetch("http://localhost:3000/api/game-registry", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: gameToDelete }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || res.statusText);
      }

      setGames((prev) => prev.filter((game) => game.gameId !== gameToDelete));
      setDeleteDialogOpen(false);
      setGameToDelete(null);
    } catch (err) {
      console.error("Failed to delete game:", err);
      setError("Failed to delete game");
    }
  }

  function openDeleteDialog(gameId: string) {
    setGameToDelete(gameId);
    setDeleteDialogOpen(true);
  }

  function handleBack() {
    router.push("/");
  }

  if (fetchingGames) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Card className="bg-[#222] border-[#333] shadow-[0_0_15px_rgba(0,255,0,0.2)] w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl text-[#00ff00] text-center">Loading Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-t-[#00ff00] border-[#333] rounded-full animate-spin"></div>
            </div>
            <p className="text-white text-center text-sm animate-pulse">Fetching game data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#00ff00] drop-shadow-[0_0_10px_#00ff00] text-center">
            Admin Dashboard
          </h1>
          <div className="flex gap-4">
            <Button
              onClick={handleBack}
              className="bg-[#333] text-[#00ff00] hover:bg-[#444] hover:shadow-[0_0_10px_#00ff00]"
            >
              Back
            </Button>
            <Button
              onClick={() => router.push("/admin/games/create")}
              className="bg-[#00ff00] text-black hover:bg-[#00cc00] hover:shadow-[0_0_10px_#00ff00]"
            >
              Create Game
            </Button>
          </div>
        </div>
        <Card className="bg-[#222] border-[#333] shadow-[0_0_15px_rgba(0,255,0,0.2)]">
          <CardHeader>
            <CardTitle className="text-xl text-white">Games</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-red-500">{error}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-white">Game Name</TableHead>
                    <TableHead className="text-white">Game ID</TableHead>
                    <TableHead className="text-white">Tax Percentage</TableHead>
                    <TableHead className="text-white">Current Pot (SOL)</TableHead>
                    <TableHead className="text-white">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((game) => (
                    <TableRow key={game.gameId}>
                      <TableCell className="text-white">{game.gameName}</TableCell>
                      <TableCell className="text-white">{game.gameId}</TableCell>
                      <TableCell className="text-white">{game.taxPercentage}%</TableCell>
                      <TableCell className="text-white">
                        {(game.currentPot / solanaWeb3.LAMPORTS_PER_SOL).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-white">
                        <Button
                          onClick={() => router.push(`/admin/games/${game.gameId}`)}
                          className="bg-[#00ff00] text-black hover:bg-[#00cc00] mr-2"
                        >
                          Edit
                        </Button>
                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              onClick={() => openDeleteDialog(game.gameId)}
                              className="bg-red-500 text-white hover:bg-red-600"
                            >
                              Delete
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#222] border-[#333] text-white">
                            <DialogHeader>
                              <DialogTitle>Confirm Deletion</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete {gameToDelete}? This action cannot be undone.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button
                                onClick={() => setDeleteDialogOpen(false)}
                                className="bg-[#333] text-[#00ff00] hover:bg-[#444]"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleDelete}
                                className="bg-red-500 text-white hover:bg-red-600"
                              >
                                Delete
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}