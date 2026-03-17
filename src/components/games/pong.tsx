"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"

type Difficulty = "easy" | "medium" | "hard"
type GameState = "menu" | "playing" | "paused" | "scored" | "gameover"

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

interface Paddle {
  x: number
  y: number
  width: number
  height: number
  vy: number
}

interface GlowParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  life: number
  maxLife: number
  color: string
}

interface TrailPoint {
  x: number
  y: number
  alpha: number
}

const WINNING_SCORE = 7
const BALL_RADIUS = 10
const PADDLE_WIDTH = 14
const PADDLE_HEIGHT = 90
const PADDLE_MARGIN = 30
const BALL_SPEED_INITIAL = 8
const BALL_SPEED_INCREMENT = 0.6
const BALL_MAX_SPEED = 22
const PADDLE_SPEED = 9

const DIFFICULTY_CONFIG = {
  easy: { speed: 5.5, reaction: 0.07, error: 30, predict: 5, label: "Easy", color: "#00ff88" },
  medium: { speed: 8.5, reaction: 0.14, error: 8, predict: 10, label: "Medium", color: "#ffaa00" },
  hard: { speed: 12.0, reaction: 0.24, error: 1.5, predict: 18, label: "Hard", color: "#ff3366" },
}

const NEON_CYAN = "#00f0ff"
const NEON_PINK = "#ff2d7b"
const NEON_GREEN = "#39ff14"
const NEON_YELLOW = "#ffe600"
const BG_COLOR = "#0a0e1a"

