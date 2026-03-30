"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useGameEndEmitter } from "@/hooks/use-game-events"

// ─── Constants ───────────────────────────────────────────────────
const GAME_WIDTH = 400
const GAME_HEIGHT = 720

const GROUND_THICKNESS = 60
const GRASS_THICKNESS = 10

const PLAYER_SIZE = 32
const PLAYER_X = 80 // fixed screen horizontal position

const SCROLL_SPEED_INITIAL = 3.8
const SCROLL_SPEED_MAX = 9.5
const SCROLL_SPEED_INCREMENT = 0.0005

const GRAVITY_STRENGTH = 0.65
const JUMP_VELOCITY = -9.5 // velocity applied when flipping gravity

const SEGMENT_WIDTH = 80

// Obstacle (spike) config
const SPIKE_WIDTH = 24
const SPIKE_HEIGHT = 20

// Ground bump (wall) config
const BUMP_WIDTH = 30
const BUMP_HEIGHT = 50

// Floating platform config
const PLATFORM_THICKNESS = 28
const PLATFORM_MIN_WIDTH = 60
const PLATFORM_MAX_WIDTH = 160

// Colors matching the screenshot
const COLORS = {
  sky: ["#d4f0c0", "#b8e6a0", "#c8ebb0"], // gradient greens
  dirt: "#8B5E3C",
  dirtDark: "#6B3F2A",
  grass: "#4CAF50",
  grassLight: "#66BB6A",
  grassEdge: "#388E3C",
  cloud: "rgba(255,255,255,0.35)",
  player: {
    body: "#FFD54F",
    eye: "#FFFFFF",
    pupil: "#333333",
    beak: "#FF7043",
    wing: "#42A5F5",
    feet: "#FF7043",
  },
  sideWall: "#6B3F2A",
  sideWallEdge: "#4E8C3A",
}

// ─── Types ───────────────────────────────────────────────────────
type GameState = "idle" | "playing" | "gameover"
type GravityDirection = "down" | "up"

interface Segment {
  x: number
  width: number
  hasGround: boolean
  hasSpike?: boolean
  spikeSide?: "bottom" | "top"
  hasBump?: boolean
  bumpOffset?: number
  bumpSide?: "bottom" | "top"
}

interface CloudObj {
  x: number
  y: number
  w: number
  h: number
  speed: number
}

interface FloatingPlatform {
  x: number
  width: number
  y: number // top edge Y position in game coords
}

