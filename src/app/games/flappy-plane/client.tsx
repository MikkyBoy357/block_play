"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { FlappyPlaneGame } from "@/components/games/flappy-plane"

export function FlappyPlanePageClient() {
  const game = getGameBySlug("flappy-plane")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <FlappyPlaneGame />
    </GameDetailPage>
  )
}
