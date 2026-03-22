"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { BrickBreakGame } from "@/components/games/brick-break"

export function BrickBreakPageClient() {
  const game = getGameBySlug("brick-break")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <BrickBreakGame />
    </GameDetailPage>
  )
}
