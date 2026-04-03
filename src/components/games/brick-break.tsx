"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useGameEndEmitter } from "@/hooks/use-game-events"

// ─── Constants ───────────────────────────────────────────────────────────────
const WIDTH = 360
const HEIGHT = 580
const COLS = 10
const ROWS = 14
const BRICK_PAD = 2
const BRICK_OFFSET_Y = 52
const BRICK_W = (WIDTH - (COLS + 1) * BRICK_PAD) / COLS
const BRICK_H = 14
const PADDLE_H = 10
const PADDLE_INIT_W = 46
const BALL_R = 4
const PADDLE_Y = HEIGHT - 32

// Speed
const BASE_BALL_SPEED = 5.0
const SPEED_PER_LEVEL = 0.45
const MAX_SPEED = 14
const PADDLE_SPEED = 6

// ─── Types ───────────────────────────────────────────────────────────────────
type Phase = "idle" | "launch" | "playing" | "dying" | "gameover"
type Dir = "left" | "right" | "none"

interface Ball { x: number; y: number; vx: number; vy: number; speed: number; stuck: boolean }

type BType = "n1" | "n2" | "n3" | "bomb" | "wall"

interface Brick {
  col: number; row: number; x: number; y: number; type: BType; hits: number; flash: number
}

interface Capsule {
  x: number; y: number; kind: CapsuleKind; color: string; letter: string
}

type CapsuleKind = "L" | "S" | "C" | "E" | "D" | "B" | "W"

interface Laser { x: number; y: number }

// ─── Color Palette (BB-style) ────────────────────────────────────────────────
const BG = "#0d0d0d"
const HUD_BG = "#1a1a1a"
const COLORS_BY_ROW = [
  "#e74c3c", "#e74c3c",
  "#e67e22", "#e67e22",
  "#f1c40f", "#f1c40f",
  "#2ecc71", "#2ecc71",
  "#3498db", "#3498db",
  "#9b59b6", "#9b59b6",
  "#1abc9c", "#1abc9c",
]
const STEEL_COLOR = "#7f8c8d"
const BOMB_COLOR = "#e74c3c"
const WALL_COLOR = "#444"
const PADDLE_COLOR = "#ecf0f1"
const BALL_COLOR = "#ecf0f1"

// ─── Audio ───────────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null
function ac(): AudioContext { if (!audioCtx) audioCtx = new AudioContext(); return audioCtx }

function tone(f: number, d: number, t: OscillatorType = "square", v = 0.06) {
  try {
    const c = ac(); const o = c.createOscillator(); const g = c.createGain()
    o.type = t; o.frequency.value = f; g.gain.setValueAtTime(v, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d)
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + d)
  } catch { /* */ }
}

