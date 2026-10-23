import type { Metadata } from "next";
import { Leaderboard } from "./leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard · Chogstra",
  description: "Streaks, applause and Spotlight wins for every Chog that has performed onchain.",
};

export default function LeaderboardPage() {
  return <Leaderboard />;
}
