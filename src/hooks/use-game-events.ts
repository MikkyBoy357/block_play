"use client"

import { useEffect, useCallback, useRef } from "react"

// Custom event for game lifecycle communication
export interface GameEndDetail {
  gameSlug: string
  finalScore: number
}

const GAME_END_EVENT = "blockplay:game-end"

/**
 * Emit a game-end event from inside a game component.
 * Call this when the game reaches "gameover" state.
 */
export function useGameEndEmitter() {
  const emittedRef = useRef(false)

  const emitGameEnd = useCallback((gameSlug: string, finalScore: number) => {
    if (emittedRef.current) return // prevent double-emit
    emittedRef.current = true
    window.dispatchEvent(
      new CustomEvent<GameEndDetail>(GAME_END_EVENT, {
        detail: { gameSlug, finalScore },
      })
    )
  }, [])

  const resetEmitter = useCallback(() => {
    emittedRef.current = false
  }, [])

  return { emitGameEnd, resetEmitter }
}

/**
 * Listen for game-end events from inside the GameDetailPage wrapper.
 */
export function useGameEndListener(onGameEnd: (detail: GameEndDetail) => void) {
  const callbackRef = useRef(onGameEnd)
  callbackRef.current = onGameEnd

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<GameEndDetail>).detail
      callbackRef.current(detail)
    }
    window.addEventListener(GAME_END_EVENT, handler)
    return () => window.removeEventListener(GAME_END_EVENT, handler)
  }, [])
}
