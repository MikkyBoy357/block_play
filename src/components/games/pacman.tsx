"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useGameSession } from "@/hooks/use-game-session"

// ─── Grid Constants ──────────────────────────────────────────────────────────
const CELL = 20
const COLS = 28
const ROWS = 31
const WIDTH = COLS * CELL
const HEIGHT = ROWS * CELL
const GHOST_SCORE_BASE = 200

type Direction = "up" | "down" | "left" | "right" | "none"
type GhostMode = "chase" | "scatter" | "frightened" | "eyes"
type GamePhase = "idle" | "ready" | "playing" | "dying" | "levelComplete" | "gameover"

interface Position { x: number; y: number }

interface ScorePopup {
  x: number; y: number; text: string; time: number; color: string
}

interface Fruit {
  type: number; x: number; y: number; timer: number; score: number; symbol: string
}

// ─── Original Pac-Man Level Specifications ───────────────────────────────────
// Speeds are in pixels per frame (at 60fps). Original base ~75.75 px/s.
// We use CELL=20, so base unit = ~1.27 px/frame at 100%.
const BASE_SPEED = 1.40

interface LevelSpec {
  pacSpeed: number
  pacDotSpeed: number
  ghostSpeed: number
  ghostTunnelSpeed: number
  ghostFrightSpeed: number
  frightTime: number        // seconds (0 = no fright)
  frightFlashes: number
  elroy1Dots: number
  elroy1Speed: number
  elroy2Dots: number
  elroy2Speed: number
  fruit: { symbol: string; score: number }
  scatterChase: number[]   // alternating scatter/chase durations in seconds
}

// Single brutal difficulty — ghosts are fast, ALWAYS chase, no scatter
const BRUTAL_SPEC: LevelSpec = {
  pacSpeed: 0.85, pacDotSpeed: 0.75, ghostSpeed: 1.15, ghostTunnelSpeed: 0.80, ghostFrightSpeed: 0.75,
  frightTime: 0.6, frightFlashes: 1, elroy1Dots: 70, elroy1Speed: 1.22, elroy2Dots: 40, elroy2Speed: 1.30,
  fruit: { symbol: "🍒", score: 100 },
  scatterChase: [0, Infinity],  // 0s scatter → infinite chase = pure hunt mode
}

// Ghosts get slightly faster each maze cleared (keeps competitive scaling)
const LEVEL_SPECS: LevelSpec[] = Array.from({ length: 20 }, (_, i) => ({
  ...BRUTAL_SPEC,
  ghostSpeed: Math.min(BRUTAL_SPEC.ghostSpeed + i * 0.025, 1.55),
  ghostTunnelSpeed: Math.min(BRUTAL_SPEC.ghostTunnelSpeed + i * 0.02, 1.05),
  elroy1Speed: Math.min(BRUTAL_SPEC.elroy1Speed + i * 0.025, 1.55),
  elroy2Speed: Math.min(BRUTAL_SPEC.elroy2Speed + i * 0.025, 1.60),
  frightTime: Math.max(0.6 - Math.floor(i / 2) * 0.3, 0),  // no fright after maze 2
  frightFlashes: i < 2 ? 1 : 0,
  fruit: [
    { symbol: "🍒", score: 100 }, { symbol: "🍓", score: 300 },
    { symbol: "🍑", score: 500 }, { symbol: "🍎", score: 700 },
    { symbol: "🍈", score: 1000 }, { symbol: "🛸", score: 2000 },
    { symbol: "🔔", score: 3000 }, { symbol: "🔑", score: 5000 },
  ][Math.min(i, 7)],
}))


function getLevelSpec(level: number): LevelSpec {
  const idx = Math.min(level - 1, LEVEL_SPECS.length - 1)
  return LEVEL_SPECS[idx]
}

// All ghosts released immediately — no waiting
function getGhostReleaseDots(_level: number): number[] {
  return [0, 0, 0]
}

interface Ghost {
  pos: Position
  dir: Direction
  mode: GhostMode
  color: string
  scatterTarget: Position
  prevMode: GhostMode
  name: string
  inHouse: boolean
  dotCounter: number
  releaseThreshold: number
  reverseQueued: boolean
  decidedAtCell: boolean
}