export function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const ballRef = useRef<Ball>({ x: 0, y: 0, vx: 0, vy: 0, radius: BALL_RADIUS })
  const playerRef = useRef<Paddle>({ x: 0, y: 0, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, vy: 0 })
  const cpuRef = useRef<Paddle>({ x: 0, y: 0, width: PADDLE_WIDTH, height: PADDLE_HEIGHT, vy: 0 })
  const particlesRef = useRef<GlowParticle[]>([])
  const trailRef = useRef<TrailPoint[]>([])
  const cpuTargetRef = useRef(0)
  const cpuErrorRef = useRef(0)
  const cpuErrorTimerRef = useRef(0)
  const scorePauseRef = useRef(0)

  const keysRef = useRef<Set<string>>(new Set())
  const pointerYRef = useRef<number | null>(null)

  const [gameState, setGameState] = useState<GameState>("menu")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")
  const [playerScore, setPlayerScore] = useState(0)
  const [cpuScore, setCpuScore] = useState(0)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [lastScorer, setLastScorer] = useState<"player" | "cpu" | null>(null)

  const playerScoreRef = useRef(0)
  const cpuScoreRef = useRef(0)
  const gameStateRef = useRef<GameState>("menu")
  const soundEnabledRef = useRef(true)
  const difficultyRef = useRef<Difficulty>("medium")
  const rallyRef = useRef(0)

  // ── Audio ──────────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null)

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    return audioCtxRef.current
  }, [])

  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = "square", vol = 0.15) => {
    if (!soundEnabledRef.current) return
    try {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(vol, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    } catch { /* audio not available */ }
  }, [getAudioCtx])

  const sfxPaddleHit = useCallback(() => {
    playTone(440, 0.08, "square", 0.12)
    playTone(880, 0.06, "sine", 0.06)
  }, [playTone])

  const sfxWallHit = useCallback(() => {
    playTone(220, 0.05, "triangle", 0.08)
  }, [playTone])

  const sfxScore = useCallback((isPlayer: boolean) => {
    if (isPlayer) {
      playTone(523, 0.12, "square", 0.12)
      setTimeout(() => playTone(659, 0.12, "square", 0.12), 80)
      setTimeout(() => playTone(784, 0.18, "sine", 0.15), 160)
    } else {
      playTone(330, 0.15, "sawtooth", 0.1)
      setTimeout(() => playTone(220, 0.25, "sawtooth", 0.12), 120)
    }
  }, [playTone])

  const sfxGameOver = useCallback((won: boolean) => {
    if (won) {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => playTone(f, 0.2, "square", 0.12), i * 120)
      )
    } else {
      [440, 370, 311, 261].forEach((f, i) =>
        setTimeout(() => playTone(f, 0.25, "sawtooth", 0.1), i * 150)
      )
    }
  }, [playTone])

  const sfxCountdown = useCallback(() => {
    playTone(660, 0.1, "square", 0.08)
  }, [playTone])

  // ── Particles ──────────────────────────────────────────
  const spawnParticles = useCallback((x: number, y: number, color: string, count: number, speed = 3) => {
    const particles = particlesRef.current
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const spd = (Math.random() * 0.7 + 0.3) * speed
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        radius: Math.random() * 3 + 1,
        life: 1,
        maxLife: Math.random() * 30 + 20,
        color,
      })
    }
  }, [])

  const spawnTrail = useCallback((x: number, y: number) => {
    trailRef.current.push({ x, y, alpha: 0.6 })
    if (trailRef.current.length > 30) trailRef.current.shift()
  }, [])

  // ── Reset ──────────────────────────────────────────────
  const resetBall = useCallback((w: number, h: number, direction?: number) => {
    const ball = ballRef.current
    ball.x = w / 2
    ball.y = h / 2
    const angle = (Math.random() * 0.6 - 0.3)
    const dir = direction ?? (Math.random() > 0.5 ? 1 : -1)
    ball.vx = dir * BALL_SPEED_INITIAL * Math.cos(angle)
    ball.vy = BALL_SPEED_INITIAL * Math.sin(angle)
    trailRef.current = []
    rallyRef.current = 0
  }, [])

  const resetPositions = useCallback((w: number, h: number) => {
    const player = playerRef.current
    const cpu = cpuRef.current
    player.x = PADDLE_MARGIN
    player.y = h / 2 - PADDLE_HEIGHT / 2
    cpu.x = w - PADDLE_MARGIN - PADDLE_WIDTH
    cpu.y = h / 2 - PADDLE_HEIGHT / 2
    resetBall(w, h)
    particlesRef.current = []
  }, [resetBall])

  const startGame = useCallback((diff: Difficulty) => {
    setDifficulty(diff)
    difficultyRef.current = diff
    setPlayerScore(0)
    setCpuScore(0)
    playerScoreRef.current = 0
    cpuScoreRef.current = 0
    setLastScorer(null)
    scorePauseRef.current = 0
    const canvas = canvasRef.current
    if (canvas) resetPositions(canvas.width, canvas.height)
    setGameState("playing")
    gameStateRef.current = "playing"
    getAudioCtx()
  }, [resetPositions, getAudioCtx])

  // ── Resize ─────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const parent = canvas.parentElement
      if (!parent) return
      const w = parent.clientWidth
      const h = parent.clientHeight
      canvas.width = w
      canvas.height = h
      setCanvasSize({ width: w, height: h })
      if (gameStateRef.current === "menu") resetPositions(w, h)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [resetPositions])

  // ── Input ──────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key)
      if (e.key === "Escape" && gameStateRef.current === "playing") {
        setGameState("paused")
        gameStateRef.current = "paused"
      } else if (e.key === "Escape" && gameStateRef.current === "paused") {
        setGameState("playing")
        gameStateRef.current = "playing"
      }
    }
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key)

    const onPointerMove = (e: PointerEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      pointerYRef.current = e.clientY - rect.top
    }
    const onPointerLeave = () => { pointerYRef.current = null }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    const canvas = canvasRef.current
    canvas?.addEventListener("pointermove", onPointerMove)
    canvas?.addEventListener("pointerleave", onPointerLeave)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      canvas?.removeEventListener("pointermove", onPointerMove)
      canvas?.removeEventListener("pointerleave", onPointerLeave)
    }
  }, [])

  // ── Game loop ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const loop = (timestamp: number) => {
      const dt = lastTimeRef.current ? Math.min((timestamp - lastTimeRef.current) / 16.667, 2) : 1
      lastTimeRef.current = timestamp

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) { animRef.current = requestAnimationFrame(loop); return }

      const ball = ballRef.current
      const player = playerRef.current
      const cpu = cpuRef.current
      const particles = particlesRef.current
      const trail = trailRef.current
      const config = DIFFICULTY_CONFIG[difficultyRef.current]

      // ── Update ──
      if (gameStateRef.current === "playing") {
        // Score pause countdown
        if (scorePauseRef.current > 0) {
          scorePauseRef.current -= dt
          if (scorePauseRef.current <= 0) {
            scorePauseRef.current = 0
            resetBall(W, H, lastScorer === "player" ? -1 : 1)
          }
          // Still update particles during pause
        } else {
          // Player input
          const keys = keysRef.current
          if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) {
            player.vy = -PADDLE_SPEED
          } else if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) {
            player.vy = PADDLE_SPEED
          } else if (pointerYRef.current !== null) {
            const targetY = pointerYRef.current - PADDLE_HEIGHT / 2
            const diff = targetY - player.y
            player.vy = Math.sign(diff) * Math.min(Math.abs(diff) * 0.15, PADDLE_SPEED)
          } else {
            player.vy = 0
          }

          player.y += player.vy * dt
          player.y = Math.max(0, Math.min(H - PADDLE_HEIGHT, player.y))

          // CPU AI
          cpuErrorTimerRef.current -= dt
          if (cpuErrorTimerRef.current <= 0) {
            cpuErrorRef.current = (Math.random() - 0.5) * config.error * 2
            cpuErrorTimerRef.current = 30 + Math.random() * 30
          }

          // Predict where ball will be
          let targetY = ball.y + cpuErrorRef.current
          if (ball.vx > 0) {
            // Ball coming toward CPU - predict landing Y
            const framesUntilArrival = (cpu.x - ball.x) / ball.vx
            if (framesUntilArrival > 0 && framesUntilArrival < config.predict * 60) {
              let predY = ball.y + ball.vy * framesUntilArrival
              // Bounce off top/bottom
              while (predY < 0 || predY > H) {
                if (predY < 0) predY = -predY
                if (predY > H) predY = 2 * H - predY
              }
              targetY = predY + cpuErrorRef.current
            }
          } else {
            // Ball going away - return to center
            targetY = H / 2 + cpuErrorRef.current
          }

          cpuTargetRef.current = targetY
          const cpuCenter = cpu.y + PADDLE_HEIGHT / 2
          const cpuDiff = targetY - cpuCenter
          cpu.vy = Math.sign(cpuDiff) * Math.min(Math.abs(cpuDiff) * config.reaction, config.speed) * dt
          cpu.y += cpu.vy
          cpu.y = Math.max(0, Math.min(H - PADDLE_HEIGHT, cpu.y))

          // Ball movement
          ball.x += ball.vx * dt
          ball.y += ball.vy * dt

          // Trail
          spawnTrail(ball.x, ball.y)

          // Wall bounce (top/bottom)
          if (ball.y - ball.radius <= 0) {
            ball.y = ball.radius
            ball.vy = Math.abs(ball.vy)
            sfxWallHit()
            spawnParticles(ball.x, ball.y, NEON_CYAN, 6, 2)
          }
          if (ball.y + ball.radius >= H) {
            ball.y = H - ball.radius
            ball.vy = -Math.abs(ball.vy)
            sfxWallHit()
            spawnParticles(ball.x, ball.y, NEON_CYAN, 6, 2)
          }

          // Paddle collision - Player
          if (
            ball.vx < 0 &&
            ball.x - ball.radius <= player.x + player.width &&
            ball.x + ball.radius >= player.x &&
            ball.y >= player.y &&
            ball.y <= player.y + player.height
          ) {
            ball.x = player.x + player.width + ball.radius
            const hitPos = (ball.y - player.y) / player.height - 0.5
            const angle = hitPos * (Math.PI / 3)
            const speed = Math.min(Math.sqrt(ball.vx ** 2 + ball.vy ** 2) + BALL_SPEED_INCREMENT, BALL_MAX_SPEED)
            ball.vx = speed * Math.cos(angle)
            ball.vy = speed * Math.sin(angle)
            rallyRef.current++
            sfxPaddleHit()
            spawnParticles(ball.x, ball.y, NEON_GREEN, 12 + rallyRef.current, 4)
          }

          // Paddle collision - CPU
          if (
            ball.vx > 0 &&
            ball.x + ball.radius >= cpu.x &&
            ball.x - ball.radius <= cpu.x + cpu.width &&
            ball.y >= cpu.y &&
            ball.y <= cpu.y + cpu.height
          ) {
            ball.x = cpu.x - ball.radius
            const hitPos = (ball.y - cpu.y) / cpu.height - 0.5
            const angle = Math.PI - hitPos * (Math.PI / 3)
            const speed = Math.min(Math.sqrt(ball.vx ** 2 + ball.vy ** 2) + BALL_SPEED_INCREMENT, BALL_MAX_SPEED)
            ball.vx = -speed * Math.cos(Math.PI - angle)
            ball.vy = speed * Math.sin(angle)
            rallyRef.current++
            sfxPaddleHit()
            spawnParticles(ball.x, ball.y, NEON_PINK, 12 + rallyRef.current, 4)
          }

          // Scoring - ball passes left edge
          if (ball.x + ball.radius < 0) {
            cpuScoreRef.current++
            setCpuScore(cpuScoreRef.current)
            setLastScorer("cpu")
            sfxScore(false)
            spawnParticles(0, ball.y, NEON_PINK, 30, 6)
            scorePauseRef.current = 60

            if (cpuScoreRef.current >= WINNING_SCORE) {
              setGameState("gameover")
              gameStateRef.current = "gameover"
              sfxGameOver(false)
              spawnParticles(W / 2, H / 2, NEON_PINK, 60, 8)
            }
          }

          // Scoring - ball passes right edge
          if (ball.x - ball.radius > W) {
            playerScoreRef.current++
            setPlayerScore(playerScoreRef.current)
            setLastScorer("player")
            sfxScore(true)
            spawnParticles(W, ball.y, NEON_GREEN, 30, 6)
            scorePauseRef.current = 60

            if (playerScoreRef.current >= WINNING_SCORE) {
              setGameState("gameover")
              gameStateRef.current = "gameover"
              sfxGameOver(true)
              spawnParticles(W / 2, H / 2, NEON_GREEN, 60, 8)
            }
          }
        }
      }

      // Update particles (always, even during pause)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 0.97
        p.vy *= 0.97
        p.life -= dt / p.maxLife
        if (p.life <= 0) particles.splice(i, 1)
      }

      // Update trail
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].alpha -= 0.025 * dt
        if (trail[i].alpha <= 0) trail.splice(i, 1)
      }

      // ── Draw ──────────────────────────────────────────
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, W, H)

      // Grid lines (subtle)
      ctx.strokeStyle = "rgba(0, 240, 255, 0.04)"
      ctx.lineWidth = 1
      const gridSize = 40
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Center line
      ctx.strokeStyle = "rgba(0, 240, 255, 0.12)"
      ctx.lineWidth = 2
      ctx.setLineDash([10, 10])
      ctx.beginPath()
      ctx.moveTo(W / 2, 0)
      ctx.lineTo(W / 2, H)
      ctx.stroke()
      ctx.setLineDash([])

      // Center circle
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, 50, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(0, 240, 255, 0.08)"
      ctx.lineWidth = 2
      ctx.stroke()

      // Neon border edges
      const edgeGlow = 3
      // Top
      ctx.shadowColor = NEON_CYAN
      ctx.shadowBlur = 15
      ctx.strokeStyle = NEON_CYAN
      ctx.lineWidth = edgeGlow
      ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(W, 1); ctx.stroke()
      // Bottom
      ctx.shadowColor = NEON_PINK
      ctx.strokeStyle = NEON_PINK
      ctx.beginPath(); ctx.moveTo(0, H - 1); ctx.lineTo(W, H - 1); ctx.stroke()
      ctx.shadowBlur = 0

      // Score display on field
      ctx.save()
      ctx.globalAlpha = 0.08
      ctx.font = `bold ${Math.min(H * 0.5, 200)}px monospace`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = NEON_GREEN
      ctx.fillText(String(playerScoreRef.current), W * 0.25, H / 2)
      ctx.fillStyle = NEON_PINK
      ctx.fillText(String(cpuScoreRef.current), W * 0.75, H / 2)
      ctx.restore()

      // Trail
      for (const t of trail) {
        ctx.beginPath()
        ctx.arc(t.x, t.y, ball.radius * 0.6, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 240, 255, ${t.alpha * 0.3})`
        ctx.fill()
      }

      // Particles
      for (const p of particles) {
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.shadowColor = p.color
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
        ctx.restore()
      }

      // Paddles
      const drawPaddle = (paddle: Paddle, color: string) => {
        ctx.save()
        ctx.shadowColor = color
        ctx.shadowBlur = 20
        // Outer glow
        ctx.fillStyle = color
        ctx.globalAlpha = 0.15
        ctx.beginPath()
        ctx.roundRect(paddle.x - 4, paddle.y - 4, paddle.width + 8, paddle.height + 8, 6)
        ctx.fill()
        // Main paddle
        ctx.globalAlpha = 1
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 4)
        ctx.fill()
        // Inner highlight
        ctx.fillStyle = "rgba(255,255,255,0.3)"
        ctx.beginPath()
        ctx.roundRect(paddle.x + 3, paddle.y + 4, paddle.width - 6, paddle.height - 8, 2)
        ctx.fill()
        ctx.restore()
      }

      drawPaddle(player, NEON_GREEN)
      drawPaddle(cpu, NEON_PINK)

      // Ball
      if (scorePauseRef.current <= 0 || gameStateRef.current === "menu") {
        ctx.save()
        // Outer glow
        ctx.shadowColor = NEON_CYAN
        ctx.shadowBlur = 30
        ctx.beginPath()
        ctx.arc(ball.x, ball.y, ball.radius + 4, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(0, 240, 255, 0.15)"
        ctx.fill()
        // Ball
        ctx.shadowBlur = 20
        ctx.beginPath()
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
        const ballGrad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, ball.radius)
        ballGrad.addColorStop(0, "#ffffff")
        ballGrad.addColorStop(0.4, NEON_CYAN)
        ballGrad.addColorStop(1, "rgba(0, 240, 255, 0.6)")
        ctx.fillStyle = ballGrad
        ctx.fill()
        ctx.restore()
      }

      // Pause / scored overlay
      if (gameStateRef.current === "paused") {
        ctx.save()
        ctx.fillStyle = "rgba(0,0,0,0.6)"
        ctx.fillRect(0, 0, W, H)
        ctx.font = "bold 36px monospace"
        ctx.textAlign = "center"
        ctx.fillStyle = NEON_CYAN
        ctx.shadowColor = NEON_CYAN
        ctx.shadowBlur = 20
        ctx.fillText("PAUSED", W / 2, H / 2 - 20)
        ctx.font = "16px monospace"
        ctx.shadowBlur = 0
        ctx.fillStyle = "rgba(255,255,255,0.6)"
        ctx.fillText("Press ESC to resume", W / 2, H / 2 + 20)
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [
    spawnParticles, spawnTrail, resetBall, lastScorer,
    sfxPaddleHit, sfxWallHit, sfxScore, sfxGameOver, sfxCountdown,
  ])

  // ── Sync refs ──────────────────────────────────────────
  useEffect(() => { gameStateRef.current = gameState }, [gameState])
  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])

  // ── UI Overlays ────────────────────────────────────────
  const diffBtn = (d: Difficulty) => {
    const cfg = DIFFICULTY_CONFIG[d]
    const isSelected = difficulty === d
    return (
      <button
        key={d}
        onClick={() => startGame(d)}
        className="relative px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-200"
        style={{
          background: isSelected ? cfg.color : "rgba(255,255,255,0.05)",
          color: isSelected ? "#000" : cfg.color,
          border: `2px solid ${cfg.color}`,
          boxShadow: isSelected ? `0 0 20px ${cfg.color}60` : "none",
        }}
      >
        {cfg.label}
      </button>
    )
  }

  return (
    <div className="relative w-full h-screen bg-[#050810] overflow-hidden">
      {/* Canvas */}
      <div className="absolute inset-0">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* HUD */}
      {gameState === "playing" && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 pointer-events-none z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider" style={{ color: NEON_GREEN }}>You</span>
            <span className="font-mono font-bold text-2xl text-white">{playerScore}</span>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <span className="text-lg">{soundEnabled ? "🔊" : "🔇"}</span>
            </button>
            <button
              onClick={() => { setGameState("paused"); gameStateRef.current = "paused" }}
              className="p-2 rounded-lg transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <span className="text-lg">⏸</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-2xl text-white">{cpuScore}</span>
            <span className="text-xs uppercase tracking-wider" style={{ color: NEON_PINK }}>CPU</span>
          </div>
        </div>
      )}

      {/* Menu */}
      {gameState === "menu" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/60 backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1
              className="text-5xl md:text-7xl font-black tracking-tighter mb-2"
              style={{ color: NEON_CYAN, textShadow: `0 0 40px ${NEON_CYAN}60` }}
            >
              PONG
            </h1>
            <p className="text-white/50 text-sm tracking-wider uppercase">Neon Edition</p>
          </div>

          <div className="flex items-center gap-2 mb-6 text-white/40 text-xs">
            <span>↑↓ / W S / Mouse to move</span>
          </div>

          <p className="text-white/60 text-sm mb-4 uppercase tracking-wider">Select Difficulty</p>
          <div className="flex gap-3">
            {(["easy", "medium", "hard"] as Difficulty[]).map(diffBtn)}
          </div>
        </div>
      )}

      {/* Paused overlay buttons */}
      {gameState === "paused" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <div className="mt-20 flex gap-3">
            <button
              onClick={() => { setGameState("playing"); gameStateRef.current = "playing" }}
              className="px-6 py-3 rounded-lg font-bold text-sm uppercase"
              style={{ background: NEON_CYAN, color: "#000" }}
            >
              Resume
            </button>
            <button
              onClick={() => { setGameState("menu"); gameStateRef.current = "menu" }}
              className="px-6 py-3 rounded-lg font-bold text-sm uppercase border-2 text-white/70"
              style={{ borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)" }}
            >
              Quit
            </button>
          </div>
        </div>
      )}

      {/* Game Over */}
      {gameState === "gameover" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/70 backdrop-blur-sm">
          <h2
            className="text-4xl md:text-6xl font-black mb-4"
            style={{
              color: playerScore >= WINNING_SCORE ? NEON_GREEN : NEON_PINK,
              textShadow: `0 0 30px ${playerScore >= WINNING_SCORE ? NEON_GREEN : NEON_PINK}60`,
            }}
          >
            {playerScore >= WINNING_SCORE ? "YOU WIN!" : "YOU LOSE"}
          </h2>
          <p className="text-white/50 text-lg font-mono mb-8">
            {playerScore} - {cpuScore}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => startGame(difficulty)}
              className="px-6 py-3 rounded-lg font-bold text-sm uppercase"
              style={{ background: NEON_CYAN, color: "#000", boxShadow: `0 0 20px ${NEON_CYAN}40` }}
            >
              Play Again
            </button>
            <button
              onClick={() => { setGameState("menu"); gameStateRef.current = "menu" }}
              className="px-6 py-3 rounded-lg font-bold text-sm uppercase border-2 text-white/70"
              style={{ borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)" }}
            >
              Menu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
