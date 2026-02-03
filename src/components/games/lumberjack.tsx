"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"

const VISIBLE_SEGMENTS = 10
const SEGMENT_HEIGHT = 90 
const CUTS_PER_TRUNK = 6
const INITIAL_TIME = 100 
const TIME_DECREASE_RATE = 0.25 
const TIME_REGAIN_PER_CUT = 4 

const ASSETS = {
  branch: "/lumberjack/images/branch.svg",
  log: "/lumberjack/images/log.svg",
  groundLeft: "/lumberjack/images/ground_left.svg",
  groundRight: "/lumberjack/images/ground_right.svg",
  lumberjack: "/lumberjack/images/lumber_body.svg",
  died: "/lumberjack/images/lumber_died.svg",
  hand_up: "/lumberjack/images/hand_up.svg",
  hand_down: "/lumberjack/images/hand_down.svg",
  leftArrow: "/lumberjack/images/left.png",
  rightArrow: "/lumberjack/images/right.png",
  clouds: "/lumberjack/images/bg_clouds.svg",
  trees: "/lumberjack/images/bg_trees.svg",
  trunk: "/lumberjack/images/trunk.svg",
  stones: "/lumberjack/images/stones.svg",
  stumb: "/lumberjack/images/stumb.svg",
  refresh: "/lumberjack/images/refresh.png",
}

type Side = "left" | "right" | "none"

interface GameSegment {
  id: number
  side: Side
}

interface FallingBranch {
  id: number
  side: Side
}

