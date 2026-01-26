"use client"

import { useState, useCallback } from "react"
import type { GameSession } from "@/lib/game-session"

interface UseGameSessionReturn {
  session: GameSession | null
  isLoading: boolean
  error: string | null
  cheatingDetected: boolean
  startGame: (gameId: string) => Promise<void>
  recordAction: (action: string) => Promise<boolean>
  endGame: () => Promise<{ verified: boolean; finalScore: number } | null>
}

export function useGameSession(): UseGameSessionReturn {
  const [session, setSession] = useState<GameSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cheatingDetected, setCheatingDetected] = useState(false)

  const startGame = useCallback(async (gameId: string) => {
    setIsLoading(true)
    setError(null)
    setCheatingDetected(false)
    
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
      
      const data = await response.json()
      
      if (data.cheatingDetected) {
        setCheatingDetected(true)
        setError(data.reason || "Cheating detected")
        return false
      }
      
      if (!response.ok) {
        return false
      }
      
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
      
      const data = await response.json()
      
      if (data.cheatingDetected) {
        setCheatingDetected(true)
        setError("Score verification failed")
        return null
      }
      
      return {
        verified: data.verified,
        finalScore: data.finalScore,
      }
    } catch {
      return null
    }
  }, [session])

  return {
    session,
    isLoading,
    error,
    cheatingDetected,
    startGame,
    recordAction,
    endGame,
  }
}
