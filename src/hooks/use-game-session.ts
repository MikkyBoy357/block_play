"use client"

import { useState, useCallback } from "react"
import type { GameSession } from "@/lib/game-session"
import { getGameBySlug, type SubscriptionTier } from "@/lib/game-data"
import { canEarn, recordGameEarning, getEarningsSummary } from "@/lib/earnings"

interface EarningResult {
  qualified: boolean
  earned: number
  totalWeekly: number
  capped: boolean
  multiplier: number
}

interface UseGameSessionReturn {
  session: GameSession | null
  isLoading: boolean
  error: string | null
  startGame: (gameId: string) => Promise<void>
  recordAction: (action: string) => Promise<boolean>
  endGame: () => Promise<{ verified: boolean; finalScore: number; earning: EarningResult } | null>
  getEarnings: (subscriptionTier: SubscriptionTier) => ReturnType<typeof getEarningsSummary>
}

export function useGameSession(): UseGameSessionReturn {
  const [session, setSession] = useState<GameSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startGame = useCallback(async (gameId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to start game")
      }
      
      const data = await response.json()
      setSession(data.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const recordAction = useCallback(async (action: string): Promise<boolean> => {
    if (!session) return false
    
    try {
      const response = await fetch("/api/game/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, action }),
      })
      if (!response.ok) return false

      const data = await response.json()
      setSession(data.session)
      return true
    } catch {
      return false
    }
  }, [session])

  const endGame = useCallback(async () => {
    if (!session) return null
    
    try {
      const response = await fetch("/api/game/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      })
      if (!response.ok) return null

      const data = await response.json()
      const finalScore = data.finalScore as number

      // Server returns DB-backed earning data for logged-in users
      if (data.earned !== undefined && data.earned !== null) {
        const game = getGameBySlug(session.gameId)
        return {
          verified: data.verified,
          finalScore,
          earning: {
            qualified: data.qualified ?? false,
            earned: data.earned,
            totalWeekly: data.totalWeekly ?? 0,
            capped: data.capped ?? false,
            multiplier: game ? Math.floor(finalScore / game.qualifyingScore) : 0,
          },
        }
      }

      // Fallback: localStorage-based earning for anonymous players
      const game = getGameBySlug(session.gameId)
      const earning: EarningResult = {
        qualified: false,
        earned: 0,
        totalWeekly: 0,
        capped: false,
        multiplier: 0,
      }

      if (game && finalScore >= game.qualifyingScore) {
        earning.qualified = true
        earning.multiplier = Math.floor(finalScore / game.qualifyingScore)

        const tier: SubscriptionTier = "weekly"
        const { canEarn: canStillEarn } = canEarn(tier)

        if (canStillEarn) {
          const result = recordGameEarning(finalScore, game.qualifyingScore, game.earnAmount, tier)
          earning.earned = result.earned
          earning.totalWeekly = result.totalWeekly
          earning.capped = result.capped
          earning.multiplier = result.multiplier
        } else {
          earning.capped = true
          const summary = getEarningsSummary(tier)
          earning.totalWeekly = summary.totalEarned
        }
      }

      return {
        verified: data.verified,
        finalScore,
        earning,
      }
    } catch {
      return null
    }
  }, [session])

  const getEarnings = useCallback((subscriptionTier: SubscriptionTier) => {
    return getEarningsSummary(subscriptionTier)
  }, [])

  return {
    session,
    isLoading,
    error,
    startGame,
    recordAction,
    endGame,
    getEarnings,
  }
}
