"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"

// Game constants
const VISIBLE_SEGMENTS = 8
const SEGMENT_HEIGHT = 80 // Matching the taller tree sections in your screenshot
const ANIMATION_DURATION = 100

type Side = "left" | "right" | "none"
type GameStatus = "playing" | "game-over"

interface GameSegment {
  id: number
  side: Side
}

export function LumberjackGame() {
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing")
  const [segments, setSegments] = useState<GameSegment[]>([])
  const [playerSide, setPlayerSide] = useState<"left" | "right">("right")
  const [score, setScore] = useState(0)
  
  const segmentIdCounter = useRef(0)

  // 1. Logic to generate a safe new branch
  const createSegment = (forceNone = false): GameSegment => {
    let side: Side = "none"
    if (!forceNone) {
      const rand = Math.random()
      side = rand < 0.3 ? "left" : rand < 0.6 ? "right" : "none"
    }
    return { id: segmentIdCounter.current++, side }
  }

  // 2. Initialize: Bottom 3 segments should always be empty so player doesn't die instantly
  const initializeGame = () => {
    const initial: GameSegment[] = []
    for (let i = 0; i < VISIBLE_SEGMENTS; i++) {
      initial.push(createSegment(i < 3))
    }
    setSegments(initial)
    setScore(0)
    setGameStatus("playing")
  }

  useEffect(() => {
    initializeGame()
  }, [])

  // 3. The Chop Logic
  const handleChop = useCallback((side: "left" | "right") => {
    if (gameStatus !== "playing") return

    setPlayerSide(side)

    // The segment currently at the bottom is segments[0]
    // The segment immediately ABOVE the player after the chop will be segments[1]
    const segmentAbove = segments[1]

    if (segmentAbove && segmentAbove.side === side) {
      setGameStatus("game-over")
      return
    }

    setScore(s => s + 1)

    // Update the tree: Remove bottom, add new one to the top
    setSegments(prev => {
      const next = [...prev.slice(1)] // Remove the log we just cut
      next.push(createSegment())      // Add a new log at the very top
      return next
    })
  }, [gameStatus, segments])

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleChop("left")
      if (e.key === "ArrowRight") handleChop("right")
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleChop])

  return (
    <div className="fixed inset-0 bg-sky-200 flex flex-col items-center justify-end overflow-hidden select-none">
      
      {/* Score */}
      <div className="absolute top-10 text-6xl font-black text-white drop-shadow-md z-50">
        {score}
      </div>

      {/* The Tree Area */}
      <div className="relative w-64 mb-32" style={{ height: VISIBLE_SEGMENTS * SEGMENT_HEIGHT }}>
        
        {/* Render Segments */}
        <div className="absolute bottom-0 w-full flex flex-col-reverse items-center">
          {segments.map((seg, index) => (
            <div 
              key={seg.id}
              className="relative transition-all duration-100 ease-linear"
              style={{ 
                height: SEGMENT_HEIGHT, 
                width: 60,
                backgroundColor: '#8B4513',
                border: '2px solid #5D2E0C'
              }}
            >
              {/* Branches */}
              {seg.side !== "none" && (
                <div 
                  className={`absolute top-2 w-32 h-6 bg-green-700 rounded-full ${
                    seg.side === "left" ? "right-full mr-2" : "left-full ml-2"
                  }`}
                />
              )}
              
              {/* Debug Index (Optional) */}
              <span className="absolute inset-0 flex items-center justify-center text-xs text-white/20">
                {index}
              </span>
            </div>
          ))}
        </div>

        {/* Player Character */}
        <div 
          className={`absolute bottom-0 transition-all duration-75 flex flex-col items-center`}
          style={{ 
            left: playerSide === "left" ? "-40px" : "100px",
            width: 80,
            height: 100
          }}
        >
          {/* Simple Lumberjack Body */}
          <div className="w-12 h-16 bg-red-600 rounded-t-lg relative">
              <div className="absolute -top-6 left-2 w-8 h-8 bg-orange-200 rounded-full" /> {/* Head */}
              <div className={`absolute top-2 w-10 h-4 bg-gray-800 ${playerSide === 'left' ? 'left-full' : 'right-full'}`} /> {/* Axe */}
          </div>
        </div>
      </div>

      {/* Ground */}
      <div className="w-full h-32 bg-green-500 border-t-8 border-green-600 z-10" />

      {/* Mobile Controls */}
      <div className="absolute bottom-10 flex gap-20 z-20">
        <button 
          onMouseDown={() => handleChop("left")}
          className="w-20 h-20 bg-orange-400 rounded-full border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 flex items-center justify-center text-4xl"
        >
          ⬅️
        </button>
        <button 
          onMouseDown={() => handleChop("right")}
          className="w-20 h-20 bg-orange-400 rounded-full border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 flex items-center justify-center text-4xl"
        >
          ➡️
        </button>
      </div>

      {/* Game Over Overlay */}
      {gameStatus === "game-over" && (
        <div className="absolute inset-0 bg-black/70 z-[100] flex flex-col items-center justify-center text-white">
          <h2 className="text-5xl font-bold mb-4">TIMBER!</h2>
          <p className="text-xl mb-8">Final Score: {score}</p>
          <button 
            onClick={initializeGame}
            className="px-8 py-4 bg-green-500 hover:bg-green-400 rounded-xl font-bold text-2xl transition-transform active:scale-95"
          >
            TRY AGAIN
          </button>
        </div>
      )}
    </div>
  )
}

export default LumberjackGame