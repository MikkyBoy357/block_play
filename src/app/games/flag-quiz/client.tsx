"use client"

import { getGameBySlug } from "@/lib/game-data"
import { GameDetailPage } from "@/components/game-detail-page"
import { FlagQuizGame } from "@/components/games/flag-quiz"

export function FlagQuizPageClient() {
  const game = getGameBySlug("flag-quiz")
  if (!game) return null
  return (
    <GameDetailPage game={game}>
      <FlagQuizGame />
    </GameDetailPage>
  )
}