const sndBrick = (row: number) => { tone(400 + row * 40, 0.06, "square", 0.05); tone(600 + row * 40, 0.04, "sine", 0.03) }
const sndPaddle = () => { tone(220, 0.08, "triangle", 0.06) }
const sndWall = () => { tone(160, 0.04, "square", 0.03) }
const sndBomb = () => { try { const c = ac(); const b = c.createBuffer(1, c.sampleRate * 0.12, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.setValueAtTime(0.1, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12); s.connect(g); g.connect(c.destination); s.start() } catch { /* */ } }
const sndLife = () => { tone(523, 0.06, "sine", 0.05); setTimeout(() => tone(659, 0.06, "sine", 0.05), 50); setTimeout(() => tone(784, 0.08, "sine", 0.06), 100) }
const sndDeath = () => { tone(300, 0.12, "sawtooth", 0.07); setTimeout(() => tone(200, 0.15, "sawtooth", 0.06), 100); setTimeout(() => tone(100, 0.25, "sawtooth", 0.05), 200) }
const sndGameOver = () => { tone(400, 0.15, "square", 0.07); setTimeout(() => tone(300, 0.15, "square", 0.07), 150); setTimeout(() => tone(200, 0.15, "square", 0.07), 300); setTimeout(() => tone(100, 0.4, "sawtooth", 0.05), 450) }
const sndLaser = () => { tone(900, 0.04, "sawtooth", 0.04) }
const sndCapsule = () => { tone(600, 0.05, "sine", 0.05); tone(800, 0.04, "sine", 0.04) }

// ─── Level Generation ────────────────────────────────────────────────────────
function makeLevel(lvl: number): Brick[] {
  const bricks: Brick[] = []
  const d = Math.min(lvl, 30)
  const pattern = (lvl - 1) % 8

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = BRICK_PAD + col * (BRICK_W + BRICK_PAD)
      const y = BRICK_OFFSET_Y + row * (BRICK_H + BRICK_PAD)

      let skip = false
      switch (pattern) {
        case 0: break
        case 1: skip = (row + col) % 2 === 0; break
        case 2: skip = row % 3 === 0; break
        case 3: skip = col % 3 === 0; break
        case 4: skip = Math.abs(col - 4.5) + Math.abs(row - 6.5) > 7; break
        case 5: skip = (row < 3 || row > 10) && col % 2 === 0; break
        case 6: skip = row >= 4 && row <= 9 && col >= 3 && col <= 6; break
        case 7: skip = (row + col) % 4 === 0; break
      }
      if (skip) continue

      const rand = Math.random()
      let type: BType = "n1"
      let hits = 1

      if (rand < 0.015 + d * 0.005) { type = "wall"; hits = 999 }
      else if (rand < 0.06 + d * 0.012) { type = "n3"; hits = 3 }
      else if (rand < 0.10 + d * 0.008) { type = "bomb"; hits = 1 }
      else if (rand < 0.30 + d * 0.015) { type = "n2"; hits = 2 }
      if (type === "n1" && row < 3 && d > 3) { type = "n2"; hits = 2 }

      bricks.push({ col, row, x, y, type, hits, flash: 0 })
    }
  }
  return bricks
}

