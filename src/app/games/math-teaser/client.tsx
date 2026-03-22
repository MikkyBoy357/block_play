"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { MathTeaserGame } from "@/components/games/math-teaser"

export function MathTeaserPageClient() {
  const game = getGameBySlug("math-teaser")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <MathTeaserGame />
    </GameDetailPage>
  )
}