// Original Pac-Man maze layout (28×31)
// 0=empty, 1=wall, 2=dot, 3=power pellet, 4=ghost house, 5=ghost door
const MAZE_TEMPLATE: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,3,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,3,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
  [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
  [0,0,0,0,0,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,1,1,1,5,5,1,1,1,0,1,1,2,1,0,0,0,0,0],
  [1,1,1,1,1,1,2,1,1,0,1,4,4,4,4,4,4,1,0,1,1,2,1,1,1,1,1,1],
  [0,0,0,0,0,0,2,0,0,0,1,4,4,4,4,4,4,1,0,0,0,2,0,0,0,0,0,0],
  [1,1,1,1,1,1,2,1,1,0,1,4,4,4,4,4,4,1,0,1,1,2,1,1,1,1,1,1],
  [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
  [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,3,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,3,1],
  [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
  [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
  [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
]

// Colors
const WALL_COLOR = "#1a1a6e"
const WALL_BORDER_COLOR = "#2929ff"
const DOT_COLOR = "#ffb8ae"
const POWER_COLOR = "#ffb8ae"
const BG_COLOR = "#000000"
const PACMAN_COLOR = "#ffff00"
const FRIGHTENED_COLOR = "#2121de"
const FRIGHTENED_END_COLOR = "#ffffff"
const GHOST_DOOR_COLOR = "#ffb8de"

// ─── Component ───────────────────────────────────────────────────────────────
export function PacmanGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const accumulatorRef = useRef<number>(0)

  const [gamePhase, setGamePhase] = useState<GamePhase>("idle")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [canvasScale, setCanvasScale] = useState(1)

  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const levelRef = useRef(1)
  const phaseRef = useRef<GamePhase>("idle")
  const ghostScoreMultiplier = useRef(1)
  const extraLifeGiven = useRef(false)

  // Maze state
  const mazeRef = useRef<number[][]>([])
  const totalDotsRef = useRef(0)
  const eatenDotsRef = useRef(0)
  const globalDotCounter = useRef(0)

  // Pac-Man state
  const pacmanRef = useRef<{
    x: number; y: number
    dir: Direction; nextDir: Direction
    mouthAngle: number; mouthDir: number
    deathFrame: number
    moving: boolean
  }>({
    x: 14 * CELL, y: 23 * CELL + CELL / 2,
    dir: "left", nextDir: "left",
    mouthAngle: 0.2, mouthDir: 1,
    deathFrame: 0, moving: false,
  })

  // Ghost state
  const ghostsRef = useRef<Ghost[]>([])
  const frightenedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frightenedStartRef = useRef(0)

  // Scatter/Chase mode timing
  const modeTimerRef = useRef(0)
  const modeIndexRef = useRef(0)
  const globalModeRef = useRef<"scatter" | "chase">("scatter")

  // Fruit
  const fruitRef = useRef<Fruit | null>(null)
  const fruitShownCount = useRef(0)

  // Score popups
  const popupsRef = useRef<ScorePopup[]>([])

  // Animation timers
  const readyTimerRef = useRef(0)
  const deathTimerRef = useRef(0)
  const levelCompleteTimerRef = useRef(0)
  const levelFlashRef = useRef(0)

  // Waka alternation
  const wakaToggle = useRef(false)

  // Siren oscillator refs
  const sirenOscRef = useRef<OscillatorNode | null>(null)
  const sirenGainRef = useRef<GainNode | null>(null)
  const sirenLfoRef = useRef<OscillatorNode | null>(null)
  const frightenedOscRef = useRef<OscillatorNode | null>(null)
  const frightenedGainRef = useRef<GainNode | null>(null)
  const frightenedLfoRef = useRef<OscillatorNode | null>(null)

  // Audio context
  const audioCtxRef = useRef<AudioContext | null>(null)

  const { startGame, recordAction, endGame } = useGameSession()

  // ─── Audio Context ───────────────────────────────────────────────────────
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )()
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }, [])

  // ─── Authentic Sound Effects ─────────────────────────────────────────────

  // Waka-waka: alternating two-tone, like the original
  const playWaka = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "triangle"
      const high = wakaToggle.current
      wakaToggle.current = !wakaToggle.current
      if (high) {
        osc.frequency.setValueAtTime(293.66, t)     // D4
        osc.frequency.exponentialRampToValueAtTime(196.00, t + 0.06) // G3
      } else {
        osc.frequency.setValueAtTime(261.63, t)     // C4
        osc.frequency.exponentialRampToValueAtTime(174.61, t + 0.06) // F3
      }
      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
      osc.start(t)
      osc.stop(t + 0.07)
    } catch { /* */ }
  }, [getAudioCtx])

  // Power pellet eaten: ascending arpeggio
  const playPowerPellet = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]
      for (let i = 0; i < notes.length; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = "square"
        const start = t + i * 0.04
        osc.frequency.setValueAtTime(notes[i], start)
        gain.gain.setValueAtTime(0.12, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08)
        osc.start(start)
        osc.stop(start + 0.08)
      }
    } catch { /* */ }
  }, [getAudioCtx])

  // Eat ghost: ascending sweep
  const playEatGhost = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.type = "sawtooth"
      osc1.frequency.setValueAtTime(196, t)
      osc1.frequency.exponentialRampToValueAtTime(1568, t + 0.35)
      gain1.gain.setValueAtTime(0.12, t)
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc1.start(t)
      osc1.stop(t + 0.4)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.type = "square"
      osc2.frequency.setValueAtTime(392, t + 0.05)
      osc2.frequency.exponentialRampToValueAtTime(2093, t + 0.3)
      gain2.gain.setValueAtTime(0.06, t + 0.05)
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc2.start(t + 0.05)
      osc2.stop(t + 0.35)
    } catch { /* */ }
  }, [getAudioCtx])

  // Death: descending spiral like original
  const playDeath = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const sequence = [
        { freq: 554, dur: 0.12, start: 0 },
        { freq: 523, dur: 0.12, start: 0.12 },
        { freq: 494, dur: 0.12, start: 0.24 },
        { freq: 466, dur: 0.12, start: 0.36 },
        { freq: 440, dur: 0.12, start: 0.48 },
        { freq: 415, dur: 0.12, start: 0.60 },
        { freq: 392, dur: 0.12, start: 0.72 },
        { freq: 370, dur: 0.15, start: 0.84 },
        { freq: 349, dur: 0.15, start: 0.99 },
        { freq: 330, dur: 0.15, start: 1.14 },
        { freq: 311, dur: 0.20, start: 1.29 },
        { freq: 294, dur: 0.20, start: 1.49 },
      ]
      for (const n of sequence) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = "sine"
        osc.frequency.setValueAtTime(n.freq, t + n.start)
        gain.gain.setValueAtTime(0.18, t + n.start)
        gain.gain.setValueAtTime(0.18, t + n.start + n.dur * 0.7)
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.start + n.dur)
        osc.start(t + n.start)
        osc.stop(t + n.start + n.dur)
      }
    } catch { /* */ }
  }, [getAudioCtx])

  // Game start intro jingle
  const playIntro = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const melody: { freq: number; start: number; dur: number; type: OscillatorType }[] = [
        { freq: 246.94, start: 0.0, dur: 0.16, type: "square" },
        { freq: 261.63, start: 0.16, dur: 0.16, type: "square" },
        { freq: 293.66, start: 0.32, dur: 0.16, type: "square" },
        { freq: 261.63, start: 0.48, dur: 0.16, type: "square" },
        { freq: 246.94, start: 0.72, dur: 0.16, type: "square" },
        { freq: 261.63, start: 0.88, dur: 0.16, type: "square" },
        { freq: 293.66, start: 1.04, dur: 0.32, type: "square" },
        { freq: 246.94, start: 1.44, dur: 0.16, type: "square" },
        { freq: 261.63, start: 1.60, dur: 0.16, type: "square" },
        { freq: 293.66, start: 1.76, dur: 0.16, type: "square" },
        { freq: 261.63, start: 1.92, dur: 0.16, type: "square" },
        { freq: 220.00, start: 2.16, dur: 0.16, type: "square" },
        { freq: 220.00, start: 2.36, dur: 0.16, type: "square" },
        { freq: 233.08, start: 2.56, dur: 0.32, type: "square" },
        { freq: 130.81, start: 0.0, dur: 0.32, type: "triangle" },
        { freq: 130.81, start: 0.72, dur: 0.32, type: "triangle" },
        { freq: 130.81, start: 1.44, dur: 0.32, type: "triangle" },
        { freq: 110.00, start: 2.16, dur: 0.64, type: "triangle" },
      ]
      for (const n of melody) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = n.type
        osc.frequency.setValueAtTime(n.freq, t + n.start)
        const vol = n.type === "triangle" ? 0.08 : 0.10
        gain.gain.setValueAtTime(vol, t + n.start)
        gain.gain.setValueAtTime(vol, t + n.start + n.dur * 0.8)
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.start + n.dur)
        osc.start(t + n.start)
        osc.stop(t + n.start + n.dur + 0.01)
      }
    } catch { /* */ }
  }, [getAudioCtx])

  // Level complete sound
  const playLevelComplete = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      for (let i = 0; i < 8; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = "square"
        osc.frequency.setValueAtTime(i % 2 === 0 ? 1047 : 1319, t + i * 0.15)
        gain.gain.setValueAtTime(0.08, t + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.12)
        osc.start(t + i * 0.15)
        osc.stop(t + i * 0.15 + 0.14)
      }
    } catch { /* */ }
  }, [getAudioCtx])

  // Eat fruit
  const playEatFruit = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const notes = [523, 784, 1047]
      for (let i = 0; i < notes.length; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = "sine"
        osc.frequency.setValueAtTime(notes[i], t + i * 0.06)
        gain.gain.setValueAtTime(0.15, t + i * 0.06)
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.1)
        osc.start(t + i * 0.06)
        osc.stop(t + i * 0.06 + 0.12)
      }
    } catch { /* */ }
  }, [getAudioCtx])

  // Extra life jingle
  const playExtraLife = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const notes = [523, 659, 784, 1047, 1319, 1568]
      for (let i = 0; i < notes.length; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = "sine"
        osc.frequency.setValueAtTime(notes[i], t + i * 0.08)
        gain.gain.setValueAtTime(0.12, t + i * 0.08)
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.15)
        osc.start(t + i * 0.08)
        osc.stop(t + i * 0.08 + 0.16)
      }
    } catch { /* */ }
  }, [getAudioCtx])

  // Continuous siren - pitch changes based on dots remaining
  const startSiren = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      if (sirenOscRef.current) { try { sirenOscRef.current.stop() } catch { /* */ } }
      if (sirenLfoRef.current) { try { sirenLfoRef.current.stop() } catch { /* */ } }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()

      osc.type = "sine"
      lfo.type = "sine"
      lfo.frequency.setValueAtTime(3.5, ctx.currentTime)
      lfoGain.gain.setValueAtTime(25, ctx.currentTime)

      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      osc.connect(gain)
      gain.connect(ctx.destination)

      const ratio = totalDotsRef.current > 0 ? eatenDotsRef.current / totalDotsRef.current : 0
      const baseFreq = 100 + ratio * 80
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime)
      gain.gain.setValueAtTime(0.04, ctx.currentTime)

      osc.start(ctx.currentTime)
      lfo.start(ctx.currentTime)

      sirenOscRef.current = osc
      sirenGainRef.current = gain
      sirenLfoRef.current = lfo
    } catch { /* */ }
  }, [getAudioCtx])

  const updateSirenPitch = useCallback(() => {
    if (!sirenOscRef.current || !audioCtxRef.current) return
    const ratio = totalDotsRef.current > 0 ? eatenDotsRef.current / totalDotsRef.current : 0
    const baseFreq = 100 + ratio * 80
    try {
      sirenOscRef.current.frequency.setValueAtTime(baseFreq, audioCtxRef.current.currentTime)
    } catch { /* */ }
  }, [])

  const stopSiren = useCallback(() => {
    if (sirenOscRef.current) { try { sirenOscRef.current.stop() } catch { /* */ } sirenOscRef.current = null }
    if (sirenLfoRef.current) { try { sirenLfoRef.current.stop() } catch { /* */ } sirenLfoRef.current = null }
    sirenGainRef.current = null
  }, [])

  // Frightened mode siren
  const startFrightenedSiren = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      if (frightenedOscRef.current) { try { frightenedOscRef.current.stop() } catch { /* */ } }
      if (frightenedLfoRef.current) { try { frightenedLfoRef.current.stop() } catch { /* */ } }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()

      osc.type = "triangle"
      lfo.type = "sine"
      lfo.frequency.setValueAtTime(8, ctx.currentTime)
      lfoGain.gain.setValueAtTime(40, ctx.currentTime)

      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(220, ctx.currentTime)
      gain.gain.setValueAtTime(0.05, ctx.currentTime)

      osc.start(ctx.currentTime)
      lfo.start(ctx.currentTime)

      frightenedOscRef.current = osc
      frightenedGainRef.current = gain
      frightenedLfoRef.current = lfo
    } catch { /* */ }
  }, [getAudioCtx])

  const stopFrightenedSiren = useCallback(() => {
    if (frightenedOscRef.current) { try { frightenedOscRef.current.stop() } catch { /* */ } frightenedOscRef.current = null }
    if (frightenedLfoRef.current) { try { frightenedLfoRef.current.stop() } catch { /* */ } frightenedLfoRef.current = null }
    frightenedGainRef.current = null
  }, [])

  // ─── Maze Helpers ────────────────────────────────────────────────────────
  const initMaze = useCallback(() => {
    const maze = MAZE_TEMPLATE.map(row => [...row])
    let dots = 0
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (maze[r][c] === 2 || maze[r][c] === 3) dots++
    mazeRef.current = maze
    totalDotsRef.current = dots
    eatenDotsRef.current = 0
    globalDotCounter.current = 0
    fruitShownCount.current = 0
    fruitRef.current = null
  }, [])

  const isWall = useCallback((px: number, py: number, radius: number): boolean => {
    const points = [
      { x: px - radius + 1, y: py - radius + 1 },
      { x: px + radius - 1, y: py - radius + 1 },
      { x: px - radius + 1, y: py + radius - 1 },
      { x: px + radius - 1, y: py + radius - 1 },
    ]
    for (const p of points) {
      let col = Math.floor(p.x / CELL)
      const row = Math.floor(p.y / CELL)
      if (col < 0) col = COLS - 1
      if (col >= COLS) col = 0
      if (row < 0 || row >= ROWS) return true
      const cell = mazeRef.current[row]?.[col]
      if (cell === 1 || cell === 5) return true
    }
    return false
  }, [])

  const isWallForGhost = useCallback((px: number, py: number, radius: number, mode: GhostMode, leaving: boolean): boolean => {
    const points = [
      { x: px - radius + 1, y: py - radius + 1 },
      { x: px + radius - 1, y: py - radius + 1 },
      { x: px - radius + 1, y: py + radius - 1 },
      { x: px + radius - 1, y: py + radius - 1 },
    ]
    for (const p of points) {
      let col = Math.floor(p.x / CELL)
      const row = Math.floor(p.y / CELL)
      if (col < 0) col = COLS - 1
      if (col >= COLS) col = 0
      if (row < 0 || row >= ROWS) return true
      const cell = mazeRef.current[row]?.[col]
      if (cell === 1) return true
      if (cell === 5) {
        if (mode === "eyes" || leaving) continue
        const ghostRow = Math.floor(py / CELL)
        if (ghostRow <= 12) return true
      }
    }
    return false
  }, [])

  const canMoveEntity = useCallback((px: number, py: number, dir: Direction, speed: number, forGhost = false, ghostMode: GhostMode = "chase", leaving = false): Position | null => {
    if (dir === "none") return null
    let nx = px, ny = py
    switch (dir) {
      case "left": nx -= speed; break
      case "right": nx += speed; break
      case "up": ny -= speed; break
      case "down": ny += speed; break
    }
    if (nx < -CELL / 2) nx = WIDTH - CELL / 2
    if (nx > WIDTH - CELL / 2) nx = -CELL / 2 + 1

    const blocked = forGhost
      ? isWallForGhost(nx, ny, CELL / 2 - 1, ghostMode, leaving)
      : isWall(nx, ny, CELL / 2 - 1)
    if (!blocked) return { x: nx, y: ny }
    return null
  }, [isWall, isWallForGhost])

  const snapToGrid = useCallback((val: number): number => {
    return Math.round((val - CELL / 2) / CELL) * CELL + CELL / 2
  }, [])

  const isInTunnel = useCallback((px: number): boolean => {
    const col = Math.floor(px / CELL)
    return col <= 5 || col >= 22
  }, [])

  // ─── Ghost AI ────────────────────────────────────────────────────────────
  const getOpposite = (dir: Direction): Direction => {
    switch (dir) {
      case "up": return "down"
      case "down": return "up"
      case "left": return "right"
      case "right": return "left"
      default: return "none"
    }
  }

  const getGhostTarget = useCallback((ghost: Ghost, pacPos: Position, pacDir: Direction): Position => {
    if (ghost.mode === "scatter") return ghost.scatterTarget
    if (ghost.mode === "frightened") {
      return { x: Math.floor(Math.random() * COLS) * CELL + CELL / 2, y: Math.floor(Math.random() * ROWS) * CELL + CELL / 2 }
    }
    if (ghost.mode === "eyes") {
      return { x: 14 * CELL + CELL / 2, y: 14 * CELL + CELL / 2 }
    }
    switch (ghost.name) {
      case "blinky": return { x: pacPos.x, y: pacPos.y }
      case "pinky": {
        let tx = pacPos.x, ty = pacPos.y
        switch (pacDir) {
          case "up": ty -= 4 * CELL; tx -= 4 * CELL; break // Original overflow bug
          case "down": ty += 4 * CELL; break
          case "left": tx -= 4 * CELL; break
          case "right": tx += 4 * CELL; break
        }
        return { x: tx, y: ty }
      }
      case "inky": {
        const blinky = ghostsRef.current[0]
        let tx = pacPos.x, ty = pacPos.y
        switch (pacDir) {
          case "up": ty -= 2 * CELL; break
          case "down": ty += 2 * CELL; break
          case "left": tx -= 2 * CELL; break
          case "right": tx += 2 * CELL; break
        }
        return { x: tx + (tx - blinky.pos.x), y: ty + (ty - blinky.pos.y) }
      }
      case "clyde": {
        const dist = Math.sqrt((ghost.pos.x - pacPos.x) ** 2 + (ghost.pos.y - pacPos.y) ** 2)
        return dist > 8 * CELL ? { x: pacPos.x, y: pacPos.y } : ghost.scatterTarget
      }
      default: return { x: pacPos.x, y: pacPos.y }
    }
  }, [])

  const getGhostSpeed = useCallback((ghost: Ghost): number => {
    const spec = getLevelSpec(levelRef.current)
    if (ghost.mode === "eyes") return BASE_SPEED * 1.6
    if (ghost.mode === "frightened") return BASE_SPEED * spec.ghostFrightSpeed
    if (isInTunnel(ghost.pos.x)) return BASE_SPEED * spec.ghostTunnelSpeed
    // Blinky Elroy mode
    if (ghost.name === "blinky") {
      const dotsLeft = totalDotsRef.current - eatenDotsRef.current
      if (dotsLeft <= spec.elroy2Dots) return BASE_SPEED * spec.elroy2Speed
      if (dotsLeft <= spec.elroy1Dots) return BASE_SPEED * spec.elroy1Speed
    }
    return BASE_SPEED * spec.ghostSpeed
  }, [isInTunnel])

  const moveGhost = useCallback((ghost: Ghost, pacPos: Position, pacDir: Direction) => {
    // Ghosts still in house bob up/down
    if (ghost.inHouse) {
      if (globalDotCounter.current >= ghost.releaseThreshold) {
        ghost.inHouse = false
        ghost.pos = { x: 14 * CELL + CELL / 2, y: 11 * CELL + CELL / 2 }
        ghost.dir = "left"
        ghost.decidedAtCell = false
        return
      }
      ghost.pos.y += ghost.dir === "up" ? -0.5 : 0.5
      if (ghost.pos.y < 13 * CELL + CELL / 2) ghost.dir = "down"
      if (ghost.pos.y > 15 * CELL) ghost.dir = "up"
      return
    }

    const speed = getGhostSpeed(ghost)

    // Handle queued reverse immediately (from mode/fright change)
    if (ghost.reverseQueued) {
      ghost.dir = getOpposite(ghost.dir)
      ghost.reverseQueued = false
      ghost.decidedAtCell = false // allow fresh decision at next center
    }

    // Find nearest cell center and distance to it
    const nearestX = snapToGrid(ghost.pos.x)
    const nearestY = snapToGrid(ghost.pos.y)
    const distX = Math.abs(ghost.pos.x - nearestX)
    const distY = Math.abs(ghost.pos.y - nearestY)
    const atCenter = distX <= speed + 0.5 && distY <= speed + 0.5

    // Only make a direction decision ONCE per cell (prevents oscillation)
    if (atCenter && !ghost.decidedAtCell) {
      ghost.pos.x = nearestX
      ghost.pos.y = nearestY
      ghost.decidedAtCell = true

      // Ghost reached home area — teleport outside the door
      if (ghost.mode === "eyes") {
        const homeCol = Math.round((ghost.pos.x - CELL / 2) / CELL)
        const homeRow = Math.round((ghost.pos.y - CELL / 2) / CELL)
        if (homeRow >= 11 && homeRow <= 16 && homeCol >= 11 && homeCol <= 16) {
          ghost.mode = "chase"
          ghost.pos = { x: 14 * CELL + CELL / 2, y: 11 * CELL + CELL / 2 }
          ghost.dir = "left"
          ghost.decidedAtCell = false
          return
        }
      }

      const target = getGhostTarget(ghost, pacPos, pacDir)
      const dirPriority: Direction[] = ["up", "left", "down", "right"]
      const opposite = getOpposite(ghost.dir)

      let bestDir = ghost.dir
      let bestDist = Infinity
      let foundAny = false

      for (const d of dirPriority) {
        if (d === opposite) continue
        const testPos = canMoveEntity(ghost.pos.x, ghost.pos.y, d, speed, true, ghost.mode, false)
        if (testPos) {
          if (ghost.mode === "frightened") {
            if (!foundAny || Math.random() < 0.3) {
              bestDir = d
              foundAny = true
            }
          } else {
            const dist = (testPos.x - target.x) ** 2 + (testPos.y - target.y) ** 2
            if (dist < bestDist) {
              bestDist = dist
              bestDir = d
              foundAny = true
            }
          }
        }
      }

      // FALLBACK: if no non-opposite direction works, allow reversing
      if (!foundAny) {
        const revPos = canMoveEntity(ghost.pos.x, ghost.pos.y, opposite, speed, true, ghost.mode, false)
        if (revPos) bestDir = opposite
      }

      ghost.dir = bestDir
    }

    // Tunnel wrap
    if (ghost.pos.x < -CELL / 2) ghost.pos.x = WIDTH - CELL / 2
    if (ghost.pos.x > WIDTH - CELL / 2) ghost.pos.x = -CELL / 2

    // Move in the current direction
    const newPos = canMoveEntity(ghost.pos.x, ghost.pos.y, ghost.dir, speed, true, ghost.mode, false)
    if (newPos) {
      ghost.pos.x = newPos.x
      ghost.pos.y = newPos.y

      // Check if ghost crossed into a new cell — allow fresh decision there
      const newNearestX = snapToGrid(ghost.pos.x)
      const newNearestY = snapToGrid(ghost.pos.y)
      if (newNearestX !== nearestX || newNearestY !== nearestY) {
        ghost.decidedAtCell = false
      }
    } else {
      // Ghost is blocked — force snap and find any valid direction
      ghost.pos.x = nearestX
      ghost.pos.y = nearestY
      ghost.decidedAtCell = false
      const target = getGhostTarget(ghost, pacPos, pacDir)
      const allDirs: Direction[] = ["up", "left", "down", "right"]
      let bestDir: Direction = ghost.dir
      let bestDist = Infinity
      for (const d of allDirs) {
        const tryPos = canMoveEntity(ghost.pos.x, ghost.pos.y, d, speed, true, ghost.mode, false)
        if (tryPos) {
          const dist = (tryPos.x - target.x) ** 2 + (tryPos.y - target.y) ** 2
          if (dist < bestDist) {
            bestDist = dist
            bestDir = d
          }
        }
      }
      ghost.dir = bestDir
      const retryPos = canMoveEntity(ghost.pos.x, ghost.pos.y, ghost.dir, speed, true, ghost.mode, false)
      if (retryPos) {
        ghost.pos.x = retryPos.x
        ghost.pos.y = retryPos.y
      }
    }
  }, [canMoveEntity, getGhostTarget, getGhostSpeed, snapToGrid])

  // ─── Init Functions ──────────────────────────────────────────────────────
  const initGhosts = useCallback(() => {
    const releaseDots = getGhostReleaseDots(levelRef.current)
    // ALL ghosts spawn OUTSIDE the ghost house at grid-aligned cell centers
    // Pincer formation: 2 above, 2 below pac-man's start
    ghostsRef.current = [
      {
        name: "blinky", pos: { x: 12 * CELL + CELL / 2, y: 8 * CELL + CELL / 2 }, dir: "down",
        mode: "chase", color: "#ff0000",
        scatterTarget: { x: 25 * CELL, y: -2 * CELL },
        prevMode: "chase", inHouse: false, dotCounter: 0,
        releaseThreshold: 0, reverseQueued: false, decidedAtCell: false,
      },
      {
        name: "pinky", pos: { x: 6 * CELL + CELL / 2, y: 20 * CELL + CELL / 2 }, dir: "right",
        mode: "chase", color: "#ffb8ff",
        scatterTarget: { x: 2 * CELL, y: -2 * CELL },
        prevMode: "chase", inHouse: false, dotCounter: 0,
        releaseThreshold: 0, reverseQueued: false, decidedAtCell: false,
      },
      {
        name: "inky", pos: { x: 21 * CELL + CELL / 2, y: 20 * CELL + CELL / 2 }, dir: "left",
        mode: "chase", color: "#00ffff",
        scatterTarget: { x: 27 * CELL, y: 31 * CELL },
        prevMode: "chase", inHouse: false, dotCounter: 0,
        releaseThreshold: 0, reverseQueued: false, decidedAtCell: false,
      },
      {
        name: "clyde", pos: { x: 15 * CELL + CELL / 2, y: 8 * CELL + CELL / 2 }, dir: "down",
        mode: "chase", color: "#ffb852",
        scatterTarget: { x: 0, y: 31 * CELL },
        prevMode: "chase", inHouse: false, dotCounter: 0,
        releaseThreshold: 0, reverseQueued: false, decidedAtCell: false,
      },
    ]
  }, [])

  const initPacman = useCallback(() => {
    pacmanRef.current = {
      x: 14 * CELL + CELL / 2, y: 23 * CELL + CELL / 2,
      dir: "left", nextDir: "left",
      mouthAngle: 0.2, mouthDir: 1,
      deathFrame: 0, moving: false,
    }
  }, [])

  const resetPositions = useCallback(() => {
    initPacman()
    initGhosts()
    modeTimerRef.current = 0
    modeIndexRef.current = 0
    globalModeRef.current = "chase"
  }, [initPacman, initGhosts])

  // ─── Handle Scale ────────────────────────────────────────────────────────
  useEffect(() => {
    const updateScale = () => {
      const maxW = window.innerWidth - 16
      const maxH = window.innerHeight - 120
      setCanvasScale(Math.min(maxW / WIDTH, maxH / HEIGHT, 1.2))
    }
    updateScale()
    window.addEventListener("resize", updateScale)
    return () => window.removeEventListener("resize", updateScale)
  }, [])

  // ─── Load High Score ─────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("pacman_highScore")
    if (saved) setHighScore(Number.parseInt(saved, 10))
  }, [])

  // ─── Keyboard Controls ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp": case "w": case "W": e.preventDefault(); pacmanRef.current.nextDir = "up"; break
        case "ArrowDown": case "s": case "S": e.preventDefault(); pacmanRef.current.nextDir = "down"; break
        case "ArrowLeft": case "a": case "A": e.preventDefault(); pacmanRef.current.nextDir = "left"; break
        case "ArrowRight": case "d": case "D": e.preventDefault(); pacmanRef.current.nextDir = "right"; break
        default: return
      }
      if (phaseRef.current === "idle") handleStartGame()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Touch Controls ──────────────────────────────────────────────────────
  const touchStartRef = useRef<Position | null>(null)
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      if (phaseRef.current === "idle") handleStartGame()
    }
    const onMove = (e: TouchEvent) => {
      e.preventDefault()
      if (!touchStartRef.current) return
      const t = e.touches[0]
      const dx = t.clientX - touchStartRef.current.x
      const dy = t.clientY - touchStartRef.current.y
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
        pacmanRef.current.nextDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")
        touchStartRef.current = { x: t.clientX, y: t.clientY }
      }
    }
    const onEnd = () => { touchStartRef.current = null }
    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchmove", onMove, { passive: false })
    window.addEventListener("touchend", onEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Start Game ──────────────────────────────────────────────────────────
  const handleStartGame = useCallback(async () => {
    stopSiren()
    stopFrightenedSiren()
    initMaze()
    initPacman()
    initGhosts()
    scoreRef.current = 0
    livesRef.current = 3
    levelRef.current = 1
    ghostScoreMultiplier.current = 1
    extraLifeGiven.current = false
    modeTimerRef.current = 0
    modeIndexRef.current = 0
    globalModeRef.current = "chase"
    popupsRef.current = []
    setScore(0)
    setLives(3)
    setLevel(1)
    readyTimerRef.current = 3200
    phaseRef.current = "ready"
    setGamePhase("ready")
    playIntro()
    await startGame("pacman")
  }, [initMaze, initPacman, initGhosts, playIntro, startGame, stopSiren, stopFrightenedSiren])

  // ─── Drawing Functions ───────────────────────────────────────────────────
  const drawMaze = useCallback((ctx: CanvasRenderingContext2D, flash = false) => {
    const maze = mazeRef.current
    const wallC = flash ? "#ffffff" : WALL_COLOR
    const borderC = flash ? "#ffffff" : WALL_BORDER_COLOR

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = maze[r][c]
        const x = c * CELL
        const y = r * CELL
        if (cell === 1) {
          ctx.fillStyle = wallC
          ctx.fillRect(x, y, CELL, CELL)
          ctx.strokeStyle = borderC
          ctx.lineWidth = 2
          if (r > 0 && maze[r - 1][c] !== 1) {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); ctx.stroke()
          }
          if (r < ROWS - 1 && maze[r + 1][c] !== 1) {
            ctx.beginPath(); ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); ctx.stroke()
          }
          if (c > 0 && maze[r][c - 1] !== 1) {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); ctx.stroke()
          }
          if (c < COLS - 1 && maze[r][c + 1] !== 1) {
            ctx.beginPath(); ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); ctx.stroke()
          }
        } else if (cell === 5) {
          ctx.fillStyle = GHOST_DOOR_COLOR
          ctx.fillRect(x, y + CELL / 2 - 2, CELL, 4)
        }
      }
    }
  }, [])

  const drawDots = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const maze = mazeRef.current
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = maze[r][c]
        const cx = c * CELL + CELL / 2
        const cy = r * CELL + CELL / 2
        if (cell === 2) {
          ctx.fillStyle = DOT_COLOR
          ctx.beginPath()
          ctx.arc(cx, cy, 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (cell === 3) {
          const pulse = 0.5 + Math.sin(time * 0.006) * 0.5
          ctx.globalAlpha = pulse
          ctx.fillStyle = POWER_COLOR
          ctx.beginPath()
          ctx.arc(cx, cy, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowColor = POWER_COLOR
          ctx.shadowBlur = 8
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.globalAlpha = 1
        }
      }
    }
  }, [])

  const drawPacman = useCallback((ctx: CanvasRenderingContext2D) => {
    const pac = pacmanRef.current
    ctx.save()
    ctx.translate(pac.x, pac.y)

    if (phaseRef.current === "dying") {
      // Death animation: Pac-Man "melts" upward like the original
      const frame = pac.deathFrame
      const progress = Math.min(frame / 90, 1)
      const startAngle = Math.PI / 2 - progress * Math.PI
      const endAngle = Math.PI / 2 + progress * Math.PI

      ctx.fillStyle = PACMAN_COLOR
      ctx.beginPath()
      if (progress < 1) {
        ctx.arc(0, 0, CELL / 2 - 1, startAngle, endAngle)
        ctx.lineTo(0, 0)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
      return
    }

    let rotation = 0
    switch (pac.dir) {
      case "right": rotation = 0; break
      case "down": rotation = Math.PI / 2; break
      case "left": rotation = Math.PI; break
      case "up": rotation = -Math.PI / 2; break
    }
    ctx.rotate(rotation)

    const mouth = pac.mouthAngle * Math.PI
    ctx.fillStyle = PACMAN_COLOR
    ctx.beginPath()
    ctx.arc(0, 0, CELL / 2 - 1, mouth, 2 * Math.PI - mouth)
    ctx.lineTo(0, 0)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }, [])

  const drawGhost = useCallback((ctx: CanvasRenderingContext2D, ghost: Ghost, time: number) => {
    const { x, y } = ghost.pos
    const r = CELL / 2 - 1

    ctx.save()
    ctx.translate(x, y)

    if (ghost.mode === "eyes") {
      drawGhostEyes(ctx, ghost.dir)
      ctx.restore()
      return
    }

    let bodyColor = ghost.color
    if (ghost.mode === "frightened") {
      const spec = getLevelSpec(levelRef.current)
      const elapsed = Date.now() - frightenedStartRef.current
      const remaining = spec.frightTime * 1000 - elapsed
      const flashTime = spec.frightFlashes * 400
      if (remaining < flashTime) {
        bodyColor = Math.floor(time / 200) % 2 === 0 ? FRIGHTENED_COLOR : FRIGHTENED_END_COLOR
      } else {
        bodyColor = FRIGHTENED_COLOR
      }
    }

    // Body
    ctx.fillStyle = bodyColor
    ctx.beginPath()
    ctx.arc(0, -2, r, Math.PI, 0)
    ctx.lineTo(r, r - 2)
    const wave = Math.sin(time * 0.01) * 2
    const segs = 3
    const segW = (r * 2) / segs
    for (let i = segs; i >= 0; i--) {
      ctx.lineTo(r - i * segW, r - 2 + ((i % 2 === 0) ? wave : -wave))
    }
    ctx.closePath()
    ctx.fill()

    if (ghost.mode === "frightened") {
      ctx.fillStyle = "#fff"
      ctx.beginPath(); ctx.arc(-3, -3, 1.5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(3, -3, 1.5, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-5, 3)
      for (let i = 0; i <= 10; i++) ctx.lineTo(-5 + i, 3 + (i % 2 === 0 ? -1.5 : 1.5))
      ctx.stroke()
    } else {
      drawGhostEyes(ctx, ghost.dir)
    }

    ctx.restore()
  }, [])

  const drawGhostEyes = (ctx: CanvasRenderingContext2D, dir: Direction) => {
    ctx.fillStyle = "#fff"
    ctx.beginPath(); ctx.ellipse(-4, -3, 3.5, 5, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(4, -3, 3.5, 5, 0, 0, Math.PI * 2); ctx.fill()
    let px = 0, py = 0
    switch (dir) {
      case "left": px = -2; break
      case "right": px = 2; break
      case "up": py = -2; break
      case "down": py = 2; break
    }
    ctx.fillStyle = "#1e3a8a"
    ctx.beginPath(); ctx.arc(-4 + px, -3 + py, 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(4 + px, -3 + py, 2, 0, Math.PI * 2); ctx.fill()
  }

  const drawFruit = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const fruit = fruitRef.current
    if (!fruit) return
    ctx.save()
    ctx.font = `${CELL}px serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const bob = Math.sin(time * 0.004) * 2
    ctx.fillText(fruit.symbol, fruit.x, fruit.y + bob)
    ctx.restore()
  }, [])

  const drawPopups = useCallback((ctx: CanvasRenderingContext2D) => {
    const now = Date.now()
    popupsRef.current = popupsRef.current.filter(p => now - p.time < 1500)
    for (const p of popupsRef.current) {
      const age = (now - p.time) / 1500
      ctx.save()
      ctx.globalAlpha = 1 - age
      ctx.font = "bold 11px monospace"
      ctx.textAlign = "center"
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y - age * 20)
      ctx.restore()
    }
  }, [])

  // ─── Game Loop ───────────────────────────────────────────────────────────
  const gameLoop = useCallback((timestamp: number) => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return

    const frameMs = 1000 / 60
    const deltaTime = Math.min(200, Math.max(0, timestamp - lastTimeRef.current))
    lastTimeRef.current = timestamp
    accumulatorRef.current += deltaTime

    const phase = phaseRef.current

    // ── READY phase ──
    if (phase === "ready") {
      readyTimerRef.current -= deltaTime
      if (readyTimerRef.current <= 0) {
        phaseRef.current = "playing"
        setGamePhase("playing")
        startSiren()
      }
      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      drawMaze(ctx)
      drawDots(ctx, timestamp)
      drawPacman(ctx)
      for (const g of ghostsRef.current) drawGhost(ctx, g, timestamp)
      // "READY!" text
      ctx.fillStyle = "#ffff00"
      ctx.font = "bold 14px monospace"
      ctx.textAlign = "center"
      ctx.fillText("READY!", WIDTH / 2, 17.5 * CELL)
      animationRef.current = requestAnimationFrame(gameLoop)
      return
    }

    // ── DYING phase ──
    if (phase === "dying") {
      deathTimerRef.current -= deltaTime
      pacmanRef.current.deathFrame += deltaTime / 16.67
      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      drawMaze(ctx)
      drawDots(ctx, timestamp)
      drawPacman(ctx)

      if (deathTimerRef.current <= 0) {
        if (livesRef.current <= 0) {
          phaseRef.current = "gameover"
          setGamePhase("gameover")
          stopSiren()
          stopFrightenedSiren()
          const final = scoreRef.current
          if (final > highScore) {
            setHighScore(final)
            localStorage.setItem("pacman_highScore", final.toString())
          }
          endGame()
        } else {
          resetPositions()
          readyTimerRef.current = 2000
          phaseRef.current = "ready"
          setGamePhase("ready")
        }
      }
      animationRef.current = requestAnimationFrame(gameLoop)
      return
    }

    // ── LEVEL COMPLETE phase ──
    if (phase === "levelComplete") {
      levelCompleteTimerRef.current -= deltaTime
      levelFlashRef.current += deltaTime

      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      const flash = Math.floor(levelFlashRef.current / 250) % 2 === 0
      drawMaze(ctx, flash)
      drawPacman(ctx)

      if (levelCompleteTimerRef.current <= 0) {
        levelRef.current++
        setLevel(levelRef.current)
        initMaze()
        resetPositions()
        readyTimerRef.current = 2000
        phaseRef.current = "ready"
        setGamePhase("ready")
      }
      animationRef.current = requestAnimationFrame(gameLoop)
      return
    }

    // ── PLAYING phase ──
    if (phase !== "playing") return

    while (accumulatorRef.current >= frameMs) {
      accumulatorRef.current -= frameMs
      const pac = pacmanRef.current
      const spec = getLevelSpec(levelRef.current)

      // ── Scatter/Chase mode timing ──
      modeTimerRef.current += frameMs
      const scatterChase = spec.scatterChase
      const idx = modeIndexRef.current
      if (idx < scatterChase.length - 1) {
        const phaseDuration = scatterChase[idx] * 1000
        if (modeTimerRef.current >= phaseDuration) {
          modeTimerRef.current = 0
          modeIndexRef.current++
          globalModeRef.current = modeIndexRef.current % 2 === 0 ? "scatter" : "chase"
          for (const g of ghostsRef.current) {
            if (g.mode !== "frightened" && g.mode !== "eyes" && !g.inHouse) {
              g.reverseQueued = true
            }
          }
        }
      }

      // ── Mouth animation ──
      if (pac.moving) {
        pac.mouthAngle += 0.035 * pac.mouthDir
        if (pac.mouthAngle >= 0.35) pac.mouthDir = -1
        if (pac.mouthAngle <= 0.01) pac.mouthDir = 1
      }

      // ── Move Pac-Man ──
      const eating = mazeRef.current[Math.floor(pac.y / CELL)]?.[Math.floor(pac.x / CELL)]
      const pacSpeed = BASE_SPEED * ((eating === 2 || eating === 3) ? spec.pacDotSpeed : spec.pacSpeed)

      pac.moving = false
      if (pac.nextDir !== pac.dir && pac.nextDir !== "none") {
        const nextPos = canMoveEntity(pac.x, pac.y, pac.nextDir, pacSpeed)
        if (nextPos) {
          if (pac.nextDir === "up" || pac.nextDir === "down") pac.x = snapToGrid(pac.x)
          else pac.y = snapToGrid(pac.y)
          pac.dir = pac.nextDir
        }
      }
      if (pac.dir !== "none") {
        const newPos = canMoveEntity(pac.x, pac.y, pac.dir, pacSpeed)
        if (newPos) {
          pac.x = newPos.x
          pac.y = newPos.y
          pac.moving = true
        }
      }
      if (pac.x < -CELL / 2) pac.x = WIDTH - CELL / 2
      if (pac.x > WIDTH - CELL / 2) pac.x = -CELL / 2

      // ── Eat Dots ──
      const col = Math.floor(pac.x / CELL)
      const row = Math.floor(pac.y / CELL)
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        const cell = mazeRef.current[row][col]
        if (cell === 2) {
          mazeRef.current[row][col] = 0
          scoreRef.current += 10
          eatenDotsRef.current++
          globalDotCounter.current++
          setScore(scoreRef.current)
          playWaka()
          updateSirenPitch()
          recordAction("dot")
        } else if (cell === 3) {
          mazeRef.current[row][col] = 0
          scoreRef.current += 50
          eatenDotsRef.current++
          globalDotCounter.current++
          ghostScoreMultiplier.current = 1
          setScore(scoreRef.current)
          playPowerPellet()
          recordAction("power")

          if (spec.frightTime > 0) {
            if (frightenedTimerRef.current) clearTimeout(frightenedTimerRef.current)
            frightenedStartRef.current = Date.now()
            if (sirenGainRef.current) {
              try { sirenGainRef.current.gain.setValueAtTime(0, getAudioCtx().currentTime) } catch { /* */ }
            }
            startFrightenedSiren()

            for (const g of ghostsRef.current) {
              if (g.mode !== "eyes" && !g.inHouse) {
                g.prevMode = g.mode
                g.mode = "frightened"
                g.reverseQueued = true
              }
            }
            frightenedTimerRef.current = setTimeout(() => {
              stopFrightenedSiren()
              if (sirenGainRef.current) {
                try { sirenGainRef.current.gain.setValueAtTime(0.04, getAudioCtx().currentTime) } catch { /* */ }
              }
              for (const g of ghostsRef.current) {
                if (g.mode === "frightened") {
                  g.mode = globalModeRef.current
                }
              }
            }, spec.frightTime * 1000)
          }
        }

        // ── Fruit spawning ──
        if ((eatenDotsRef.current === 70 || eatenDotsRef.current === 170) && fruitShownCount.current < (eatenDotsRef.current === 70 ? 1 : 2)) {
          const fruitSpec = spec.fruit
          fruitRef.current = {
            type: levelRef.current, x: 14 * CELL, y: 17 * CELL + CELL / 2,
            timer: 600, score: fruitSpec.score, symbol: fruitSpec.symbol,
          }
          fruitShownCount.current++
        }

        // ── Extra life at 10,000 ──
        if (scoreRef.current >= 10000 && !extraLifeGiven.current) {
          extraLifeGiven.current = true
          livesRef.current++
          setLives(livesRef.current)
          playExtraLife()
        }

        // ── Level complete ──
        if (eatenDotsRef.current >= totalDotsRef.current) {
          stopSiren()
          stopFrightenedSiren()
          playLevelComplete()
          levelCompleteTimerRef.current = 2500
          levelFlashRef.current = 0
          phaseRef.current = "levelComplete"
          setGamePhase("levelComplete")
          return
        }
      }

      // ── Update fruit timer ──
      if (fruitRef.current) {
        fruitRef.current.timer--
        if (fruitRef.current.timer <= 0) fruitRef.current = null
      }

      // ── Eat fruit check ──
      if (fruitRef.current) {
        const fx = fruitRef.current.x
        const fy = fruitRef.current.y
        if (Math.abs(pac.x - fx) < CELL && Math.abs(pac.y - fy) < CELL) {
          scoreRef.current += fruitRef.current.score
          setScore(scoreRef.current)
          playEatFruit()
          popupsRef.current.push({
            x: fx, y: fy, text: `${fruitRef.current.score}`,
            time: Date.now(), color: "#fff",
          })
          recordAction("fruit")
          fruitRef.current = null
        }
      }

      // ── Move Ghosts ──
      for (const ghost of ghostsRef.current) {
        if (ghost.mode !== "frightened" && ghost.mode !== "eyes" && !ghost.inHouse) {
          ghost.mode = globalModeRef.current
        }
        moveGhost(ghost, { x: pac.x, y: pac.y }, pac.dir)
      }

      // ── Ghost Collision ──
      for (const ghost of ghostsRef.current) {
        if (ghost.inHouse) continue
        const dx = pac.x - ghost.pos.x
        const dy = pac.y - ghost.pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < CELL - 2) {
          if (ghost.mode === "frightened") {
            const pts = GHOST_SCORE_BASE * ghostScoreMultiplier.current
            scoreRef.current += pts
            setScore(scoreRef.current)
            ghostScoreMultiplier.current *= 2
            ghost.mode = "eyes"
            playEatGhost()
            popupsRef.current.push({
              x: ghost.pos.x, y: ghost.pos.y, text: `${pts}`,
              time: Date.now(), color: "#00ffff",
            })
            recordAction("ghost")
          } else if (ghost.mode !== "eyes") {
            stopSiren()
            stopFrightenedSiren()
            if (frightenedTimerRef.current) {
              clearTimeout(frightenedTimerRef.current)
              frightenedTimerRef.current = null
            }
            playDeath()
            livesRef.current--
            setLives(livesRef.current)
            pacmanRef.current.deathFrame = 0
            deathTimerRef.current = 1800
            phaseRef.current = "dying"
            setGamePhase("dying")
            return
          }
        }
      }
    }

    // ── Render ──
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    drawMaze(ctx)
    drawDots(ctx, timestamp)
    drawFruit(ctx, timestamp)
    drawPacman(ctx)
    for (const ghost of ghostsRef.current) drawGhost(ctx, ghost, timestamp)
    drawPopups(ctx)

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [
    canMoveEntity, snapToGrid, moveGhost, drawMaze, drawDots, drawPacman, drawGhost, drawFruit, drawPopups,
    playWaka, playPowerPellet, playEatGhost, playDeath, playLevelComplete, playEatFruit, playExtraLife,
    startSiren, stopSiren, updateSirenPitch, startFrightenedSiren, stopFrightenedSiren, getAudioCtx,
    initMaze, resetPositions, recordAction, endGame, highScore,
  ])

  // ─── Start/Stop Loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== "idle" && gamePhase !== "gameover") {
      lastTimeRef.current = performance.now()
      accumulatorRef.current = 0
      animationRef.current = requestAnimationFrame(gameLoop)
    }
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [gamePhase, gameLoop])

  // ─── Idle/Game Over Rendering ────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== "idle" && gamePhase !== "gameover") return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    if (gamePhase === "idle") {
      initMaze()
      initPacman()
      initGhosts()
    }

    const drawIdle = (time: number) => {
      if (phaseRef.current !== "idle" && phaseRef.current !== "gameover") return
      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      drawMaze(ctx)
      drawDots(ctx, time)
      drawPacman(ctx)
      for (const g of ghostsRef.current) drawGhost(ctx, g, time)
      animationRef.current = requestAnimationFrame(drawIdle)
    }
    animationRef.current = requestAnimationFrame(drawIdle)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [gamePhase, initMaze, initPacman, initGhosts, drawMaze, drawDots, drawPacman, drawGhost])

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (frightenedTimerRef.current) clearTimeout(frightenedTimerRef.current)
      stopSiren()
      stopFrightenedSiren()
      if (audioCtxRef.current) audioCtxRef.current.close()
    }
  }, [stopSiren, stopFrightenedSiren])

  // ─── JSX ─────────────────────────────────────────────────────────────────
  const spec = getLevelSpec(level)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ backgroundColor: "#000" }}>
      {/* Header HUD */}
      <div className="w-full flex items-center justify-between px-4 py-1" style={{ maxWidth: WIDTH * canvasScale }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-wider" style={{ color: "#888" }}>1UP</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: "#fff", fontFamily: "monospace" }}>
            {score.toString().padStart(7, " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-wider" style={{ color: "#888" }}>HIGH SCORE</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: "#fff", fontFamily: "monospace" }}>
            {highScore.toString().padStart(7, " ")}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{ width: WIDTH * canvasScale, height: HEIGHT * canvasScale, imageRendering: "pixelated" }}
        />

        {/* Idle Overlay */}
        {gamePhase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4"
                style={{ color: "#facc15", textShadow: "0 0 20px rgba(250,204,21,0.6), 0 0 40px rgba(250,204,21,0.3)", fontFamily: "monospace" }}>
                PAC-MAN
              </h1>
              <div className="flex justify-center gap-3 mb-6">
                {[{ c: "#ff0000", n: "BLINKY" }, { c: "#ffb8ff", n: "PINKY" }, { c: "#00ffff", n: "INKY" }, { c: "#ffb852", n: "CLYDE" }].map(({ c, n }) => (
                  <div key={n} className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 rounded-t-full" style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}` }} />
                    <span className="text-[8px] font-bold" style={{ color: c }}>{n}</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={handleStartGame}
                className="px-8 py-2.5 text-base font-bold rounded-lg transition-all duration-200 active:scale-95"
                style={{ background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)", color: "#000", boxShadow: "0 0 20px rgba(250,204,21,0.4)" }}>
                PLAY
              </button>
              <p className="mt-3 text-[10px]" style={{ color: "#555" }}>Arrow keys / WASD / Swipe</p>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gamePhase === "gameover" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="text-center">
              <h2 className="text-3xl font-black mb-3"
                style={{ color: "#ef4444", textShadow: "0 0 20px rgba(239,68,68,0.6)", fontFamily: "monospace" }}>
                GAME OVER
              </h2>
              <div className="text-xs mb-1" style={{ color: "#888" }}>SCORE</div>
              <div className="text-4xl font-black mb-4"
                style={{ color: "#facc15", textShadow: "0 0 12px rgba(250,204,21,0.5)", fontFamily: "monospace" }}>
                {score}
              </div>
              {score >= highScore && score > 0 && (
                <div className="mb-3 text-xs font-bold animate-pulse" style={{ color: "#10b981" }}>NEW HIGH SCORE!</div>
              )}
              <div className="text-xs mb-4" style={{ color: "#888" }}>
                Level {level} {spec.fruit.symbol}
              </div>
              <button type="button" onClick={handleStartGame}
                className="px-8 py-2.5 text-base font-bold rounded-lg transition-all duration-200 active:scale-95"
                style={{ background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)", color: "#000", boxShadow: "0 0 20px rgba(250,204,21,0.4)" }}>
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer HUD */}
      <div className="w-full flex items-center justify-between px-4 py-1" style={{ maxWidth: WIDTH * canvasScale }}>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.max(0, lives - 1) }).map((_, i) => (
            <svg key={`life-${i}`} width="16" height="16" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="8" fill="#facc15" />
              <path d="M10 10 L18 5 A8 8 0 0 0 18 15 Z" fill="#000" />
            </svg>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm" style={{ color: "#888" }}>LVL {level}</span>
          <span className="text-sm">{spec.fruit.symbol}</span>
        </div>
      </div>

      {/* Mobile D-pad */}
      <div className="md:hidden mt-1 mb-2">
        <div className="grid grid-cols-3 gap-1" style={{ width: 144 }}>
          <div />
          <button type="button" onTouchStart={(e) => { e.preventDefault(); pacmanRef.current.nextDir = "up"; if (phaseRef.current === "idle") handleStartGame() }}
            className="flex items-center justify-center w-12 h-12 rounded-lg active:scale-90 transition-transform"
            style={{ backgroundColor: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.25)" }}>
            <span style={{ color: "#facc15", fontSize: 18 }}>&#9650;</span>
          </button>
          <div />
          <button type="button" onTouchStart={(e) => { e.preventDefault(); pacmanRef.current.nextDir = "left"; if (phaseRef.current === "idle") handleStartGame() }}
            className="flex items-center justify-center w-12 h-12 rounded-lg active:scale-90 transition-transform"
            style={{ backgroundColor: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.25)" }}>
            <span style={{ color: "#facc15", fontSize: 18 }}>&#9664;</span>
          </button>
          <div />
          <button type="button" onTouchStart={(e) => { e.preventDefault(); pacmanRef.current.nextDir = "right"; if (phaseRef.current === "idle") handleStartGame() }}
            className="flex items-center justify-center w-12 h-12 rounded-lg active:scale-90 transition-transform"
            style={{ backgroundColor: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.25)" }}>
            <span style={{ color: "#facc15", fontSize: 18 }}>&#9654;</span>
          </button>
          <div />
          <button type="button" onTouchStart={(e) => { e.preventDefault(); pacmanRef.current.nextDir = "down"; if (phaseRef.current === "idle") handleStartGame() }}
            className="flex items-center justify-center w-12 h-12 rounded-lg active:scale-90 transition-transform"
            style={{ backgroundColor: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.25)" }}>
            <span style={{ color: "#facc15", fontSize: 18 }}>&#9660;</span>
          </button>
          <div />
        </div>
      </div>
    </div>
  )
}

export default PacmanGame