// ─── Component ───────────────────────────────────────────────────────────────
export function BrickBreakGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const lastTRef = useRef(0)
  const accumRef = useRef(0)

  const [gamePhase, setGamePhase] = useState<Phase>("idle")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [canvasScale, setCanvasScale] = useState(1)

  const phaseRef = useRef<Phase>("idle")
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const levelRef = useRef(1)

  const paddleRef = useRef({ x: WIDTH / 2, w: PADDLE_INIT_W, catch: false, catchTimer: 0, laserTimer: 0, floorTimer: 0 })
  const ballsRef = useRef<Ball[]>([])
  const bricksRef = useRef<Brick[]>([])
  const capsRef = useRef<Capsule[]>([])
  const lasersRef = useRef<Laser[]>([])
  const laserCdRef = useRef(0)
  const demoBricksRef = useRef<Brick[] | null>(null)

  const comboRef = useRef(0)
  const comboTimerRef = useRef(0)
  const dyingTimerRef = useRef(0)

  const inputRef = useRef<Dir>("none")
  const mouseXRef = useRef(WIDTH / 2)
  const useMouseRef = useRef(false)

  const { emitGameEnd, resetEmitter } = useGameEndEmitter()

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const ballSpeed = (lvl: number) => Math.min(BASE_BALL_SPEED + (lvl - 1) * SPEED_PER_LEVEL, MAX_SPEED)

  const newBall = useCallback((px: number, stuck: boolean, lvl: number): Ball => {
    const s = ballSpeed(lvl)
    return { x: px, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: -s, speed: s, stuck }
  }, [])

  const initLevel = useCallback((lvl: number) => {
    const p = paddleRef.current
    p.x = WIDTH / 2; p.w = PADDLE_INIT_W; p.catch = false; p.catchTimer = 0; p.laserTimer = 0; p.floorTimer = 0
    ballsRef.current = [newBall(WIDTH / 2, true, lvl)]
    bricksRef.current = makeLevel(lvl)
    capsRef.current = []; lasersRef.current = []
    laserCdRef.current = 0
    comboRef.current = 0; comboTimerRef.current = 0
  }, [newBall])

  // ─── Scale ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const u = () => setCanvasScale(Math.min((window.innerWidth - 16) / WIDTH, (window.innerHeight - 100) / HEIGHT, 1.5))
    u(); window.addEventListener("resize", u); return () => window.removeEventListener("resize", u)
  }, [])

  // ─── High Score ──────────────────────────────────────────────────────────
  useEffect(() => { const s = localStorage.getItem("brickbreak_hs"); if (s) setHighScore(+s) }, [])

  // ─── Demo bricks (precomputed once) ──────────────────────────────────────
  useEffect(() => { demoBricksRef.current = makeLevel(1) }, [])

  // ─── Release ball ────────────────────────────────────────────────────────
  const releaseBall = useCallback(() => {
    for (const b of ballsRef.current) {
      if (b.stuck) {
        b.stuck = false
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5
        b.vx = Math.cos(angle) * b.speed
        b.vy = Math.sin(angle) * b.speed
      }
    }
    paddleRef.current.catch = false
  }, [])

  const startHandler = useCallback(async () => {
    scoreRef.current = 0; livesRef.current = 3; levelRef.current = 1
    setScore(0); setLives(3); setLevel(1)
    initLevel(1)
    phaseRef.current = "launch"; setGamePhase("launch")
    resetEmitter()
  }, [initLevel, resetEmitter])

  // ─── Input ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); inputRef.current = "left"; useMouseRef.current = false }
      if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); inputRef.current = "right"; useMouseRef.current = false }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        if (phaseRef.current === "idle" || phaseRef.current === "gameover") startHandler()
        else releaseBall()
      }
    }
    const ku = (e: KeyboardEvent) => {
      if ((e.key === "ArrowLeft" || e.key === "a") && inputRef.current === "left") inputRef.current = "none"
      if ((e.key === "ArrowRight" || e.key === "d") && inputRef.current === "right") inputRef.current = "none"
    }
    const mm = (e: MouseEvent) => {
      const c = canvasRef.current; if (!c) return
      const r = c.getBoundingClientRect()
      mouseXRef.current = (e.clientX - r.left) / canvasScale
      useMouseRef.current = true
    }
    const tm = (e: TouchEvent) => {
      e.preventDefault()
      const c = canvasRef.current; if (!c) return
      const r = c.getBoundingClientRect()
      mouseXRef.current = (e.touches[0].clientX - r.left) / canvasScale
      useMouseRef.current = true
    }
    const click = () => {
      if (phaseRef.current === "idle" || phaseRef.current === "gameover") startHandler()
      else releaseBall()
    }
    window.addEventListener("keydown", kd)
    window.addEventListener("keyup", ku)
    window.addEventListener("mousemove", mm)
    window.addEventListener("touchmove", tm, { passive: false })
    window.addEventListener("touchstart", tm, { passive: false })
    window.addEventListener("click", click)
    return () => {
      window.removeEventListener("keydown", kd)
      window.removeEventListener("keyup", ku)
      window.removeEventListener("mousemove", mm)
      window.removeEventListener("touchmove", tm)
      window.removeEventListener("touchstart", tm)
      window.removeEventListener("click", click)
    }
  }, [canvasScale, startHandler, releaseBall])

  // ─── Capsule spawning ────────────────────────────────────────────────────
  const spawnCapsule = useCallback((x: number, y: number, lvl: number) => {
    if (Math.random() > 0.20) return
    const d = Math.min(lvl, 30)
    const negChance = 0.4 + d * 0.015
    const kinds: { k: CapsuleKind; c: string; l: string }[] = [
      { k: "S", c: "#3498db", l: "S" },
      { k: "L", c: "#2ecc71", l: "L" },
      { k: "C", c: "#ecf0f1", l: "C" },
      { k: "E", c: "#f1c40f", l: "E" },
      { k: "D", c: "#9b59b6", l: "D" },
      { k: "B", c: "#e74c3c", l: "B" },
      { k: "W", c: "#1abc9c", l: "W" },
    ]
    const isNeg = Math.random() < negChance
    if (isNeg) {
      if (Math.random() < 0.5) {
        capsRef.current.push({ x, y, kind: "S", color: "#e67e22", letter: "F" })
      } else {
        capsRef.current.push({ x, y, kind: "E", color: "#e74c3c", letter: "N" })
      }
      return
    }
    const pick = kinds[Math.floor(Math.random() * kinds.length)]
    capsRef.current.push({ x, y, kind: pick.k, color: pick.c, letter: pick.l })
  }, [])

  // ─── Brick destroy ──────────────────────────────────────────────────────
  const destroyBrickAt = useCallback((idx: number) => {
    const brick = bricksRef.current[idx]
    comboRef.current++; comboTimerRef.current = 1500
    const pts = (10 + (ROWS - brick.row) * 5) * (1 + (comboRef.current - 1) * 0.2)
    scoreRef.current += Math.round(pts)
    setScore(scoreRef.current)

    if (brick.type === "bomb") {
      sndBomb()
      const cx = brick.col, cy = brick.row
      for (let k = bricksRef.current.length - 1; k >= 0; k--) {
        if (k === idx) continue
        const o = bricksRef.current[k]
        if (o.type === "wall") continue
        if (Math.abs(o.col - cx) <= 1 && Math.abs(o.row - cy) <= 1) {
          o.hits--; o.flash = 4
          if (o.hits <= 0) {
            scoreRef.current += 15; setScore(scoreRef.current)
            spawnCapsule(o.x + BRICK_W / 2, o.y + BRICK_H / 2, levelRef.current)
            bricksRef.current.splice(k, 1)
            if (k < idx) idx--
          }
        }
      }
    } else {
      sndBrick(brick.row)
    }

    spawnCapsule(brick.x + BRICK_W / 2, brick.y + BRICK_H / 2, levelRef.current)
    bricksRef.current.splice(idx, 1)
  }, [spawnCapsule])

  // ─── Draw helpers ────────────────────────────────────────────────────────
  const drawHUD = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = HUD_BG; ctx.fillRect(0, 0, WIDTH, 40)
    ctx.fillStyle = "#ecf0f1"; ctx.font = "bold 13px 'Courier New', monospace"
    ctx.textAlign = "left"; ctx.fillText(`${scoreRef.current}`, 10, 26)
    ctx.textAlign = "center"
    ctx.fillStyle = "#7f8c8d"; ctx.font = "11px 'Courier New', monospace"
    ctx.fillText(`LVL ${levelRef.current}`, WIDTH / 2, 26)
    ctx.textAlign = "right"; ctx.fillStyle = "#e74c3c"; ctx.font = "bold 13px 'Courier New', monospace"
    const hearts = "●".repeat(Math.max(0, livesRef.current))
    ctx.fillText(hearts, WIDTH - 10, 26)
    ctx.fillStyle = "#333"; ctx.fillRect(0, 40, WIDTH, 1)
  }, [])

  const drawBrick = useCallback((ctx: CanvasRenderingContext2D, b: Brick) => {
    if (b.flash > 0) { ctx.fillStyle = "#fff"; ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H); return }

    let color: string
    switch (b.type) {
      case "wall": color = WALL_COLOR; break
      case "n3": color = STEEL_COLOR; break
      case "bomb": color = BOMB_COLOR; break
      default: color = COLORS_BY_ROW[b.row % COLORS_BY_ROW.length]; break
    }

    ctx.fillStyle = color; ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H)
    ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(b.x, b.y, BRICK_W, 2)
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(b.x, b.y + BRICK_H - 2, BRICK_W, 2)

    if (b.type === "n2" || b.type === "n3") {
      ctx.fillStyle = "rgba(0,0,0,0.3)"
      if (b.hits >= 2) { ctx.fillRect(b.x + BRICK_W / 2 - 4, b.y + BRICK_H / 2 - 1, 3, 2); ctx.fillRect(b.x + BRICK_W / 2 + 1, b.y + BRICK_H / 2 - 1, 3, 2) }
      if (b.hits >= 3) { ctx.fillRect(b.x + BRICK_W / 2 - 1.5, b.y + BRICK_H / 2 - 1, 3, 2) }
    }

    if (b.type === "bomb") {
      ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.arc(b.x + BRICK_W / 2, b.y + BRICK_H / 2, 2.5, 0, Math.PI * 2); ctx.fill()
    }

    if (b.type === "wall") {
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 0.8
      ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + 2); ctx.lineTo(b.x + BRICK_W - 2, b.y + BRICK_H - 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(b.x + BRICK_W - 2, b.y + 2); ctx.lineTo(b.x + 2, b.y + BRICK_H - 2); ctx.stroke()
    }

    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.5; ctx.strokeRect(b.x, b.y, BRICK_W, BRICK_H)
  }, [])

  // ─── Game Loop ───────────────────────────────────────────────────────────
  const gameLoop = useCallback((ts: number) => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return

    const FT = 1000 / 60
    const dt = Math.min(100, ts - lastTRef.current)
    lastTRef.current = ts
    accumRef.current += dt
    const phase = phaseRef.current

    // === IDLE / GAMEOVER SCREEN ===
    if (phase === "idle" || phase === "gameover") {
      ctx.fillStyle = BG; ctx.fillRect(0, 0, WIDTH, HEIGHT)
      const demo = demoBricksRef.current || []
      for (const b of demo) drawBrick(ctx, b)
      ctx.fillStyle = PADDLE_COLOR
      ctx.fillRect(WIDTH / 2 - PADDLE_INIT_W / 2, PADDLE_Y, PADDLE_INIT_W, PADDLE_H)
      ctx.fillStyle = BALL_COLOR
      ctx.beginPath(); ctx.arc(WIDTH / 2, PADDLE_Y - BALL_R - 1, BALL_R, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(0, 0, WIDTH, HEIGHT)
      ctx.fillStyle = "#ecf0f1"; ctx.font = "bold 26px 'Courier New', monospace"; ctx.textAlign = "center"
      ctx.fillText(phase === "gameover" ? "GAME OVER" : "BRICK BREAKER", WIDTH / 2, HEIGHT / 2 - 40)
      if (phase === "gameover") {
        ctx.font = "18px 'Courier New', monospace"
        ctx.fillText(`Score: ${scoreRef.current}`, WIDTH / 2, HEIGHT / 2)
      }
      ctx.fillStyle = "#7f8c8d"; ctx.font = "13px 'Courier New', monospace"
      ctx.fillText("Tap or SPACE to start", WIDTH / 2, HEIGHT / 2 + 30)
      if (highScore > 0) {
        ctx.fillStyle = "#f1c40f"; ctx.font = "12px 'Courier New', monospace"
        ctx.fillText(`High Score: ${highScore}`, WIDTH / 2, HEIGHT / 2 + 55)
      }
      animRef.current = requestAnimationFrame(gameLoop); return
    }

    // === DYING ===
    if (phase === "dying") {
      dyingTimerRef.current -= dt
      ctx.fillStyle = BG; ctx.fillRect(0, 0, WIDTH, HEIGHT)
      drawHUD(ctx)
      for (const b of bricksRef.current) drawBrick(ctx, b)
      if (Math.floor(dyingTimerRef.current / 120) % 2 === 0) {
        ctx.fillStyle = "#e74c3c"
        ctx.fillRect(paddleRef.current.x - paddleRef.current.w / 2, PADDLE_Y, paddleRef.current.w, PADDLE_H)
      }
      if (dyingTimerRef.current <= 0) {
        if (livesRef.current <= 0) {
          phaseRef.current = "gameover"; setGamePhase("gameover")
          sndGameOver()
          if (scoreRef.current > highScore) { setHighScore(scoreRef.current); localStorage.setItem("brickbreak_hs", scoreRef.current.toString()) }
          emitGameEnd("brick-break", scoreRef.current)
        } else {
          paddleRef.current.x = WIDTH / 2; paddleRef.current.w = PADDLE_INIT_W
          paddleRef.current.catch = false; paddleRef.current.catchTimer = 0
          paddleRef.current.laserTimer = 0; paddleRef.current.floorTimer = 0
          ballsRef.current = [newBall(WIDTH / 2, true, levelRef.current)]
          capsRef.current = []; lasersRef.current = []
          phaseRef.current = "launch"; setGamePhase("launch")
        }
      }
      animRef.current = requestAnimationFrame(gameLoop); return
    }

    // === LAUNCH / PLAYING ===
    while (accumRef.current >= FT) {
      accumRef.current -= FT
      const pad = paddleRef.current

      // ── Paddle Movement (INSTANT — no lag) ──
      if (useMouseRef.current) {
        pad.x = mouseXRef.current
      } else {
        if (inputRef.current === "left") pad.x -= PADDLE_SPEED
        if (inputRef.current === "right") pad.x += PADDLE_SPEED
      }
      pad.x = Math.max(pad.w / 2, Math.min(WIDTH - pad.w / 2, pad.x))

      // ── Timers ──
      if (comboTimerRef.current > 0) { comboTimerRef.current -= FT; if (comboTimerRef.current <= 0) comboRef.current = 0 }
      if (pad.catchTimer > 0) { pad.catchTimer -= FT; if (pad.catchTimer <= 0) pad.catch = false }
      if (pad.laserTimer > 0) { pad.laserTimer -= FT }
      if (pad.floorTimer > 0) { pad.floorTimer -= FT }
      if (laserCdRef.current > 0) laserCdRef.current -= FT

      // ── Lasers ──
      if (pad.laserTimer > 0 && laserCdRef.current <= 0) {
        lasersRef.current.push({ x: pad.x - pad.w / 2 + 3, y: PADDLE_Y - 2 })
        lasersRef.current.push({ x: pad.x + pad.w / 2 - 3, y: PADDLE_Y - 2 })
        laserCdRef.current = 180
        sndLaser()
      }
      for (let i = lasersRef.current.length - 1; i >= 0; i--) {
        lasersRef.current[i].y -= 7
        if (lasersRef.current[i].y < 0) { lasersRef.current.splice(i, 1); continue }
        const l = lasersRef.current[i]
        for (let j = bricksRef.current.length - 1; j >= 0; j--) {
          const b = bricksRef.current[j]
          if (l.x >= b.x && l.x <= b.x + BRICK_W && l.y >= b.y && l.y <= b.y + BRICK_H) {
            lasersRef.current.splice(i, 1)
            if (b.type === "wall") break
            b.hits--; b.flash = 3; sndBrick(b.row)
            if (b.hits <= 0) destroyBrickAt(j)
            break
          }
        }
      }

      // ── Balls ──
      for (let bi = ballsRef.current.length - 1; bi >= 0; bi--) {
        const ball = ballsRef.current[bi]

        if (ball.stuck) {
          ball.x = pad.x; ball.y = PADDLE_Y - BALL_R - 1
          continue
        }

        ball.x += ball.vx; ball.y += ball.vy

        // Wall bounces
        if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); sndWall() }
        if (ball.x + BALL_R > WIDTH) { ball.x = WIDTH - BALL_R; ball.vx = -Math.abs(ball.vx); sndWall() }
        if (ball.y - BALL_R < BRICK_OFFSET_Y - 10) {
          ball.y = BRICK_OFFSET_Y - 10 + BALL_R; ball.vy = Math.abs(ball.vy); sndWall()
        }

        // Floor
        if (ball.y + BALL_R > HEIGHT) {
          if (pad.floorTimer > 0) {
            ball.y = HEIGHT - BALL_R; ball.vy = -Math.abs(ball.vy); sndWall()
          } else {
            ballsRef.current.splice(bi, 1); continue
          }
        }

        // Paddle collision
        const padL = pad.x - pad.w / 2, padR = pad.x + pad.w / 2
        if (ball.vy > 0 && ball.y + BALL_R >= PADDLE_Y && ball.y + BALL_R < PADDLE_Y + PADDLE_H + ball.speed &&
            ball.x >= padL - 2 && ball.x <= padR + 2) {
          const hit = (ball.x - pad.x) / (pad.w / 2)
          const angle = hit * 1.1 - Math.PI / 2
          ball.vx = Math.cos(angle) * ball.speed
          ball.vy = Math.sin(angle) * ball.speed
          if (Math.abs(ball.vy) < ball.speed * 0.25) ball.vy = -ball.speed * 0.25
          ball.y = PADDLE_Y - BALL_R
          sndPaddle()
          if (pad.catch && pad.catchTimer > 0) {
            ball.stuck = true; ball.vx = 0; ball.vy = 0
          }
        }

        // Brick collision
        for (let j = bricksRef.current.length - 1; j >= 0; j--) {
          const b = bricksRef.current[j]
          if (ball.x + BALL_R > b.x && ball.x - BALL_R < b.x + BRICK_W &&
              ball.y + BALL_R > b.y && ball.y - BALL_R < b.y + BRICK_H) {
            const ol = ball.x + BALL_R - b.x
            const or2 = b.x + BRICK_W - (ball.x - BALL_R)
            const ot = ball.y + BALL_R - b.y
            const ob = b.y + BRICK_H - (ball.y - BALL_R)
            const m = Math.min(ol, or2, ot, ob)
            if (m === ol) { ball.vx = -Math.abs(ball.vx); ball.x = b.x - BALL_R }
            else if (m === or2) { ball.vx = Math.abs(ball.vx); ball.x = b.x + BRICK_W + BALL_R }
            else if (m === ot) { ball.vy = -Math.abs(ball.vy); ball.y = b.y - BALL_R }
            else { ball.vy = Math.abs(ball.vy); ball.y = b.y + BRICK_H + BALL_R }

            if (b.type === "wall") { sndWall(); break }
            b.hits--; b.flash = 4
            if (b.hits <= 0) destroyBrickAt(j)
            else sndBrick(b.row)
            break
          }
        }
      }

      // ── All balls lost ──
      if (ballsRef.current.length === 0 && phase === "playing") {
        livesRef.current--; setLives(livesRef.current)
        sndDeath(); comboRef.current = 0
        dyingTimerRef.current = 800
        phaseRef.current = "dying"; setGamePhase("dying")
      }

      // ── Capsules ──
      for (let i = capsRef.current.length - 1; i >= 0; i--) {
        const c = capsRef.current[i]
        c.y += 2
        if (c.y > HEIGHT + 16) { capsRef.current.splice(i, 1); continue }
        const pad = paddleRef.current
        const padL = pad.x - pad.w / 2, padR = pad.x + pad.w / 2
        if (c.y + 8 >= PADDLE_Y && c.y - 8 <= PADDLE_Y + PADDLE_H && c.x >= padL - 8 && c.x <= padR + 8) {
          capsRef.current.splice(i, 1)
          sndCapsule()
          if (c.letter === "F") {
            for (const b of ballsRef.current) {
              b.speed = Math.min(b.speed + 1.5, MAX_SPEED)
              if (!b.stuck) { const a = Math.atan2(b.vy, b.vx); b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed }
            }
          } else if (c.letter === "N") {
            pad.w = Math.max(28, pad.w - 14)
          } else {
            switch (c.kind) {
              case "L": livesRef.current++; setLives(livesRef.current); sndLife(); break
              case "S": for (const b of ballsRef.current) {
                b.speed = Math.max(3, b.speed - 1.5)
                if (!b.stuck) { const a = Math.atan2(b.vy, b.vx); b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed }
              } break
              case "C": pad.catch = true; pad.catchTimer = 8000; break
              case "E": pad.w = Math.min(120, pad.w + 16); break
              case "D":
                if (ballsRef.current.length < 8) {
                  const existing = [...ballsRef.current.filter(b => !b.stuck)]
                  for (const b of existing) {
                    if (ballsRef.current.length >= 8) break
                    const a1 = Math.atan2(b.vy, b.vx) + 0.3
                    const a2 = Math.atan2(b.vy, b.vx) - 0.3
                    ballsRef.current.push({ x: b.x, y: b.y, vx: Math.cos(a1) * b.speed, vy: Math.sin(a1) * b.speed, speed: b.speed, stuck: false })
                    ballsRef.current.push({ x: b.x, y: b.y, vx: Math.cos(a2) * b.speed, vy: Math.sin(a2) * b.speed, speed: b.speed, stuck: false })
                  }
                }
                break
              case "B": pad.laserTimer = 7000; break
              case "W": pad.floorTimer = 10000; break
            }
          }
        }
      }

      // ── Brick flash decay ──
      for (const b of bricksRef.current) if (b.flash > 0) b.flash--

      // ── Level complete ──
      const breakable = bricksRef.current.filter(b => b.type !== "wall")
      if (breakable.length === 0 && (phase === "playing" || phase === "launch")) {
        levelRef.current++; setLevel(levelRef.current)
        const bonus = levelRef.current * 500
        scoreRef.current += bonus; setScore(scoreRef.current)
        initLevel(levelRef.current)
        phaseRef.current = "launch"; setGamePhase("launch")
      }

      // Auto-transition from launch to playing
      if (phase === "launch" && ballsRef.current.some(b => !b.stuck)) {
        phaseRef.current = "playing"; setGamePhase("playing")
      }
    }

    // === RENDER ===
    ctx.fillStyle = BG; ctx.fillRect(0, 0, WIDTH, HEIGHT)
    drawHUD(ctx)

    // Floor wall indicator
    if (paddleRef.current.floorTimer > 0) {
      const alpha = paddleRef.current.floorTimer < 2000 ? (Math.sin(paddleRef.current.floorTimer * 0.01) * 0.3 + 0.4) : 0.6
      ctx.fillStyle = `rgba(46,204,113,${alpha})`
      ctx.fillRect(0, HEIGHT - 3, WIDTH, 3)
    }

    // Bricks
    for (const b of bricksRef.current) drawBrick(ctx, b)

    // Capsules
    for (const c of capsRef.current) {
      ctx.fillStyle = c.color
      ctx.beginPath(); ctx.roundRect(c.x - 10, c.y - 6, 20, 12, 3); ctx.fill()
      ctx.fillStyle = BG; ctx.font = "bold 9px 'Courier New', monospace"; ctx.textAlign = "center"
      ctx.fillText(c.letter, c.x, c.y + 3)
    }

    // Lasers
    ctx.fillStyle = "#e74c3c"
    for (const l of lasersRef.current) ctx.fillRect(l.x - 1, l.y, 2, 8)

    // Paddle
    const pad = paddleRef.current
    const px = pad.x - pad.w / 2
    ctx.fillStyle = pad.laserTimer > 0 ? "#e74c3c" : PADDLE_COLOR
    ctx.fillRect(px, PADDLE_Y, pad.w, PADDLE_H)
    ctx.fillStyle = "rgba(255,255,255,0.3)"
    ctx.fillRect(px + 2, PADDLE_Y + 1, pad.w - 4, 2)
    if (pad.catch && pad.catchTimer > 0) {
      ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 1; ctx.strokeRect(px, PADDLE_Y, pad.w, PADDLE_H)
    }

    // Balls
    ctx.fillStyle = BALL_COLOR
    for (const b of ballsRef.current) { ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill() }

    // Combo text
    if (comboRef.current > 1) {
      ctx.fillStyle = "#f1c40f"; ctx.font = "bold 13px 'Courier New', monospace"; ctx.textAlign = "center"
      ctx.globalAlpha = Math.min(1, comboTimerRef.current / 400)
      ctx.fillText(`${comboRef.current}× COMBO`, WIDTH / 2, PADDLE_Y + PADDLE_H + 18)
      ctx.globalAlpha = 1
    }

    // Launch hint
    if (phase === "launch") {
      ctx.fillStyle = "#7f8c8d"; ctx.font = "12px 'Courier New', monospace"; ctx.textAlign = "center"
      ctx.fillText("TAP or SPACE to launch", WIDTH / 2, HEIGHT / 2 + 60)
    }

    animRef.current = requestAnimationFrame(gameLoop)
  }, [highScore, emitGameEnd, initLevel, newBall, drawHUD, drawBrick, destroyBrickAt])

  // ─── Start loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    lastTRef.current = performance.now(); accumRef.current = 0
    animRef.current = requestAnimationFrame(gameLoop)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [gameLoop])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d0d0d] gap-3 p-3 select-none">
      <div className="flex items-center gap-4">
        <a href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm font-mono">← Back</a>
        <h1 className="text-lg font-bold text-gray-200 tracking-widest font-mono">BRICK BREAKER</h1>
      </div>

      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: WIDTH * canvasScale, height: HEIGHT * canvasScale }}
        className="border border-gray-800 cursor-none"
      />

      <div className="flex items-center gap-6 text-xs font-mono text-gray-500">
        <span>Score: <span className="text-gray-200 font-bold">{score}</span></span>
        <span>Lives: <span className="text-red-400">{"●".repeat(Math.max(0, lives))}</span></span>
        <span>Lvl: <span className="text-gray-300">{level}</span></span>
        {highScore > 0 && <span>Best: <span className="text-yellow-500">{highScore}</span></span>}
      </div>

      <div className="text-gray-700 text-[10px] font-mono text-center">
        Arrow keys / Mouse / Touch to move • Space / Tap to launch
      </div>
    </div>
  )
}
