"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import LumberjackGame from "@/components/games/lumberjack"

export function LumberjackPageClient() {
  const game = getGameBySlug("lumberjack")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <LumberjackGame />
    </GameDetailPage>
  )
}