// ─── Main Component ──────────────────────────────────────────────
export function GravityRunGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const { emitGameEnd, resetEmitter } = useGameEndEmitter()

  const [gameState, setGameState] = useState<GameState>("idle")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Game state refs (mutable during animation loop)
  const gameStateRef = useRef<GameState>("idle")
  const scoreRef = useRef(0)
  const gravityRef = useRef<GravityDirection>("down")
  const playerYRef = useRef(GAME_HEIGHT - GROUND_THICKNESS - PLAYER_SIZE)
  const velocityYRef = useRef(0)
  const scrollSpeedRef = useRef(SCROLL_SPEED_INITIAL)
  const scrollOffsetRef = useRef(0)

  // Terrain
  const bottomSegmentsRef = useRef<Segment[]>([])
  const topSegmentsRef = useRef<Segment[]>([])
  const floatingPlatformsRef = useRef<FloatingPlatform[]>([])

  // Clouds (decoration)
  const cloudsRef = useRef<CloudObj[]>([])

  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null)

  // ─── Audio helpers ──────────────────────────────────────────────
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    return audioCtxRef.current
  }, [])

  const playJumpSound = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(400, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    } catch { /* noop */ }
  }, [getAudioCtx])

  const playDeathSound = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(300, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } catch { /* noop */ }
  }, [getAudioCtx])

  const playScoreSound = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.setValueAtTime(600, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.12)
    } catch { /* noop */ }
  }, [getAudioCtx])

  // ─── Terrain generation ─────────────────────────────────────────
  const generateSegments = useCallback((startX: number, count: number, existing: Segment[]): Segment[] => {
    const segs = [...existing]
    let x = startX

    // Progressive difficulty based on how far we've generated
    const distance = x / SEGMENT_WIDTH
    const difficulty = Math.min(1, distance / 300) // ramps 0→1 over ~300 segments

    // Pit chance: starts 30%, ramps to 45%
    const pitChance = 0.30 + difficulty * 0.15
    // Spike chance: starts 20%, ramps to 40%
    const spikeChance = 0.20 + difficulty * 0.20

    for (let i = 0; i < count; i++) {
      const isGap = Math.random() < pitChance && segs.length > 4
      if (isGap) {
        // Variable gap widths: 40px to 240px (0.5 to 3 segments) — small to medium pits
        const minGapPx = 40 + difficulty * 20
        const maxGapPx = 140 + difficulty * 100
        const width = Math.floor(minGapPx + Math.random() * (maxGapPx - minGapPx))
        segs.push({ x, width, hasGround: false })
        x += width
      } else {
        // Platforms: shorter as difficulty rises (more frequent pattern changes)
        const minPlat = Math.max(2, 4 - Math.floor(difficulty * 2))
        const maxPlat = Math.max(4, 8 - Math.floor(difficulty * 3))
        const platSegs = minPlat + Math.floor(Math.random() * (maxPlat - minPlat + 1))
        const width = platSegs * SEGMENT_WIDTH

        // Spike obstacles — can have multiple spikes on longer platforms
        const hasSpike = Math.random() < spikeChance && segs.length > 3
        // Bump obstacles (walls rising from ground surface)
        const bumpChance = 0.25 + difficulty * 0.20
        const hasBump = !hasSpike && Math.random() < bumpChance && segs.length > 3 && width >= BUMP_WIDTH * 3
        const bumpOffset = hasBump
          ? BUMP_WIDTH + Math.floor(Math.random() * (width - BUMP_WIDTH * 2))
          : undefined
        segs.push({
          x,
          width,
          hasGround: true,
          hasSpike,
          spikeSide: Math.random() < 0.5 ? "bottom" : "top",
          hasBump,
          bumpOffset,
          bumpSide: Math.random() < 0.5 ? "bottom" : "top",
        })
        x += width
      }
    }
    return segs
  }, [])

  // ─── Floating platform generation ───────────────────────────────
  const generateFloatingPlatforms = useCallback((startX: number, count: number, existing: FloatingPlatform[]): FloatingPlatform[] => {
    const plats = [...existing]
    let x = startX
    const minY = GROUND_THICKNESS + BUMP_HEIGHT + 30
    const maxY = GAME_HEIGHT - GROUND_THICKNESS - BUMP_HEIGHT - 30 - PLATFORM_THICKNESS

    for (let i = 0; i < count; i++) {
      // Space between platforms: 200-500px
      x += 200 + Math.floor(Math.random() * 300)
      const width = PLATFORM_MIN_WIDTH + Math.floor(Math.random() * (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH))
      const y = minY + Math.floor(Math.random() * (maxY - minY))
      plats.push({ x, width, y })
      x += width
    }
    return plats
  }, [])

  const initTerrain = useCallback(() => {
    // Start with solid ground under the player
    const initialPlatform: Segment = {
      x: 0,
      width: SEGMENT_WIDTH * 8,
      hasGround: true,
    }
    const bottom = generateSegments(initialPlatform.x + initialPlatform.width, 20, [initialPlatform])
    const topInitial: Segment = {
      x: 0,
      width: SEGMENT_WIDTH * 8,
      hasGround: true,
    }
    const top = generateSegments(topInitial.x + topInitial.width, 20, [topInitial])
    bottomSegmentsRef.current = bottom
    topSegmentsRef.current = top
    floatingPlatformsRef.current = generateFloatingPlatforms(SEGMENT_WIDTH * 10, 15, [])
  }, [generateSegments, generateFloatingPlatforms])

  // ─── Canvas sizing ──────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      // Keep aspect ratio but fill screen
      const scale = Math.min(vw / GAME_WIDTH, vh / GAME_HEIGHT)
      setCanvasSize({
        width: Math.floor(GAME_WIDTH * scale),
        height: Math.floor(GAME_HEIGHT * scale),
      })
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  // ─── High score persistence ─────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("gravity-run-highscore")
    if (stored) setHighScore(Number(stored))
  }, [])

  // ─── Init clouds ────────────────────────────────────────────────
  const initClouds = useCallback(() => {
    const clouds: CloudObj[] = []
    for (let i = 0; i < 8; i++) {
      clouds.push({
        x: Math.random() * GAME_WIDTH * 3,
        y: GROUND_THICKNESS + 30 + Math.random() * (GAME_HEIGHT - GROUND_THICKNESS * 2 - 100),
        w: 50 + Math.random() * 80,
        h: 20 + Math.random() * 25,
        speed: 0.2 + Math.random() * 0.4,
      })
    }
    cloudsRef.current = clouds
  }, [])

  // ─── Start game ─────────────────────────────────────────────────
  const startGame = useCallback(() => {
    gravityRef.current = "down"
    playerYRef.current = GAME_HEIGHT - GROUND_THICKNESS - PLAYER_SIZE
    velocityYRef.current = 0
    scrollSpeedRef.current = SCROLL_SPEED_INITIAL
    scrollOffsetRef.current = 0
    scoreRef.current = 0
    setScore(0)
    initTerrain()
    initClouds()
    gameStateRef.current = "playing"
    setGameState("playing")
    lastTimeRef.current = 0
    resetEmitter()
  }, [initTerrain, initClouds, resetEmitter])

  // ─── Handle tap/click ───────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (gameStateRef.current === "idle") {
      startGame()
      return
    }
    if (gameStateRef.current === "gameover") {
      startGame()
      return
    }
    if (gameStateRef.current === "playing") {
      // Flip gravity
      const wasDown = gravityRef.current === "down"
      gravityRef.current = wasDown ? "up" : "down"
      velocityYRef.current = wasDown ? JUMP_VELOCITY : -JUMP_VELOCITY
      playJumpSound()
    }
  }, [startGame, playJumpSound])

  // ─── Input listeners ────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "ArrowDown") {
        e.preventDefault()
        handleTap()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [handleTap])

  // ─── Drawing helpers ────────────────────────────────────────────
  const drawGrass = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, flipped: boolean) => {
    const zigzagHeight = 6
    const step = 8
    ctx.fillStyle = COLORS.grassEdge
    ctx.beginPath()
    if (!flipped) {
      // Grass on top of ground (bottom ground)
      ctx.moveTo(x, y)
      for (let px = x; px <= x + width; px += step) {
        const offset = (px % (step * 2) === 0) ? -zigzagHeight : 0
        ctx.lineTo(px, y + offset)
      }
      ctx.lineTo(x + width, y)
      ctx.lineTo(x + width, y + GRASS_THICKNESS)
      ctx.lineTo(x, y + GRASS_THICKNESS)
    } else {
      // Grass on bottom of ground (top ground)
      ctx.moveTo(x, y + GRASS_THICKNESS)
      for (let px = x; px <= x + width; px += step) {
        const offset = (px % (step * 2) === 0) ? zigzagHeight : 0
        ctx.lineTo(px, y + GRASS_THICKNESS + offset)
      }
      ctx.lineTo(x + width, y + GRASS_THICKNESS)
      ctx.lineTo(x + width, y)
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()

    // Green grass fill
    ctx.fillStyle = COLORS.grass
    if (!flipped) {
      ctx.fillRect(x, y, width, GRASS_THICKNESS - 2)
    } else {
      ctx.fillRect(x, y + 2, width, GRASS_THICKNESS - 2)
    }
  }

  const drawDirt = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
    ctx.fillStyle = COLORS.dirt
    ctx.fillRect(x, y, width, height)
    // Darker stripes for texture
    ctx.fillStyle = COLORS.dirtDark
    for (let i = 0; i < height; i += 12) {
      ctx.fillRect(x, y + i, width, 2)
    }
  }

  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, flipped: boolean) => {
    ctx.save()
    ctx.translate(x + PLAYER_SIZE / 2, y + PLAYER_SIZE / 2)
    if (flipped) ctx.scale(1, -1)

    const s = PLAYER_SIZE / 2

    // Body
    ctx.fillStyle = COLORS.player.body
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2)
    ctx.fill()

    // Eyes
    ctx.fillStyle = COLORS.player.eye
    ctx.beginPath()
    ctx.ellipse(-s * 0.25, -s * 0.2, s * 0.22, s * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(s * 0.25, -s * 0.2, s * 0.22, s * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()

    // Pupils
    ctx.fillStyle = COLORS.player.pupil
    ctx.beginPath()
    ctx.arc(-s * 0.2, -s * 0.2, s * 0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(s * 0.3, -s * 0.2, s * 0.1, 0, Math.PI * 2)
    ctx.fill()

    // Beak
    ctx.fillStyle = COLORS.player.beak
    ctx.beginPath()
    ctx.moveTo(s * 0.5, -s * 0.05)
    ctx.lineTo(s * 1.0, s * 0.05)
    ctx.lineTo(s * 0.5, s * 0.2)
    ctx.closePath()
    ctx.fill()

    // Wing
    ctx.fillStyle = COLORS.player.wing
    ctx.beginPath()
    ctx.ellipse(-s * 0.1, s * 0.15, s * 0.45, s * 0.25, -0.3, 0, Math.PI * 2)
    ctx.fill()

    // Feet
    ctx.fillStyle = COLORS.player.feet
    ctx.fillRect(-s * 0.35, s * 0.65, s * 0.2, s * 0.2)
    ctx.fillRect(s * 0.15, s * 0.65, s * 0.2, s * 0.2)

    ctx.restore()
  }

  const drawSpike = (ctx: CanvasRenderingContext2D, x: number, y: number, onTop: boolean) => {
    ctx.fillStyle = "#E53935"
    ctx.strokeStyle = "#B71C1C"
    ctx.lineWidth = 1.5
    const count = 3
    for (let i = 0; i < count; i++) {
      const sx = x + i * (SPIKE_WIDTH / count)
      const sw = SPIKE_WIDTH / count
      ctx.beginPath()
      if (!onTop) {
        // Spike pointing up (on bottom ground)
        ctx.moveTo(sx, y)
        ctx.lineTo(sx + sw / 2, y - SPIKE_HEIGHT)
        ctx.lineTo(sx + sw, y)
      } else {
        // Spike pointing down (on top ground)
        ctx.moveTo(sx, y)
        ctx.lineTo(sx + sw / 2, y + SPIKE_HEIGHT)
        ctx.lineTo(sx + sw, y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }

  const drawBump = (ctx: CanvasRenderingContext2D, bumpScreenX: number, groundY: number, isTop: boolean) => {
    const y = isTop ? groundY : groundY - BUMP_HEIGHT
    // Main block
    ctx.fillStyle = COLORS.dirt
    ctx.fillRect(bumpScreenX, y, BUMP_WIDTH, BUMP_HEIGHT)
    // Dirt texture stripes
    ctx.fillStyle = COLORS.dirtDark
    for (let i = 0; i < BUMP_HEIGHT; i += 10) {
      ctx.fillRect(bumpScreenX, y + i, BUMP_WIDTH, 2)
    }
    // Grass cap
    ctx.fillStyle = COLORS.grassEdge
    if (!isTop) {
      ctx.fillRect(bumpScreenX, y, BUMP_WIDTH, 6)
      ctx.fillStyle = COLORS.grass
      ctx.fillRect(bumpScreenX, y + 1, BUMP_WIDTH, 4)
    } else {
      ctx.fillRect(bumpScreenX, y + BUMP_HEIGHT - 6, BUMP_WIDTH, 6)
      ctx.fillStyle = COLORS.grass
      ctx.fillRect(bumpScreenX, y + BUMP_HEIGHT - 5, BUMP_WIDTH, 4)
    }
    // Outline
    ctx.strokeStyle = "#5D4037"
    ctx.lineWidth = 1.5
    ctx.strokeRect(bumpScreenX, y, BUMP_WIDTH, BUMP_HEIGHT)
  }

  const drawFloatingPlatform = (ctx: CanvasRenderingContext2D, screenX: number, y: number, width: number) => {
    const h = PLATFORM_THICKNESS
    const brickH = 14
    const brickW = 20
    const brickColors = ["#C62828", "#D32F2F", "#B71C1C", "#E53935", "#C94030"]
    const mortarColor = "#A1887F"
    const highlightColor = "rgba(255,255,255,0.15)"
    const shadowColor = "rgba(0,0,0,0.18)"

    // Mortar / background fill
    ctx.fillStyle = mortarColor
    ctx.fillRect(screenX, y, width, h)

    // Save clip region so bricks don't overflow
    ctx.save()
    ctx.beginPath()
    ctx.rect(screenX, y, width, h)
    ctx.clip()

    // Draw brick rows
    let colorIdx = 0
    for (let row = 0; row * brickH < h; row++) {
      const by = y + row * brickH
      const offsetX = row % 2 === 0 ? 0 : brickW / 2
      for (let col = -1; col * brickW < width + brickW; col++) {
        const bx = screenX + col * brickW + offsetX
        const bw = brickW - 2  // gap for mortar
        const bh = brickH - 2

        // Pick color (deterministic based on position for consistency)
        ctx.fillStyle = brickColors[(colorIdx++) % brickColors.length]
        ctx.fillRect(bx + 1, by + 1, bw, bh)

        // Highlight on top-left edges
        ctx.fillStyle = highlightColor
        ctx.fillRect(bx + 1, by + 1, bw, 2)
        ctx.fillRect(bx + 1, by + 1, 2, bh)

        // Shadow on bottom-right edges
        ctx.fillStyle = shadowColor
        ctx.fillRect(bx + 1, by + bh - 1, bw, 2)
        ctx.fillRect(bx + bw - 1, by + 1, 2, bh)
      }
    }

    ctx.restore()

    // Top edge accent
    ctx.fillStyle = "#FF8A65"
    ctx.fillRect(screenX, y, width, 2)
    // Bottom edge accent
    ctx.fillStyle = "#FF8A65"
    ctx.fillRect(screenX, y + h - 2, width, 2)

    // Outline
    ctx.strokeStyle = "#4E342E"
    ctx.lineWidth = 2
    ctx.strokeRect(screenX, y, width, h)
  }

  const drawCloud = (ctx: CanvasRenderingContext2D, cloud: CloudObj, offset: number) => {
    const cx = cloud.x - offset * cloud.speed
    // Wrap clouds
    const wrappedX = ((cx % (GAME_WIDTH * 2)) + GAME_WIDTH * 2) % (GAME_WIDTH * 2) - GAME_WIDTH * 0.5
    ctx.fillStyle = COLORS.cloud
    ctx.beginPath()
    ctx.ellipse(wrappedX, cloud.y, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(wrappedX - cloud.w * 0.25, cloud.y + cloud.h * 0.1, cloud.w * 0.3, cloud.h * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(wrappedX + cloud.w * 0.25, cloud.y - cloud.h * 0.05, cloud.w * 0.35, cloud.h * 0.38, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // ─── Side wall (decorative vertical borders) ───────────────────
  const WALL_WIDTH = 12

  const drawSideWalls = (ctx: CanvasRenderingContext2D) => {
    // Left wall
    ctx.fillStyle = COLORS.sideWall
    ctx.fillRect(0, 0, WALL_WIDTH, GAME_HEIGHT)
    ctx.fillStyle = COLORS.sideWallEdge
    ctx.fillRect(WALL_WIDTH - 3, 0, 3, GAME_HEIGHT)

    // Right wall
    ctx.fillStyle = COLORS.sideWall
    ctx.fillRect(GAME_WIDTH - WALL_WIDTH, 0, WALL_WIDTH, GAME_HEIGHT)
    ctx.fillStyle = COLORS.sideWallEdge
    ctx.fillRect(GAME_WIDTH - WALL_WIDTH, 0, 3, GAME_HEIGHT)
  }

  // ─── Collision detection ────────────────────────────────────────
  const checkCollision = useCallback((): boolean => {
    const py = playerYRef.current
    const offset = scrollOffsetRef.current
    const margin = 4

    const playerLeft = PLAYER_X + margin
    const playerRight = PLAYER_X + PLAYER_SIZE - margin
    const playerTop = py + margin
    const playerBottom = py + PLAYER_SIZE - margin

    // Check bottom ground segments
    for (const seg of bottomSegmentsRef.current) {
      const segLeft = seg.x - offset
      const segRight = segLeft + seg.width
      if (playerRight > segLeft && playerLeft < segRight && seg.hasGround) {
        // Spike
        if (seg.hasSpike && seg.spikeSide === "bottom") {
          const spikeX = segLeft + seg.width / 2 - SPIKE_WIDTH / 2
          const spikeRight = spikeX + SPIKE_WIDTH
          const spikeTop = GAME_HEIGHT - GROUND_THICKNESS - SPIKE_HEIGHT
          if (playerRight > spikeX && playerLeft < spikeRight && playerBottom > spikeTop) return true
        }
        // Bump — only die if hitting the left side
        if (seg.hasBump && seg.bumpOffset != null) {
          const bx = segLeft + seg.bumpOffset
          const bRight = bx + BUMP_WIDTH
          const bTop = GAME_HEIGHT - GROUND_THICKNESS - BUMP_HEIGHT
          const bBottom = GAME_HEIGHT - GROUND_THICKNESS
          // Player overlaps bump area
          if (playerRight > bx && playerLeft < bRight && playerBottom > bTop && playerTop < bBottom) {
            // Side hit: player's right edge is within the left portion of the bump
            const overlapFromLeft = playerRight - bx
            const overlapFromTop = playerBottom - bTop
            // If horizontal overlap is smaller, it's a side collision → die
            if (overlapFromLeft < overlapFromTop) return true
          }
        }
      }
    }

    // Check top ground segments
    for (const seg of topSegmentsRef.current) {
      const segLeft = seg.x - offset
      const segRight = segLeft + seg.width
      if (playerRight > segLeft && playerLeft < segRight && seg.hasGround) {
        // Spike
        if (seg.hasSpike && seg.spikeSide === "top") {
          const spikeX = segLeft + seg.width / 2 - SPIKE_WIDTH / 2
          const spikeRight = spikeX + SPIKE_WIDTH
          const spikeBottom = GROUND_THICKNESS + SPIKE_HEIGHT
          if (playerRight > spikeX && playerLeft < spikeRight && playerTop < spikeBottom) return true
        }
        // Bump — only die if hitting the bottom side (underside hit)
        if (seg.hasBump && seg.bumpOffset != null) {
          const bx = segLeft + seg.bumpOffset
          const bRight = bx + BUMP_WIDTH
          const bTop = GROUND_THICKNESS
          const bBottom = GROUND_THICKNESS + BUMP_HEIGHT
          if (playerRight > bx && playerLeft < bRight && playerBottom > bTop && playerTop < bBottom) {
            const overlapFromLeft = playerRight - bx
            const overlapFromBottom = bBottom - playerTop
            if (overlapFromLeft < overlapFromBottom) return true
          }
        }
      }
    }

    // Check floating platforms — side collision only
    for (const plat of floatingPlatformsRef.current) {
      const px = plat.x - offset
      const pRight = px + plat.width
      const pTop = plat.y
      const pBottom = plat.y + PLATFORM_THICKNESS
      if (playerRight > px && playerLeft < pRight && playerBottom > pTop && playerTop < pBottom) {
        const overlapFromLeft = playerRight - px
        const overlapFromTop = playerBottom - pTop
        const overlapFromBottom = pBottom - playerTop
        const vertOverlap = Math.min(overlapFromTop, overlapFromBottom)
        if (overlapFromLeft < vertOverlap) return true
      }
    }

    return false
  }, [])

  // ─── Game loop ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time
      const _dt = (time - lastTimeRef.current) / 16.67 // normalize to ~60fps
      const dt = Math.min(_dt, 3) // cap delta
      lastTimeRef.current = time

      // Scale canvas
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const scaleX = canvas.width / GAME_WIDTH
      const scaleY = canvas.height / GAME_HEIGHT
      ctx.scale(scaleX, scaleY)

      // ── Background gradient ──
      const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT)
      bgGrad.addColorStop(0, COLORS.sky[0])
      bgGrad.addColorStop(0.5, COLORS.sky[1])
      bgGrad.addColorStop(1, COLORS.sky[2])
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

      const offset = scrollOffsetRef.current

      // ── Draw clouds ──
      for (const cloud of cloudsRef.current) {
        drawCloud(ctx, cloud, offset)
      }

      if (gameStateRef.current === "playing") {
        // Update scroll
        scrollSpeedRef.current = Math.min(SCROLL_SPEED_MAX, scrollSpeedRef.current + SCROLL_SPEED_INCREMENT * dt)
        scrollOffsetRef.current += scrollSpeedRef.current * dt

        // Update score
        const newScore = Math.floor(scrollOffsetRef.current / 50)
        if (newScore > scoreRef.current) {
          if (newScore % 10 === 0 && newScore > 0) playScoreSound()
          scoreRef.current = newScore
          setScore(newScore)
        }

        // Gravity & physics
        const gravity = gravityRef.current
        const gForce = gravity === "down" ? GRAVITY_STRENGTH : -GRAVITY_STRENGTH
        velocityYRef.current += gForce * dt
        playerYRef.current += velocityYRef.current * dt

        // Check if player is over solid ground before clamping
        const playerLeft = PLAYER_X + 4
        const playerRight = PLAYER_X + PLAYER_SIZE - 4
        const currentOffset = scrollOffsetRef.current

        let hasBottomGround = false
        let hasTopGround = false

        for (const seg of bottomSegmentsRef.current) {
          const segLeft = seg.x - currentOffset
          const segRight = segLeft + seg.width
          if (playerRight > segLeft && playerLeft < segRight && seg.hasGround) {
            hasBottomGround = true
            break
          }
        }

        for (const seg of topSegmentsRef.current) {
          const segLeft = seg.x - currentOffset
          const segRight = segLeft + seg.width
          if (playerRight > segLeft && playerLeft < segRight && seg.hasGround) {
            hasTopGround = true
            break
          }
        }

        // Only clamp to ground if there IS solid ground; otherwise let player fall
        const bottomGroundY = GAME_HEIGHT - GROUND_THICKNESS - PLAYER_SIZE
        const topGroundY = GROUND_THICKNESS

        if (gravity === "down") {
          // Check if landing on top of a floating platform
          let landedOnPlatform = false
          for (const plat of floatingPlatformsRef.current) {
            const px = plat.x - currentOffset
            const pRight = px + plat.width
            if (playerRight > px && playerLeft < pRight) {
              const platLandY = plat.y - PLAYER_SIZE
              if (playerYRef.current >= platLandY && playerYRef.current < plat.y + PLATFORM_THICKNESS && velocityYRef.current >= 0) {
                playerYRef.current = platLandY
                velocityYRef.current = 0
                landedOnPlatform = true
                break
              }
            }
          }
          // Check if landing on top of a bottom bump
          let landedOnBump = false
          if (!landedOnPlatform) {
          for (const seg of bottomSegmentsRef.current) {
            if (!seg.hasBump || !seg.hasGround || seg.bumpOffset == null) continue
            const bx = seg.x - currentOffset + seg.bumpOffset
            const bRight = bx + BUMP_WIDTH
            const bTop = GAME_HEIGHT - GROUND_THICKNESS - BUMP_HEIGHT
            if (playerRight > bx && playerLeft < bRight) {
              const bumpLandY = bTop - PLAYER_SIZE
              if (playerYRef.current >= bumpLandY && velocityYRef.current >= 0) {
                playerYRef.current = bumpLandY
                velocityYRef.current = 0
                landedOnBump = true
                break
              }
            }
          }
          if (!landedOnBump && !landedOnPlatform && hasBottomGround && playerYRef.current >= bottomGroundY) {
            playerYRef.current = bottomGroundY
            velocityYRef.current = 0
          }
          }
        } else {
          // Check if landing on underside of a floating platform
          let landedOnPlatform = false
          for (const plat of floatingPlatformsRef.current) {
            const px = plat.x - currentOffset
            const pRight = px + plat.width
            if (playerRight > px && playerLeft < pRight) {
              const platLandY = plat.y + PLATFORM_THICKNESS
              if (playerYRef.current <= platLandY && playerYRef.current > plat.y - PLAYER_SIZE && velocityYRef.current <= 0) {
                playerYRef.current = platLandY
                velocityYRef.current = 0
                landedOnPlatform = true
                break
              }
            }
          }
          // Check if landing on underside of a top bump
          let landedOnBump = false
          if (!landedOnPlatform) {
          for (const seg of topSegmentsRef.current) {
            if (!seg.hasBump || !seg.hasGround || seg.bumpOffset == null) continue
            const bx = seg.x - currentOffset + seg.bumpOffset
            const bRight = bx + BUMP_WIDTH
            const bBottom = GROUND_THICKNESS + BUMP_HEIGHT
            if (playerRight > bx && playerLeft < bRight) {
              const bumpLandY = bBottom
              if (playerYRef.current <= bumpLandY && velocityYRef.current <= 0) {
                playerYRef.current = bumpLandY
                velocityYRef.current = 0
                landedOnBump = true
                break
              }
            }
          }
          if (!landedOnBump && !landedOnPlatform && hasTopGround && playerYRef.current <= topGroundY) {
            playerYRef.current = topGroundY
            velocityYRef.current = 0
          }
          }
        }

        // Die if player falls off screen (into a pit)
        if (playerYRef.current > GAME_HEIGHT + PLAYER_SIZE || playerYRef.current < -PLAYER_SIZE * 2) {
          gameStateRef.current = "gameover"
          setGameState("gameover")
          emitGameEnd("gravity-run", scoreRef.current)
          playDeathSound()
          const finalScore = scoreRef.current
          if (finalScore > highScore) {
            setHighScore(finalScore)
            localStorage.setItem("gravity-run-highscore", String(finalScore))
          }
        }

        // Extend terrain as needed
        const furthestBottom = bottomSegmentsRef.current.length > 0
          ? bottomSegmentsRef.current[bottomSegmentsRef.current.length - 1].x + bottomSegmentsRef.current[bottomSegmentsRef.current.length - 1].width
          : 0
        if (furthestBottom - offset < GAME_WIDTH * 3) {
          bottomSegmentsRef.current = generateSegments(furthestBottom, 10, bottomSegmentsRef.current)
        }
        const furthestTop = topSegmentsRef.current.length > 0
          ? topSegmentsRef.current[topSegmentsRef.current.length - 1].x + topSegmentsRef.current[topSegmentsRef.current.length - 1].width
          : 0
        if (furthestTop - offset < GAME_WIDTH * 3) {
          topSegmentsRef.current = generateSegments(furthestTop, 10, topSegmentsRef.current)
        }

        // Extend floating platforms as needed
        const furthestPlat = floatingPlatformsRef.current.length > 0
          ? floatingPlatformsRef.current[floatingPlatformsRef.current.length - 1].x + floatingPlatformsRef.current[floatingPlatformsRef.current.length - 1].width
          : 0
        if (furthestPlat - offset < GAME_WIDTH * 3) {
          floatingPlatformsRef.current = generateFloatingPlatforms(furthestPlat, 8, floatingPlatformsRef.current)
        }

        // Cleanup off-screen segments
        bottomSegmentsRef.current = bottomSegmentsRef.current.filter(s => s.x + s.width - offset > -200)
        topSegmentsRef.current = topSegmentsRef.current.filter(s => s.x + s.width - offset > -200)
        floatingPlatformsRef.current = floatingPlatformsRef.current.filter(p => p.x + p.width - offset > -200)

        // Collision (spikes & bumps)
        if (checkCollision()) {
          gameStateRef.current = "gameover"
          setGameState("gameover")
          emitGameEnd("gravity-run", scoreRef.current)
          playDeathSound()
          const finalScore = scoreRef.current
          if (finalScore > highScore) {
            setHighScore(finalScore)
            localStorage.setItem("gravity-run-highscore", String(finalScore))
          }
        }
      }

      // ── Draw bottom ground segments ──
      for (const seg of bottomSegmentsRef.current) {
        const sx = seg.x - offset
        if (sx > GAME_WIDTH + 50 || sx + seg.width < -50) continue
        if (seg.hasGround) {
          const groundY = GAME_HEIGHT - GROUND_THICKNESS
          drawDirt(ctx, sx, groundY + GRASS_THICKNESS, seg.width, GROUND_THICKNESS - GRASS_THICKNESS)
          drawGrass(ctx, sx, groundY, seg.width, false)

          // Spike
          if (seg.hasSpike && seg.spikeSide === "bottom") {
            drawSpike(ctx, sx + seg.width / 2 - SPIKE_WIDTH / 2, groundY, false)
          }
          // Bump
          if (seg.hasBump && seg.bumpOffset != null) {
            const bumpScreenX = seg.x + seg.bumpOffset - offset
            drawBump(ctx, bumpScreenX, groundY, false)
          }
        }
      }

      // ── Draw top ground segments ──
      for (const seg of topSegmentsRef.current) {
        const sx = seg.x - offset
        if (sx > GAME_WIDTH + 50 || sx + seg.width < -50) continue
        if (seg.hasGround) {
          drawDirt(ctx, sx, 0, seg.width, GROUND_THICKNESS - GRASS_THICKNESS)
          drawGrass(ctx, sx, GROUND_THICKNESS - GRASS_THICKNESS, seg.width, true)

          // Spike
          if (seg.hasSpike && seg.spikeSide === "top") {
            drawSpike(ctx, sx + seg.width / 2 - SPIKE_WIDTH / 2, GROUND_THICKNESS, true)
          }
          // Bump
          if (seg.hasBump && seg.bumpOffset != null) {
            const bumpScreenX = seg.x + seg.bumpOffset - offset
            drawBump(ctx, bumpScreenX, GROUND_THICKNESS, true)
          }
        }
      }

      // ── Side walls ──
      drawSideWalls(ctx)

      // ── Draw floating platforms ──
      for (const plat of floatingPlatformsRef.current) {
        const px = plat.x - offset
        if (px > GAME_WIDTH + 50 || px + plat.width < -50) continue
        drawFloatingPlatform(ctx, px, plat.y, plat.width)
      }

      // ── Player ──
      const isFlipped = gravityRef.current === "up"
      drawPlayer(ctx, PLAYER_X, playerYRef.current, isFlipped)

      // ── HUD ──
      // Score badge (top left)
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      ctx.beginPath()
      ctx.arc(38, 38, 28, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#333"
      ctx.font = "bold 14px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(scoreRef.current), 38, 38)

      // ── Idle screen ──
      if (gameStateRef.current === "idle") {
        ctx.fillStyle = "rgba(0,0,0,0.35)"
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

        ctx.fillStyle = "#fff"
        ctx.font = "bold 36px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("GRAVITY RUN", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60)

        ctx.font = "18px sans-serif"
        ctx.fillText("Tap to flip gravity!", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15)
        ctx.fillText("Avoid pits, bumps & spikes!", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 15)

        ctx.font = "bold 20px sans-serif"
        ctx.fillStyle = "#4CAF50"
        ctx.fillText("TAP TO START", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70)

        if (highScore > 0) {
          ctx.fillStyle = "#FFD54F"
          ctx.font = "16px sans-serif"
          ctx.fillText(`Best: ${highScore}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 110)
        }
      }

      // ── Game over screen ──
      if (gameStateRef.current === "gameover") {
        ctx.fillStyle = "rgba(0,0,0,0.5)"
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

        ctx.fillStyle = "#E53935"
        ctx.font = "bold 36px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("GAME OVER", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50)

        ctx.fillStyle = "#fff"
        ctx.font = "24px sans-serif"
        ctx.fillText(`Score: ${scoreRef.current}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 5)

        ctx.fillStyle = "#FFD54F"
        ctx.font = "18px sans-serif"
        ctx.fillText(`Best: ${Math.max(scoreRef.current, highScore)}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40)

        ctx.fillStyle = "#4CAF50"
        ctx.font = "bold 18px sans-serif"
        ctx.fillText("TAP TO RETRY", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90)
      }

      ctx.restore()
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [canvasSize, highScore, checkCollision, generateSegments, generateFloatingPlatforms, playDeathSound, playScoreSound])

  // ─── Exit handler ───────────────────────────────────────────────
  const handleExit = useCallback(() => {
    gameStateRef.current = "idle"
    setGameState("idle")
    window.history.back()
  }, [])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black select-none"
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          cursor: "pointer",
        }}
        onClick={handleTap}
        onTouchStart={(e) => {
          e.preventDefault()
          handleTap()
        }}
      />

      {/* Exit button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          handleExit()
        }}
        onTouchStart={(e) => {
          e.stopPropagation()
        }}
        className="absolute bottom-4 right-4 bg-white/90 text-gray-900 font-bold px-4 py-2 rounded-full text-sm shadow-lg hover:bg-white transition-colors z-10"
        style={{ touchAction: "manipulation" }}
      >
        EXIT
      </button>
    </div>
  )
}
