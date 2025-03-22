"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function CreateGamePage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
    const gameId = `${gameName}-${Date.now()}`;

    try {
      await fakeDelay();

      const res = await fetch("http://localhost:3000/api/game-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, gameName, taxPercentage }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || res.statusText);
      }

      router.push("/admin/dashboard");
    } catch (err) {
      console.error("Failed to create game:", err);
      setError("Failed to create game");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <Card className="bg-[#222] border-[#333] shadow-[0_0_15px_rgba(0,255,0,0.2)]">
          <CardHeader>
            <CardTitle className="text-xl text-white">Create New Game</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
              <div className="flex justify-between">
                <Button
                  type="button"
                  onClick={() => router.push("/admin/dashboard")}
                  className="bg-[#333] text-[#00ff00] hover:bg-[#444]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#00ff00] text-black hover:bg-[#00cc00] hover:shadow-[0_0_10px_#00ff00] disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create Game"}
                </Button>
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