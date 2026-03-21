"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { TetrisGame } from "@/components/games/tetris"

export function TetrisPageClient() {
  const game = getGameBySlug("tetris")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <TetrisGame />
    </GameDetailPage>
  )
}
