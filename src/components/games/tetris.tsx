"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { ArrowLeft, Play, RotateCcw, Pause, Trophy, Zap } from "lucide-react"
import Link from "next/link"
import { useGameSession } from "@/hooks/use-game-session"

const COLS = 10
const ROWS = 20
const BLOCK_SIZE = 30
const PREVIEW_BLOCK = 18

const COLORS = [
  "#00f0f0", // I - cyan
  "#0000f0", // J - blue
  "#f0a000", // L - orange
  "#f0f000", // O - yellow
  "#00f000", // S - green
  "#a000f0", // T - purple
  "#f00000", // Z - red
]

const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],                    // I
  [[1, 0, 0], [1, 1, 1]],            // J
  [[0, 0, 1], [1, 1, 1]],            // L
  [[1, 1], [1, 1]],                  // O
  [[0, 1, 1], [1, 1, 0]],            // S
  [[0, 1, 0], [1, 1, 1]],            // T
  [[1, 1, 0], [0, 1, 1]],            // Z
]

const LEVEL_SPEEDS = [
  280, 240, 200, 170, 140, 115, 90, 70, 55, 42,
  32, 25, 19, 15, 11, 8, 6, 4, 3, 2, 1,
]

// Lines needed per level (faster progression)
const LINES_PER_LEVEL = 4

// Garbage rows added after each piece at level thresholds
// At level 3+ a garbage row every 10 pieces, at 7+ every 6, at 12+ every 3
function garbageInterval(level: number): number {
  if (level >= 12) return 3
  if (level >= 7) return 6
  if (level >= 3) return 10
  return 0 // no garbage below level 3
}

interface Piece {
  shape: number[][]
  color: string
  x: number
  y: number
  type: number
}

type GameState = "idle" | "playing" | "paused" | "gameover"

function createEmptyBoard(): (string | null)[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function rotateMatrix(matrix: number[][]): number[][] {
  const rows = matrix.length
  const cols = matrix[0].length
  const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = matrix[r][c]
    }
  }
  return rotated
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * SHAPES.length)
  return {
    shape: SHAPES[type],
    color: COLORS[type],
    x: Math.floor((COLS - SHAPES[type][0].length) / 2),
    y: 0,
    type,
  }
}

