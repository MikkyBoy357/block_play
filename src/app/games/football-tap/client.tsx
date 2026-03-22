"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { FootballTapGame } from "@/components/games/football-tap"

export function FootballTapPageClient() {
  const game = getGameBySlug("football-tap")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <FootballTapGame />
    </GameDetailPage>
  )
}
