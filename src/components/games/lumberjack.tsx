"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"

const VISIBLE_SEGMENTS = 10
const SEGMENT_HEIGHT = 90 
const CUTS_PER_TRUNK = 6
const INITIAL_TIME = 75 
const BASE_TIME_DECREASE_RATE = 0.22
const MAX_TIME_DECREASE_RATE = 0.60
const TIME_REGAIN_PER_CUT = 2.5
const FAST_PLAY_BONUS_SLOWDOWN = 0.04 // How much to slow down timer when playing fast
const FAST_PLAY_THRESHOLD_CUTS = 12 // Number of cuts to check for fast play
const FAST_PLAY_WINDOW_MS = 900 // 0.9 second window for fast play detection 

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
  const [timeDecreaseRate, setTimeDecreaseRate] = useState(BASE_TIME_DECREASE_RATE)
  
  const segmentIdCounter = useRef(0)
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({})
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const cutTimestamps = useRef<number[]>([])

  // Sound paths for creating new instances
  const SOUND_PATHS: { [key: string]: string } = {
    hit1: "/lumberjack/sounds/hit1.mp3",
    hit2: "/lumberjack/sounds/hit2.mp3",
    hit3: "/lumberjack/sounds/hit3.mp3",
    bonus: "/lumberjack/sounds/bonus.mp3",
  }

  useEffect(() => {
    // Preload sounds
    Object.entries(SOUND_PATHS).forEach(([key, path]) => {
      audioRefs.current[key] = new Audio(path)
    })
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
          return prev - timeDecreaseRate
        })
      }, 50)
    } else {
      stopTimer()
    }
    return () => stopTimer()
  }, [gameStatus, timeDecreaseRate])

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleGameOver = () => {
    playSound("hit3")
    setGameStatus("game-over")
  }

  const playSound = (key: string, allowOverlap = false) => {
    const path = SOUND_PATHS[key]
    if (!path) return
    
    if (allowOverlap) {
      // Create a new Audio instance so sounds can overlap
      const sound = new Audio(path)
      sound.play().catch(() => {})
    } else {
      // Reuse existing instance (will restart if already playing)
      const sound = audioRefs.current[key]
      if (sound) {
        sound.currentTime = 0
        sound.play().catch(() => {})
      }
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
    setTimeDecreaseRate(BASE_TIME_DECREASE_RATE)
    cutTimestamps.current = []
  }

  const handleChop = useCallback((side: "left" | "right") => {
    if (gameStatus !== "playing") return

    setPlayerSide(side)
    setIsChopping(true)
    setTimeout(() => setIsChopping(false), 150)

    const targetSegment = segments[1] 
    const nextSegment = segments[2]

    // If there's a branch on the same side as the player, they get hit and die
    if (targetSegment && targetSegment.side === side) {
      handleGameOver()
      return
    }

    // After cutting, the next segment falls down - if it has a branch on player's side, they die
    if (nextSegment && nextSegment.side === side) {
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

    // Track cut timestamps for fast-play detection
    const now = Date.now()
    cutTimestamps.current.push(now)
    
    // Keep only cuts within the fast-play window (4 seconds)
    cutTimestamps.current = cutTimestamps.current.filter(t => now - t < FAST_PLAY_WINDOW_MS)
    
    setScore(s => {
      const newScore = s + 1
      
      // Calculate progressive difficulty: timer gets faster with score
      // Increases from 0.25 to 0.6 over ~100 points
      const progressiveDifficulty = Math.min(
        MAX_TIME_DECREASE_RATE,
        BASE_TIME_DECREASE_RATE + (newScore * 0.0035)
      )
      
      // Check for fast play reward: if player got FAST_PLAY_THRESHOLD_CUTS cuts within the time window
      const isFastPlay = cutTimestamps.current.length >= FAST_PLAY_THRESHOLD_CUTS
      
      // Play bonus sound when fast play is achieved (with overlap so it doesn't get cut off)
      if (isFastPlay) {
        playSound("bonus", true)
        // Reset timestamps so player needs to earn the bonus again
        cutTimestamps.current = []
      }
      
      // Apply fast-play bonus (slight slowdown reward)
      const finalRate = isFastPlay 
        ? Math.max(BASE_TIME_DECREASE_RATE, progressiveDifficulty - FAST_PLAY_BONUS_SLOWDOWN)
        : progressiveDifficulty
      
      setTimeDecreaseRate(finalRate)
      
      return newScore
    })
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
    <div className="fixed inset-0 bg-gray-800 flex flex-col items-center justify-center overflow-hidden select-none">
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
        
        @keyframes clouds-scroll-slow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes clouds-scroll-fast {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-clouds-slow {
          animation: clouds-scroll-slow 45s linear infinite;
        }
        .animate-clouds-fast {
          animation: clouds-scroll-fast 20s linear infinite;
        }
      `}</style>

      {/* Game Card */}
      <div className="relative z-10 w-full max-w-[420px] bg-sky-200 overflow-hidden flex-1 max-h-[75vh]" style={{ minHeight: 0 }}>
        {/* Clouds - slow layer */}
        <div className="absolute top-0 left-0 w-full h-40 overflow-hidden opacity-40 z-0">
          <div className="animate-clouds-slow flex h-full" style={{ width: '200%' }}>
            <div 
              className="h-full w-1/2"
              style={{
                backgroundImage: `url(${ASSETS.clouds})`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: 'auto 100%',
                backgroundPosition: 'left center',
              }}
            />
            <div 
              className="h-full w-1/2"
              style={{
                backgroundImage: `url(${ASSETS.clouds})`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: 'auto 100%',
                backgroundPosition: 'left center',
              }}
            />
          </div>
        </div>
        
        {/* Clouds - fast layer */}
        <div className="absolute top-8 left-0 w-full h-32 overflow-hidden opacity-50 z-0">
          <div className="animate-clouds-fast flex h-full" style={{ width: '200%' }}>
            <div 
              className="h-full w-1/2"
              style={{
                backgroundImage: `url(${ASSETS.clouds})`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: 'auto 70%',
                backgroundPosition: 'left center',
              }}
            />
            <div 
              className="h-full w-1/2"
              style={{
                backgroundImage: `url(${ASSETS.clouds})`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: 'auto 70%',
                backgroundPosition: 'left center',
              }}
            />
          </div>
        </div>

        {/* Background trees (subtle) */}
        <img src={ASSETS.trees} className="absolute bottom-16 opacity-20 w-full pointer-events-none z-0" alt="" />

        {/* Timer bar */}
        <div className="relative z-30 flex flex-col items-center pt-3 px-4">
          <div className="w-28 h-4 border-3 border-[#82643a] bg-[#F3E5AB] rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-100" 
              style={{ 
                width: `${timeLeft}%`, 
                backgroundColor: timeLeft > 35 ? "#4ade80" : "#ef4444" 
              }} 
            />
          </div>
          <div className="text-3xl font-black text-white drop-shadow-lg mt-1">
            {score}
          </div>
        </div>

        {/* Tree area */}
        <div className="absolute inset-0 top-24 flex justify-center z-10">
          {/* Trunk */}
          <div 
            className="absolute bottom-0 w-[70px] z-20"
            style={{ 
              height: '150%',
              backgroundImage: `url(${ASSETS.trunk})`,
              backgroundSize: `50px`,
              backgroundPosition: `center ${score * SEGMENT_HEIGHT}px`,
              backgroundRepeat: 'repeat-y',
              maskImage: 'linear-gradient(to top, transparent 45px, black 45px)',
              WebkitMaskImage: 'linear-gradient(to top, transparent 45px, black 45px)',
            }}
          />

          {/* Ground island */}
          <div className="absolute bottom-[-0px] left-0 right-0 flex items-end z-10 pointer-events-none">
            <img src={ASSETS.groundLeft} className="h-24 w-1/2 object-cover object-right" alt="" />
            <img src={ASSETS.groundRight} className="h-24 w-1/2 object-cover object-left" alt="" />
          </div>

          {/* Stones */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <img src={ASSETS.stones} className="w-16" alt="" />
          </div>

          {/* Branches */}
          <div className="relative w-48 h-full z-[5]">
            <div className="absolute bottom-0 w-full flex flex-col-reverse items-center">
              {segments.map((seg) => (
                <div key={seg.id} className="relative w-full" style={{ height: SEGMENT_HEIGHT }}>
                  {seg.side !== "none" && (
                    <img 
                      src={ASSETS.branch} 
                      className={`absolute bottom-2 w-32 transition-all duration-100 ${
                        seg.side === "left" ? "right-[55%] scale-x-[-1]" : "left-[55%]"
                      }`}
                      alt="branch"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Falling branches */}
            <div className="absolute bottom-[90px] w-full h-full pointer-events-none">
              {fallingBranches.map(fb => (
                <img 
                  key={fb.id}
                  src={ASSETS.branch} 
                  className={`absolute bottom-2 w-28 ${
                    fb.side === "left" ? "right-[60%] animate-fall-left" : "left-[60%] animate-fall-right"
                  }`}
                  alt=""
                />
              ))}
            </div>
          </div>

          {/* Lumberjack */}
          <div 
            className="absolute bottom-[60] transition-all duration-75 z-40"
            style={{ 
              left: '50%',
              transform: playerSide === "left" ? "translateX(-120px)" : "translateX(45px)",
              width: 55
            }}
          >
            <div className="relative">
              <img 
                src={gameStatus === "playing" ? ASSETS.lumberjack : ASSETS.died} 
                className={`w-16 relative z-10 ${playerSide === 'left' ? 'scale-x-[-1]' : ''}`} 
                alt="body" 
              />
              {gameStatus === "playing" && (
                <img 
                  src={isChopping ? ASSETS.hand_down : ASSETS.hand_up}
                  className={`absolute z-20 w-11 h-11 transition-transform ${
                    playerSide === 'left' ? 'scale-x-[-1]' : ''
                  }`}
                  style={{
                    top: isChopping ? '30px' : '2px',
                    ...(isChopping
                      ? (playerSide === 'right' ? { left: '-14px' } : { right: '-14px' })
                      : (playerSide === 'right' ? { right: '-14px' } : { left: '-14px' })
                    )
                  }}
                  alt="hand"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls (below game card) */}
      <div className="relative z-0 w-full max-w-[420px] flex justify-center items-center gap-20 bg-white" style={{ height: '25vh' }}>
        <button onMouseDown={() => handleChop("left")} className="active:scale-90 transition-transform">
          <img src={ASSETS.leftArrow} className="w-20" alt="Left" />
        </button>
        <button onMouseDown={() => handleChop("right")} className="active:scale-90 transition-transform">
          <img src={ASSETS.rightArrow} className="w-20" alt="Right" />
        </button>
      </div>

      {gameStatus === "game-over" && (
        <div className="absolute inset-0 bg-black/70 z-[100] flex flex-col items-center justify-center">
          <style>{`
            @keyframes bounce-in {
              0% { transform: scale(0) rotate(-10deg); opacity: 0; }
              50% { transform: scale(1.1) rotate(3deg); }
              70% { transform: scale(0.95) rotate(-2deg); }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              20% { transform: translateX(-8px) rotate(-2deg); }
              40% { transform: translateX(8px) rotate(2deg); }
              60% { transform: translateX(-6px) rotate(-1deg); }
              80% { transform: translateX(6px) rotate(1deg); }
            }
            @keyframes pulse-glow {
              0%, 100% { box-shadow: 0 0 20px rgba(234, 184, 125, 0.5), 0 0 40px rgba(234, 184, 125, 0.3); }
              50% { box-shadow: 0 0 30px rgba(234, 184, 125, 0.8), 0 0 60px rgba(234, 184, 125, 0.5); }
            }
            @keyframes float {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }
            @keyframes star-spin {
              0% { transform: rotate(0deg) scale(1); }
              50% { transform: rotate(180deg) scale(1.2); }
              100% { transform: rotate(360deg) scale(1); }
            }
            .animate-bounce-in { animation: bounce-in 0.6s ease-out forwards; }
            .animate-shake { animation: shake 0.5s ease-in-out; }
            .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
            .animate-float { animation: float 3s ease-in-out infinite; }
            .animate-star-spin { animation: star-spin 3s linear infinite; }
          `}</style>
          
          <div className="animate-bounce-in relative">
            {/* Decorative stars/sparkles */}
            <div className="absolute -top-8 -left-8 text-4xl animate-star-spin">⭐</div>
            <div className="absolute -top-6 -right-10 text-3xl animate-star-spin" style={{ animationDelay: '0.5s' }}>✨</div>
            <div className="absolute -bottom-6 -left-6 text-2xl animate-star-spin" style={{ animationDelay: '1s' }}>⭐</div>
            <div className="absolute -bottom-8 -right-8 text-3xl animate-star-spin" style={{ animationDelay: '1.5s' }}>✨</div>
            
            <div 
              className="bg-gradient-to-b from-amber-100 to-amber-200 p-8 rounded-3xl text-center shadow-2xl border-4 border-amber-600 animate-pulse-glow"
              style={{ minWidth: '280px' }}
            >
              {/* Wooden plank header */}
              <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 -mt-14 mx-auto px-8 py-3 rounded-xl shadow-lg border-2 border-amber-800 mb-4" style={{ width: 'fit-content' }}>
                <h2 className="text-3xl font-black text-white drop-shadow-lg tracking-wider animate-shake" style={{ textShadow: '2px 2px 0 #92400e' }}>
                  🪓 TIMBER! 🪓
                </h2>
              </div>
              
              {/* Score display */}
              <div className="bg-white/80 rounded-2xl p-4 mb-6 shadow-inner border-2 border-amber-300">
                <p className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-1">Your Score</p>
                <p className="text-6xl font-black text-amber-800 animate-float" style={{ textShadow: '3px 3px 0 #fcd34d' }}>
                  {score}
                </p>
                {score >= 50 && <p className="text-lg font-bold text-green-600 mt-2">🏆 Amazing!</p>}
                {score >= 25 && score < 50 && <p className="text-lg font-bold text-blue-600 mt-2">👏 Great job!</p>}
                {score < 25 && <p className="text-lg font-bold text-gray-600 mt-2">Keep practicing!</p>}
              </div>
              
              {/* Play again button */}
              <button 
                onClick={initializeGame} 
                className="group relative bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 px-8 py-4 rounded-2xl active:scale-95 transition-all duration-150 shadow-lg hover:shadow-xl border-b-4 border-green-800 hover:border-green-900"
              >
                <div className="flex items-center gap-3">
                  <img src={ASSETS.refresh} className="w-8 h-8 group-hover:rotate-180 transition-transform duration-500" alt="" />
                  <span className="text-xl font-black text-white drop-shadow-md">PLAY AGAIN</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LumberjackGame