export function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const boardRef = useRef<(string | null)[][]>(createEmptyBoard())
  const currentPieceRef = useRef<Piece>(randomPiece())
  const nextPieceRef = useRef<Piece>(randomPiece())
  const gameLoopRef = useRef<number>(0)
  const lastDropRef = useRef<number>(0)
  const scoreRef = useRef(0)
  const levelRef = useRef(0)
  const linesRef = useRef(0)
  const gameStateRef = useRef<GameState>("idle")
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const pieceCountRef = useRef(0)

  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(0)
  const [lines, setLines] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [gameState, setGameState] = useState<GameState>("idle")
  const [linesCleared, setLinesCleared] = useState<number[]>([])

  const { startGame, endGame } = useGameSession()

  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null)

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }, [])

  const playSound = useCallback((freq: number, duration: number, type: OscillatorType = "square") => {
    try {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {}
  }, [getAudioCtx])

  const playMoveSound = useCallback(() => playSound(200, 0.05), [playSound])
  const playRotateSound = useCallback(() => playSound(400, 0.08, "sine"), [playSound])
  const playDropSound = useCallback(() => playSound(150, 0.15), [playSound])
  const playLineClearSound = useCallback(() => {
    playSound(523, 0.1, "sine")
    setTimeout(() => playSound(659, 0.1, "sine"), 80)
    setTimeout(() => playSound(784, 0.15, "sine"), 160)
  }, [playSound])
  const playGameOverSound = useCallback(() => {
    playSound(300, 0.2, "sawtooth")
    setTimeout(() => playSound(200, 0.3, "sawtooth"), 200)
    setTimeout(() => playSound(100, 0.5, "sawtooth"), 400)
  }, [playSound])

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem("tetris-highscore")
    if (saved) setHighScore(Number(saved))
  }, [])

  const collides = useCallback((piece: Piece, board: (string | null)[][]): boolean => {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const newX = piece.x + c
          const newY = piece.y + r
          if (newX < 0 || newX >= COLS || newY >= ROWS) return true
          if (newY >= 0 && board[newY][newX]) return true
        }
      }
    }
    return false
  }, [])

  const lockPiece = useCallback(() => {
    const piece = currentPieceRef.current
    const board = boardRef.current
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const y = piece.y + r
          const x = piece.x + c
          if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
            board[y][x] = piece.color
          }
        }
      }
    }
    playDropSound()
  }, [playDropSound])

  const clearLines = useCallback(() => {
    const board = boardRef.current
    const cleared: number[] = []
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((cell) => cell !== null)) {
        cleared.push(r)
      }
    }
    if (cleared.length > 0) {
      setLinesCleared(cleared)
      playLineClearSound()

      setTimeout(() => {
        for (const row of cleared) {
          board.splice(row, 1)
          board.unshift(Array(COLS).fill(null))
        }
        setLinesCleared([])
      }, 200)

      const points = [0, 100, 300, 500, 800]
      const earnedPoints = (points[cleared.length] || 0) * (levelRef.current + 1)
      scoreRef.current += earnedPoints
      linesRef.current += cleared.length
      levelRef.current = Math.floor(linesRef.current / LINES_PER_LEVEL)

      setScore(scoreRef.current)
      setLines(linesRef.current)
      setLevel(levelRef.current)

      if (scoreRef.current > highScore) {
        setHighScore(scoreRef.current)
        localStorage.setItem("tetris-highscore", String(scoreRef.current))
      }
    }
  }, [highScore, playLineClearSound])

  const addGarbageRow = useCallback(() => {
    const board = boardRef.current
    const gap = Math.floor(Math.random() * COLS)
    const row: (string | null)[] = Array(COLS).fill("#555555")
    row[gap] = null
    board.shift() // remove top row
    board.push(row) // add garbage at bottom
  }, [])

  const spawnPiece = useCallback(() => {
    currentPieceRef.current = nextPieceRef.current
    nextPieceRef.current = randomPiece()

    // Garbage row mechanic
    pieceCountRef.current++
    const interval = garbageInterval(levelRef.current)
    if (interval > 0 && pieceCountRef.current % interval === 0) {
      addGarbageRow()
    }

    if (collides(currentPieceRef.current, boardRef.current)) {
      gameStateRef.current = "gameover"
      setGameState("gameover")
      playGameOverSound()
      endGame()
    }
  }, [collides, endGame, playGameOverSound, addGarbageRow])

  const moveDown = useCallback(() => {
    const piece = currentPieceRef.current
    const moved = { ...piece, y: piece.y + 1 }
    if (!collides(moved, boardRef.current)) {
      currentPieceRef.current = moved
    } else {
      lockPiece()
      clearLines()
      spawnPiece()
    }
  }, [collides, lockPiece, clearLines, spawnPiece])

  const moveLeft = useCallback(() => {
    const piece = currentPieceRef.current
    const moved = { ...piece, x: piece.x - 1 }
    if (!collides(moved, boardRef.current)) {
      currentPieceRef.current = moved
      playMoveSound()
    }
  }, [collides, playMoveSound])

  const moveRight = useCallback(() => {
    const piece = currentPieceRef.current
    const moved = { ...piece, x: piece.x + 1 }
    if (!collides(moved, boardRef.current)) {
      currentPieceRef.current = moved
      playMoveSound()
    }
  }, [collides, playMoveSound])

  const rotate = useCallback(() => {
    const piece = currentPieceRef.current
    const rotated = { ...piece, shape: rotateMatrix(piece.shape) }
    // Wall kick: try offsets if rotation collides
    const kicks = [0, -1, 1, -2, 2]
    for (const offset of kicks) {
      const kicked = { ...rotated, x: rotated.x + offset }
      if (!collides(kicked, boardRef.current)) {
        currentPieceRef.current = kicked
        playRotateSound()
        return
      }
    }
  }, [collides, playRotateSound])

  const hardDrop = useCallback(() => {
    const piece = currentPieceRef.current
    let dropY = piece.y
    while (!collides({ ...piece, y: dropY + 1 }, boardRef.current)) {
      dropY++
    }
    scoreRef.current += (dropY - piece.y) * 2
    setScore(scoreRef.current)
    currentPieceRef.current = { ...piece, y: dropY }
    lockPiece()
    clearLines()
    spawnPiece()
  }, [collides, lockPiece, clearLines, spawnPiece])

  const getGhostY = useCallback((): number => {
    const piece = currentPieceRef.current
    let ghostY = piece.y
    while (!collides({ ...piece, y: ghostY + 1 }, boardRef.current)) {
      ghostY++
    }
    return ghostY
  }, [collides])

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = COLS * BLOCK_SIZE
    const h = ROWS * BLOCK_SIZE

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.scale(dpr, dpr)
    }

    // Background
    ctx.fillStyle = "#0a0a1a"
    ctx.fillRect(0, 0, w, h)

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)"
    ctx.lineWidth = 0.5
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * BLOCK_SIZE)
      ctx.lineTo(w, r * BLOCK_SIZE)
      ctx.stroke()
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath()
      ctx.moveTo(c * BLOCK_SIZE, 0)
      ctx.lineTo(c * BLOCK_SIZE, h)
      ctx.stroke()
    }

    // Board cells
    const board = boardRef.current
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          const isClearing = linesCleared.includes(r)
          drawBlock(ctx, c, r, board[r][c]!, isClearing)
        }
      }
    }

    if (gameStateRef.current === "playing" || gameStateRef.current === "paused") {
      const piece = currentPieceRef.current

      // Ghost piece
      const ghostY = getGhostY()
      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (piece.shape[r][c]) {
            const x = (piece.x + c) * BLOCK_SIZE
            const y = (ghostY + r) * BLOCK_SIZE
            ctx.strokeStyle = `${piece.color}40`
            ctx.lineWidth = 1.5
            ctx.strokeRect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2)
          }
        }
      }

      // Current piece
      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (piece.shape[r][c]) {
            drawBlock(ctx, piece.x + c, piece.y + r, piece.color, false)
          }
        }
      }
    }

    // Draw preview
    drawPreview()
  }, [getGhostY, linesCleared])

  const drawBlock = (
    ctx: CanvasRenderingContext2D,
    col: number,
    row: number,
    color: string,
    flashing: boolean
  ) => {
    const x = col * BLOCK_SIZE
    const y = row * BLOCK_SIZE
    const s = BLOCK_SIZE

    if (flashing) {
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(x, y, s, s)
      return
    }

    // Fill
    ctx.fillStyle = color
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2)

    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.25)"
    ctx.fillRect(x + 1, y + 1, s - 2, 3)
    ctx.fillRect(x + 1, y + 1, 3, s - 2)

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)"
    ctx.fillRect(x + 1, y + s - 4, s - 2, 3)
    ctx.fillRect(x + s - 4, y + 1, 3, s - 2)
  }

  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = 4 * PREVIEW_BLOCK
    const h = 4 * PREVIEW_BLOCK

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.scale(dpr, dpr)
    }

    ctx.fillStyle = "#0a0a1a"
    ctx.fillRect(0, 0, w, h)

    const next = nextPieceRef.current
    const offsetX = Math.floor((4 - next.shape[0].length) / 2)
    const offsetY = Math.floor((4 - next.shape.length) / 2)

    for (let r = 0; r < next.shape.length; r++) {
      for (let c = 0; c < next.shape[r].length; c++) {
        if (next.shape[r][c]) {
          const x = (offsetX + c) * PREVIEW_BLOCK
          const y = (offsetY + r) * PREVIEW_BLOCK
          ctx.fillStyle = next.color
          ctx.fillRect(x + 1, y + 1, PREVIEW_BLOCK - 2, PREVIEW_BLOCK - 2)
          ctx.fillStyle = "rgba(255,255,255,0.2)"
          ctx.fillRect(x + 1, y + 1, PREVIEW_BLOCK - 2, 2)
        }
      }
    }
  }, [])

  // Game loop
  const gameLoop = useCallback(
    (timestamp: number) => {
      if (gameStateRef.current !== "playing") {
        draw()
        if (gameStateRef.current !== "gameover" && gameStateRef.current !== "idle") {
          gameLoopRef.current = requestAnimationFrame(gameLoop)
        }
        return
      }

      const speed = LEVEL_SPEEDS[Math.min(levelRef.current, LEVEL_SPEEDS.length - 1)]
      if (timestamp - lastDropRef.current > speed) {
        moveDown()
        lastDropRef.current = timestamp
      }

      draw()
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    },
    [draw, moveDown]
  )

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameStateRef.current !== "playing") return
      switch (e.key) {
        case "ArrowLeft":
        case "a":
          e.preventDefault()
          moveLeft()
          break
        case "ArrowRight":
        case "d":
          e.preventDefault()
          moveRight()
          break
        case "ArrowDown":
        case "s":
          e.preventDefault()
          moveDown()
          scoreRef.current += 1
          setScore(scoreRef.current)
          break
        case "ArrowUp":
        case "w":
          e.preventDefault()
          rotate()
          break
        case " ":
          e.preventDefault()
          hardDrop()
          break
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [moveLeft, moveRight, moveDown, rotate, hardDrop])

  // Touch controls
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleTouchStart = (e: TouchEvent) => {
      if (gameStateRef.current !== "playing") return
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (gameStateRef.current !== "playing" || !touchStartRef.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      const dt = Date.now() - touchStartRef.current.time

      const threshold = 30

      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold && dt < 200) {
        // Tap = rotate
        rotate()
      } else if (Math.abs(dy) > Math.abs(dx) && dy > threshold) {
        // Swipe down = hard drop
        hardDrop()
      } else if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > threshold) moveRight()
        else if (dx < -threshold) moveLeft()
      }

      touchStartRef.current = null
    }

    canvas.addEventListener("touchstart", handleTouchStart, { passive: true })
    canvas.addEventListener("touchend", handleTouchEnd, { passive: true })
    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart)
      canvas.removeEventListener("touchend", handleTouchEnd)
    }
  }, [rotate, hardDrop, moveRight, moveLeft])

  const startNewGame = useCallback(() => {
    boardRef.current = createEmptyBoard()
    currentPieceRef.current = randomPiece()
    nextPieceRef.current = randomPiece()
    scoreRef.current = 0
    levelRef.current = 0
    linesRef.current = 0
    lastDropRef.current = 0
    pieceCountRef.current = 0
    setScore(0)
    setLevel(0)
    setLines(0)
    setLinesCleared([])
    gameStateRef.current = "playing"
    setGameState("playing")
    startGame("tetris")
    cancelAnimationFrame(gameLoopRef.current)
    gameLoopRef.current = requestAnimationFrame(gameLoop)
  }, [gameLoop, startGame])

  const togglePause = useCallback(() => {
    if (gameStateRef.current === "playing") {
      gameStateRef.current = "paused"
      setGameState("paused")
    } else if (gameStateRef.current === "paused") {
      gameStateRef.current = "playing"
      setGameState("playing")
      lastDropRef.current = performance.now()
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }
  }, [gameLoop])

  // Cleanup
  useEffect(() => {
    return () => cancelAnimationFrame(gameLoopRef.current)
  }, [])

  // Initial draw
  useEffect(() => {
    draw()
  }, [draw])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-lg px-4 pt-4 pb-2 flex items-center justify-between">
        <Link href="/" className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold text-white tracking-wider">TETRIS</h1>
        {gameState === "playing" || gameState === "paused" ? (
          <button onClick={togglePause} className="text-white/60 hover:text-white transition-colors" type="button">
            <Pause className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-6" />
        )}
      </div>

      {/* Stats bar */}
      <div className="w-full max-w-lg px-4 pb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-yellow-400 font-mono">{highScore}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-400 font-mono">Lvl {level}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/60 font-mono">Lines: {lines}</span>
          <span className="text-white font-bold font-mono">{score}</span>
        </div>
      </div>

      {/* Game area */}
      <div className="flex gap-3 items-start px-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="border border-white/10 rounded-lg"
            style={{ width: COLS * BLOCK_SIZE, height: ROWS * BLOCK_SIZE, touchAction: "none" }}
          />

          {/* Overlays */}
          {gameState === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg">
              <div className="text-6xl mb-4">🧱</div>
              <h2 className="text-2xl font-bold text-white mb-2">TETRIS</h2>
              <p className="text-white/60 text-sm mb-6 text-center px-4">
                Arrows / WASD to move & rotate
                <br />
                Space to hard drop
                <br />
                Tap / swipe on mobile
              </p>
              <button
                onClick={startNewGame}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors"
                type="button"
              >
                <Play className="w-5 h-5" /> Start Game
              </button>
            </div>
          )}

          {gameState === "paused" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg">
              <Pause className="w-12 h-12 text-white mb-3" />
              <h2 className="text-2xl font-bold text-white mb-4">PAUSED</h2>
              <button
                onClick={togglePause}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors"
                type="button"
              >
                <Play className="w-5 h-5" /> Resume
              </button>
            </div>
          )}

          {gameState === "gameover" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-lg">
              <div className="text-5xl mb-3">💥</div>
              <h2 className="text-2xl font-bold text-red-400 mb-1">GAME OVER</h2>
              <p className="text-white/60 text-sm mb-1">Score: {score}</p>
              <p className="text-white/60 text-sm mb-1">Level: {level}</p>
              <p className="text-white/60 text-sm mb-4">Lines: {lines}</p>
              {score >= highScore && score > 0 && (
                <p className="text-yellow-400 text-sm font-bold mb-3">🏆 New High Score!</p>
              )}
              <button
                onClick={startNewGame}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition-colors"
                type="button"
              >
                <RotateCcw className="w-5 h-5" /> Play Again
              </button>
            </div>
          )}
        </div>

        {/* Side panel - Next piece */}
        <div className="flex flex-col gap-2">
          <div className="text-[10px] text-white/40 uppercase tracking-wider text-center">Next</div>
          <canvas
            ref={previewCanvasRef}
            className="border border-white/10 rounded-lg"
            style={{ width: 4 * PREVIEW_BLOCK, height: 4 * PREVIEW_BLOCK }}
          />
        </div>
      </div>

      {/* Mobile controls */}
      <div className="w-full max-w-lg px-4 py-4 md:hidden">
        <div className="grid grid-cols-5 gap-2">
          <button
            onTouchStart={(e) => { e.preventDefault(); moveLeft() }}
            className="col-span-1 h-14 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center text-white text-lg font-bold"
            type="button"
          >
            ◀
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); rotate() }}
            className="col-span-1 h-14 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center text-white text-lg font-bold"
            type="button"
          >
            ↻
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); hardDrop() }}
            className="col-span-1 h-14 rounded-lg bg-cyan-500/30 active:bg-cyan-500/50 flex items-center justify-center text-white text-lg font-bold"
            type="button"
          >
            ⤓
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); moveDown(); scoreRef.current += 1; setScore(scoreRef.current) }}
            className="col-span-1 h-14 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center text-white text-lg font-bold"
            type="button"
          >
            ▼
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); moveRight() }}
            className="col-span-1 h-14 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center text-white text-lg font-bold"
            type="button"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  )
}
