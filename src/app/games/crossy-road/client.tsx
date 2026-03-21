"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { CrossyRoadGame } from "@/components/games/crossy-road"

export function CrossyRoadPageClient() {
  const game = getGameBySlug("crossy-road")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <CrossyRoadGame />
    </GameDetailPage>
  )
}
