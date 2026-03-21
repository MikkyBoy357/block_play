"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { PacmanGame } from "@/components/games/pacman"

export function PacmanPageClient() {
  const game = getGameBySlug("pacman")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <PacmanGame />
    </GameDetailPage>
  )
}
