"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { GlowSnakeGame } from "@/components/games/glow-snake"

export function GlowSnakePageClient() {
  const game = getGameBySlug("glow-snake")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <GlowSnakeGame />
    </GameDetailPage>
  )
}
