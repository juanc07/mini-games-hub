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

export default function AdminDashboard() {
  const [games, setGames] = useState<any[]>([]);
  const [fetchingGames, setFetchingGames] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchGames() {
      try {
        const res = await fetch("http://localhost:3000/api/game-registry");
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        setGames(data);
      } catch (err) {
        setError("Error loading games");
      } finally {
        setFetchingGames(false);
      }
    }
    fetchGames();
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
    router.push("/"); // Navigate back to home page
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
            {fetchingGames ? (
              <p className="text-white">Loading games...</p>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-white">Game Name</TableHead>
                    <TableHead className="text-white">Game ID</TableHead>
                    <TableHead className="text-white">Tax Percentage</TableHead>
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