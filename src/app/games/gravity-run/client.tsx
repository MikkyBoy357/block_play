"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { GravityRunGame } from "@/components/games/gravity-run"

export function GravityRunPageClient() {
  const game = getGameBySlug("gravity-run")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <GravityRunGame />
    </GameDetailPage>
  )
}
