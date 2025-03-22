"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function EditGamePage() {
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { gameId } = useParams();

  useEffect(() => {
    async function fetchGame() {
      try {
        const res = await fetch(`http://localhost:3000/api/game-registry?gameId=${gameId}`);
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        setGame(data);
      } catch (err) {
        setError("Error loading game");
      } finally {
        setLoading(false);
      }
    }
    if (gameId) fetchGame();
  }, [gameId]);

  const fakeDelay = () => {
    return new Promise<void>((resolve) => {
      let progressValue = 0;
      const interval = setInterval(() => {
        progressValue += 10;
        setProgress(progressValue);
        if (progressValue >= 100) {
          clearInterval(interval);
          resolve();
        }
      }, 200); // ~2 seconds
    });
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProgress(0);

    const formData = new FormData(e.currentTarget);
    const gameName = formData.get("gameName") as string;
    const taxPercentage = parseFloat(formData.get("taxPercentage") as string);

    try {
      await fakeDelay();

      const res = await fetch("http://localhost:3000/api/game-registry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, gameName, taxPercentage }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || res.statusText);
      }

      router.push("/admin/dashboard");
    } catch (err) {
      console.error("Failed to update game:", err);
      setError("Failed to update game");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  async function handleSendPot() {
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      await fakeDelay();

      const res = await fetch("http://localhost:3000/api/sendpot-to-developer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || res.statusText);
      }

      setGame((prev: any) => ({ ...prev, currentPot: 0 }));
    } catch (err) {
      console.error("Failed to send pot:", err);
      setError("Failed to send pot");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Card className="bg-[#222] border-[#333] shadow-[0_0_15px_rgba(0,255,0,0.2)] w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl text-[#00ff00] text-center">Loading Game</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-t-[#00ff00] border-[#333] rounded-full animate-spin"></div>
            </div>
            <p className="text-white text-center text-sm">Fetching game data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Card className="bg-[#222] border-[#333] shadow-[0_0_15px_rgba(0,255,0,0.2)] w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl text-red-500 text-center">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500 text-center">{error}</p>
            <Button
              onClick={() => router.push("/admin/dashboard")}
              className="mt-4 w-full bg-[#333] text-[#00ff00] hover:bg-[#444]"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <Card className="bg-[#222] border-[#333] shadow-[0_0_15px_rgba(0,255,0,0.2)]">
          <CardHeader>
            <CardTitle className="text-xl text-white">Edit Game: {gameId}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="gameName" className="text-white">Game Name</Label>
                <Input
                  id="gameName"
                  name="gameName"
                  type="text"
                  defaultValue={game.gameName}
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
                  defaultValue={game.taxPercentage}
                  step="0.1"
                  required
                  className="bg-[#333] text-white border-[#00ff00] focus:border-[#00cc00] focus:ring-[#00ff00]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Current Pot</Label>
                <p className="text-white">{(game.currentPot / 1e9).toFixed(3)} SOL</p>
              </div>
              <div className="flex justify-between">
                <Button
                  type="button"
                  onClick={() => router.push("/admin/dashboard")}
                  className="bg-[#333] text-[#00ff00] hover:bg-[#444]"
                >
                  Cancel
                </Button>
                <div className="space-x-2">
                  <Button
                    type="button"
                    onClick={handleSendPot}
                    disabled={loading}
                    className="bg-blue-500 text-white hover:bg-blue-600"
                  >
                    {loading ? "Sending..." : "Send Pot to Developer"}
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-[#00ff00] text-black hover:bg-[#00cc00] hover:shadow-[0_0_10px_#00ff00] disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
              {loading && <Progress value={progress} className="w-full mt-2" />}
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}