export function LumberjackGame() {
  const [gameStatus, setGameStatus] = useState<"playing" | "game-over">("playing")
  const [segments, setSegments] = useState<GameSegment[]>([])
  const [playerSide, setPlayerSide] = useState<"left" | "right">("right")
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME)
  const [fallingBranches, setFallingBranches] = useState<FallingBranch[]>([])
  const [isChopping, setIsChopping] = useState(false)
  
  const segmentIdCounter = useRef(0)
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({})
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    audioRefs.current["hit1"] = new Audio("/lumberjack/sounds/hit1.mp3")
    audioRefs.current["hit2"] = new Audio("/lumberjack/sounds/hit2.mp3")
    audioRefs.current["hit3"] = new Audio("/lumberjack/sounds/hit3.mp3")
    initializeGame()
    return () => stopTimer()
  }, [])

  useEffect(() => {
    if (gameStatus === "playing") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0) {
            handleGameOver()
            return 0
          }
          return prev - TIME_DECREASE_RATE
        })
      }, 50)
    } else {
      stopTimer()
    }
    return () => stopTimer()
  }, [gameStatus])

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleGameOver = () => {
    playSound("hit3")
    setGameStatus("game-over")
  }

  const playSound = (key: string) => {
    const sound = audioRefs.current[key]
    if (sound) {
      sound.currentTime = 0
      sound.play().catch(() => {})
    }
  }

  const createSegment = (currentSegments: GameSegment[], forceNone = false): GameSegment => {
    const id = segmentIdCounter.current++
    let side: Side = "none"
    if (!forceNone) {
      const lastSegment = currentSegments[currentSegments.length - 1]
      if (!lastSegment || lastSegment.side === "none") {
        const rand = Math.random()
        side = rand < 0.5 ? "left" : "right"
      }
    }
    return { id, side }
  }

  const initializeGame = () => {
    segmentIdCounter.current = 0
    let initial: GameSegment[] = []
    for (let i = 0; i < VISIBLE_SEGMENTS; i++) {
      initial.push(createSegment(initial, i < 5))
    }
    setSegments(initial)
    setScore(0)
    setTimeLeft(INITIAL_TIME)
    setFallingBranches([])
    setGameStatus("playing")
    setIsChopping(false)
  }

  const handleChop = useCallback((side: "left" | "right") => {
    if (gameStatus !== "playing") return

    setPlayerSide(side)
    setIsChopping(true)
    setTimeout(() => setIsChopping(false), 150)

    const targetSegment = segments[1] 
    const nextBranchSegment = segments[2]

    if (nextBranchSegment && nextBranchSegment.side === side) {
      handleGameOver()
      return
    }

    playSound(side === "left" ? "hit1" : "hit2")
    
    if (targetSegment.side !== "none") {
      const newFalling = { id: targetSegment.id, side: targetSegment.side }
      setFallingBranches(prev => [...prev, newFalling])
      setTimeout(() => {
        setFallingBranches(prev => prev.filter(b => b.id !== newFalling.id))
      }, 600)
    }

    setScore(s => s + 1)
    setTimeLeft(prev => Math.min(INITIAL_TIME, prev + TIME_REGAIN_PER_CUT))
    
    setSegments(prev => {
      const nextArr = [prev[0], ...prev.slice(2)]
      nextArr.push(createSegment(nextArr))
      return nextArr
    })
  }, [gameStatus, segments])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleChop("left")
      if (e.key === "ArrowRight") handleChop("right")
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleChop])

  return (
    <div className="fixed inset-0 bg-sky-200 flex flex-col items-center justify-between overflow-hidden select-none">
      <style>{`
        @keyframes branch-fly-left {
          0% { transform: translateX(0) translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateX(-400px) translateY(150px) rotate(-90deg); opacity: 0; }
        }
        @keyframes branch-fly-right {
          0% { transform: translateX(0) translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateX(400px) translateY(150px) rotate(90deg); opacity: 0; }
        }
        .animate-fall-left { animation: branch-fly-left 0.6s ease-out forwards; }
        .animate-fall-right { animation: branch-fly-right 0.6s ease-out forwards; }
      `}</style>

      {/* TOP REGION */}
      <div className="relative w-full h-1/4 flex flex-col items-center pt-10 z-50">
        <img src={ASSETS.clouds} className="absolute top-10 opacity-50 w-full" alt="" />
        
        <div className="relative w-64 h-8 border-4 border-[#5D2E0C] bg-[#F3E5AB] rounded-full overflow-hidden mb-4">
          <div 
            className="h-full transition-all duration-100" 
            style={{ 
              width: `${timeLeft}%`, 
              backgroundColor: timeLeft > 35 ? "#4ade80" : "#ef4444" 
            }} 
          />
        </div>

        <div className="text-7xl font-black text-white drop-shadow-lg">
          {score}
        </div>
      </div>

      {/* MIDDLE REGION (The Tree) */}
      <div className="relative w-full flex-1 flex justify-center">
        {/* Full-height Trunk Container */}
        <div 
          className="absolute bottom-0 mx-auto w-[80px] z-0"
          style={{ 
            height: '200vh', // Ensure it extends far above the screen
            backgroundImage: `url(${ASSETS.trunk})`,
            backgroundSize: `80px ${SEGMENT_HEIGHT * CUTS_PER_TRUNK}px`,
            backgroundPosition: `center ${score * SEGMENT_HEIGHT}px`,
            backgroundRepeat: 'repeat-y'
          }}
        />

        <div className="relative w-64 h-full z-10">
          <div className="absolute bottom-0 w-full flex flex-col-reverse items-center">
            {segments.map((seg) => (
              <div key={seg.id} className="relative w-full" style={{ height: SEGMENT_HEIGHT }}>
                {seg.side !== "none" && (
                  <img 
                    src={ASSETS.branch} 
                    className={`absolute bottom-2 w-48 transition-all duration-100 ${
                      seg.side === "left" ? "right-[60%] scale-x-[-1]" : "left-[60%]"
                    }`}
                    alt="branch"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="absolute bottom-[90px] w-full h-full pointer-events-none">
            {fallingBranches.map(fb => (
              <img 
                key={fb.id}
                src={ASSETS.branch} 
                className={`absolute bottom-2 w-48 ${
                  fb.side === "left" ? "right-[60%] scale-x-[-1] animate-fall-left" : "left-[60%] animate-fall-right"
                }`}
                alt=""
              />
            ))}
          </div>

          <div 
            className="absolute bottom-0 transition-all duration-75 z-30"
            style={{ 
              left: '50%',
              transform: playerSide === "left" ? "translateX(-160px)" : "translateX(60px)",
              width: 100
            }}
          >
            <div className="relative">
              <img 
                src={gameStatus === "playing" ? ASSETS.lumberjack : ASSETS.died} 
                className={`w-28 relative z-10 ${playerSide === 'left' ? 'scale-x-[-1]' : ''}`} 
                alt="body" 
              />
              {gameStatus === "playing" && (
                <img 
                  src={isChopping ? ASSETS.hand_down : ASSETS.hand_up}
                  className={`absolute z-20 w-16 h-16 transition-transform ${
                    playerSide === 'left' ? 'scale-x-[-1]' : ''
                  }`}
                  style={{
                    top: isChopping ? '40px' : '5px',
                    ...(playerSide === 'left' ? { right: '0px' } : { left: '0px' })
                  }}
                  alt="hand"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM REGION */}
      <div className="relative w-full h-1/4 flex flex-col items-center justify-end pb-10 z-50">
        <img src={ASSETS.trees} className="absolute bottom-32 opacity-30 w-full pointer-events-none" alt="" />
        
        <div className="relative mb-20">
           <img src={ASSETS.stones} className="w-24 z-20" alt="stones" />
        </div>

        <div className="flex gap-24">
          <button onMouseDown={() => handleChop("left")} className="active:scale-90 transition-transform">
            <img src={ASSETS.leftArrow} className="w-24" alt="Left" />
          </button>
          <button onMouseDown={() => handleChop("right")} className="active:scale-90 transition-transform">
            <img src={ASSETS.rightArrow} className="w-24" alt="Right" />
          </button>
        </div>

        <div className="absolute bottom-0 w-full h-32 flex justify-between items-end px-4 pointer-events-none">
          <img src={ASSETS.groundLeft} className="h-24" alt="" />
          <img src={ASSETS.groundRight} className="h-24" alt="" />
        </div>
      </div>

      {gameStatus === "game-over" && (
        <div className="absolute inset-0 bg-black/60 z-[100] flex flex-col items-center justify-center">
          <div className="bg-white p-10 rounded-3xl text-center shadow-2xl">
            <h2 className="text-4xl font-black text-red-600 mb-4">TIMBER!</h2>
            <p className="text-2xl text-gray-700 mb-6 font-bold">Score: {score}</p>
            <button onClick={initializeGame} className="bg-[#eab87d] p-4 rounded-full active:scale-90">
              <img src={ASSETS.refresh} className="w-12 h-12" alt="Restart" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LumberjackGame