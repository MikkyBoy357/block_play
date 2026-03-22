"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { AirHockeyGame } from "@/components/games/air-hockey"

export function AirHockeyPageClient() {
  const game = getGameBySlug("air-hockey")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <AirHockeyGame />
    </GameDetailPage>
  )
}
