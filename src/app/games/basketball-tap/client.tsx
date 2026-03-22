"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { BasketballTapGame } from "@/components/games/basketball-tap"

export function BasketballTapPageClient() {
  const game = getGameBySlug("basketball-tap")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <BasketballTapGame />
    </GameDetailPage>
  )
}
