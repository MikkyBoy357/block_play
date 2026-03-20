"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"

type GameState = "menu" | "playing" | "dying" | "gameover"

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

interface Lane {
    type: "safe" | "road" | "river"
    y: number // world-y of lane (row index, grows upward)
    obstacles: Obstacle[]
    speed: number // px/s, negative = left
    color: string
}

type VehicleType = "car" | "truck" | "bike" | "police" | "firetruck" | "ambulance" | "taxi"

interface Obstacle {
    x: number
    width: number
    color: string
    glowColor: string
    vehicleType?: VehicleType
}

const TILE = 40
const PLAYER_SIZE = 30
const LANE_COUNT_BUFFER = 25 // how many lanes ahead to generate
const SAFE_ZONE_INTERVAL = 7 // every N lanes is a safe strip

const NEON_CYAN = "#00f0ff"
const NEON_PINK = "#ff2d7b"
const NEON_GREEN = "#39ff14"
const NEON_ORANGE = "#ff8800"
const NEON_YELLOW = "#ffe600"
const NEON_PURPLE = "#aa44ff"
const TABLE_BG = "#0a0e1a"

const EDGE_RED = "#ff1a1a"
const EDGE_YELLOW = "#ffe600"
const EDGE_BLUE = "#1a8cff"
const EDGE_GREEN = "#00ff66"

const ROAD_COLORS = [
    { car: "#ff2d7b", glow: "#ff2d7b" },
    { car: "#ff8800", glow: "#ff8800" },
    { car: "#aa44ff", glow: "#aa44ff" },
    { car: "#ffe600", glow: "#ffe600" },
    { car: "#1a8cff", glow: "#1a8cff" },
]

const LOG_COLORS = [
    { log: "#00aa44", glow: "#00ff66" },
    { log: "#887722", glow: "#ccaa33" },
    { log: "#336655", glow: "#44bb88" },
]

const SPEED_MIN = 1
const SPEED_MAX = 10
const SPEED_DEFAULT = 5

const TIMER_START = 14 // seconds
const TIMER_BONUS = 1.5 // seconds gained per new row
const TIMER_WARNING = 5 // start warning tick below this

const getSpeedColor = (speed: number): string => {
    const t = (speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)
    if (t < 0.5) {
        const u = t * 2
        const r = Math.round(0x00 + (0xff - 0x00) * u)
        const g = Math.round(0xff + (0xaa - 0xff) * u)
        const b = Math.round(0x88 * (1 - u))
        return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
    }
    const u = (t - 0.5) * 2
    const r = 0xff
    const g = Math.round(0xaa * (1 - u))
    const b = Math.round(0x66 * u)
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

const getSpeedLabel = (speed: number): string => {
    if (speed <= 2) return "Chill"
    if (speed <= 4) return "Easy"
    if (speed <= 6) return "Medium"
    if (speed <= 8) return "Fast"
    return "Insane"
}

// Seeded lane generation
function generateLane(row: number, speedMult: number, canvasWidth: number): Lane {
    if (row <= 0) {
        // Starting row(s) are always safe
        return { type: "safe", y: row, obstacles: [], speed: 0, color: "#0d1a0d" }
    }

    if (row % SAFE_ZONE_INTERVAL === 0) {
        return { type: "safe", y: row, obstacles: [], speed: 0, color: "#0d1a0d" }
    }

    const hash = Math.abs(Math.sin(row * 9301 + 4927) * 49297) % 1
    const isRiver = hash > 0.65
    const dir = row % 2 === 0 ? 1 : -1
    const baseSpeed = (40 + hash * 80) * speedMult
    const speed = baseSpeed * dir

    if (isRiver) {
        // River: logs to ride on
        const logColor = LOG_COLORS[row % LOG_COLORS.length]
        const obstacles: Obstacle[] = []
        const logCount = 2 + Math.floor(hash * 3)
        const gap = canvasWidth / logCount
        for (let i = 0; i < logCount; i++) {
            const logWidth = 60 + (hash * 40 + i * 13) % 50
            obstacles.push({
                x: i * gap + ((row * 37 + i * 73) % gap),
                width: logWidth,
                color: logColor.log,
                glowColor: logColor.glow,
            })
        }
        return { type: "river", y: row, obstacles, speed, color: "#08203a" }
    }

    // Road: mixed vehicles (cars, trucks, bikes, specials) with varied colors
    const obstacles: Obstacle[] = []
    const count = 2 + Math.floor(((row * 7 + 3) % 5) * hash) % 4
    const gap = canvasWidth / count
    for (let i = 0; i < count; i++) {
        // Each obstacle gets its own random color
        const colorIdx = (row * 3 + i * 7 + Math.floor(hash * 100)) % ROAD_COLORS.length
        const obsColor = ROAD_COLORS[colorIdx]
        // Determine vehicle type per-obstacle
        const typeHash = Math.abs(Math.sin(row * 131 + i * 47 + 919)) % 1
        // Special vehicle hash — only first obstacle on certain rows
        const specialHash = Math.abs(Math.sin(row * 251 + i * 89 + 1337)) % 1
        let vehicleType: VehicleType
        let w: number
        let vColor: string
        let vGlow: string

        if (specialHash < 0.04) {
            // Police car — ~4% chance
            vehicleType = "police"
            w = 42 + ((row * 13 + i * 41) % 14)
            vColor = "#1133aa"
            vGlow = "#4488ff"
        } else if (specialHash < 0.07) {
            // Firetruck — ~3% chance
            vehicleType = "firetruck"
            w = 70 + ((row * 13 + i * 41) % 18)
            vColor = "#cc1111"
            vGlow = "#ff3333"
        } else if (specialHash < 0.10) {
            // Ambulance — ~3% chance
            vehicleType = "ambulance"
            w = 55 + ((row * 13 + i * 41) % 15)
            vColor = "#eeeeee"
            vGlow = "#ffffff"
        } else if (specialHash < 0.15) {
            // Taxi — ~5% chance
            vehicleType = "taxi"
            w = 38 + ((row * 13 + i * 41) % 16)
            vColor = "#ffcc00"
            vGlow = "#ffee44"
        } else if (typeHash < 0.2) {
            // Bike - small & nippy
            vehicleType = "bike"
            w = 18 + ((row * 11 + i * 23) % 8)
            vColor = obsColor.car
            vGlow = obsColor.glow
        } else if (typeHash < 0.55) {
            // Car - medium
            vehicleType = "car"
            w = 35 + ((row * 13 + i * 41) % 22)
            vColor = obsColor.car
            vGlow = obsColor.glow
        } else {
            // Truck - large
            vehicleType = "truck"
            w = 60 + ((row * 13 + i * 41) % 25)
            vColor = obsColor.car
            vGlow = obsColor.glow
        }
        obstacles.push({
            x: i * gap + ((row * 29 + i * 67) % (gap * 0.6)),
            width: w,
            color: vColor,
            glowColor: vGlow,
            vehicleType,
        })
    }
    return { type: "road", y: row, obstacles, speed, color: "#121218" }
}

export function CrossyRoadGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const lastTimeRef = useRef<number>(0)

    // Player state — world coordinates. y = row index (starts 0, increases upward)
    const playerXRef = useRef(0) // pixel x
    const playerRowRef = useRef(0)
    const targetXRef = useRef(0)
    const targetRowRef = useRef(0)
    const isMovingRef = useRef(false)
    const moveProgressRef = useRef(0) // 0→1 animation
    const prevXRef = useRef(0)
    const prevRowRef = useRef(0)

    const lanesRef = useRef<Map<number, Lane>>(new Map())
    const particlesRef = useRef<GlowParticle[]>([])
    const highestRowRef = useRef(0) // furthest row reached (score)

    const [gameState, setGameState] = useState<GameState>("menu")
    const [score, setScore] = useState(0)
    const [highScore, setHighScore] = useState(0)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [speed, setSpeed] = useState(SPEED_DEFAULT)

    const scoreRef = useRef(0)
    const gameStateRef = useRef<GameState>("menu")
    const speedRef = useRef(SPEED_DEFAULT)
    const deathAnimRef = useRef(0)

    // Hit animation state
    type DeathType = "vehicle" | "splash" | "drift"
    const hitAnimRef = useRef(0) // 0→1 progress of knockback anim
    const hitDirRef = useRef(0) // -1 = hit from left, 1 = hit from right
    const hitSpinRef = useRef(0) // accumulated rotation
    const hitVxRef = useRef(0) // knockback velocity x
    const hitVyRef = useRef(0) // knockback velocity y (screen space, positive = down)
    const hitPxRef = useRef(0) // offset x from original pos
    const hitPyRef = useRef(0) // offset y from original pos
    const dyingTimerRef = useRef(0) // time remaining in dying state
    const deathTypeRef = useRef<DeathType>("vehicle") // what killed the player

    // Timer state
    const timerRef = useRef(TIMER_START)
    const lastTickRef = useRef(0) // tracks last whole-second for warning tick

    useEffect(() => { gameStateRef.current = gameState }, [gameState])
    useEffect(() => { speedRef.current = speed }, [speed])

    // ─── Audio ───
    const audioCtxRef = useRef<AudioContext | null>(null)
    const getAudioCtx = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        }
        return audioCtxRef.current
    }, [])

    const playHopSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sine"
            osc.frequency.setValueAtTime(440, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.06)
            gain.gain.setValueAtTime(0.1, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
            osc.connect(gain).connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + 0.1)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playScoreSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const notes = [660, 880, 1100]
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = "sine"
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.05)
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.12)
                osc.connect(gain).connect(ctx.destination)
                osc.start(ctx.currentTime + i * 0.05)
                osc.stop(ctx.currentTime + i * 0.05 + 0.12)
            })
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playDeathSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const notes = [400, 350, 300, 250, 200]
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = "sawtooth"
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1)
                gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.1 + 0.02)
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.25)
                osc.connect(gain).connect(ctx.destination)
                osc.start(ctx.currentTime + i * 0.1)
                osc.stop(ctx.currentTime + i * 0.1 + 0.25)
            })
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playSplashSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            // White noise burst for splash
            const bufferSize = ctx.sampleRate * 0.15
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
            const data = buffer.getChannelData(0)
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
            }
            const source = ctx.createBufferSource()
            source.buffer = buffer
            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0.12, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
            const filter = ctx.createBiquadFilter()
            filter.type = "lowpass"
            filter.frequency.value = 800
            source.connect(filter).connect(gain).connect(ctx.destination)
            source.start()
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    // Drowning splash — big splash + descending bubble tones
    const playDrownSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime

            // Big splash noise burst (longer & heavier than hop splash)
            const splashLen = ctx.sampleRate * 0.3
            const splashBuf = ctx.createBuffer(1, splashLen, ctx.sampleRate)
            const splashData = splashBuf.getChannelData(0)
            for (let i = 0; i < splashLen; i++) {
                splashData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / splashLen, 1.5)
            }
            const splashSrc = ctx.createBufferSource()
            splashSrc.buffer = splashBuf
            const splashGain = ctx.createGain()
            splashGain.gain.setValueAtTime(0.18, t)
            splashGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
            const splashFilter = ctx.createBiquadFilter()
            splashFilter.type = "lowpass"
            splashFilter.frequency.setValueAtTime(1200, t)
            splashFilter.frequency.exponentialRampToValueAtTime(200, t + 0.3)
            splashSrc.connect(splashFilter).connect(splashGain).connect(ctx.destination)
            splashSrc.start(t)

            // Descending bubble tones (glub glub glub)
            const bubbleNotes = [500, 380, 280, 200, 150]
            bubbleNotes.forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = "sine"
                osc.frequency.setValueAtTime(freq, t + 0.1 + i * 0.12)
                osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.1 + i * 0.12 + 0.1)
                gain.gain.setValueAtTime(0, t + 0.1 + i * 0.12)
                gain.gain.linearRampToValueAtTime(0.06 * (1 - i * 0.15), t + 0.1 + i * 0.12 + 0.02)
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1 + i * 0.12 + 0.1)
                osc.connect(gain).connect(ctx.destination)
                osc.start(t + 0.1 + i * 0.12)
                osc.stop(t + 0.1 + i * 0.12 + 0.12)
            })
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    // Drift-off sound — whooshy water rush + fading warble
    const playDriftSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime

            // Filtered noise swoosh (longer, rushing water)
            const rushLen = ctx.sampleRate * 0.6
            const rushBuf = ctx.createBuffer(1, rushLen, ctx.sampleRate)
            const rushData = rushBuf.getChannelData(0)
            for (let i = 0; i < rushLen; i++) {
                const env = Math.sin((i / rushLen) * Math.PI) // bell curve envelope
                rushData[i] = (Math.random() * 2 - 1) * env
            }
            const rushSrc = ctx.createBufferSource()
            rushSrc.buffer = rushBuf
            const rushGain = ctx.createGain()
            rushGain.gain.setValueAtTime(0.05, t)
            rushGain.gain.linearRampToValueAtTime(0.14, t + 0.15)
            rushGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
            const rushFilter = ctx.createBiquadFilter()
            rushFilter.type = "bandpass"
            rushFilter.frequency.setValueAtTime(600, t)
            rushFilter.frequency.exponentialRampToValueAtTime(200, t + 0.6)
            rushFilter.Q.value = 2
            rushSrc.connect(rushFilter).connect(rushGain).connect(ctx.destination)
            rushSrc.start(t)

            // Fading warble tone (swept sine, like being pulled away)
            const osc = ctx.createOscillator()
            const oscGain = ctx.createGain()
            osc.type = "sine"
            osc.frequency.setValueAtTime(300, t)
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.5)
            oscGain.gain.setValueAtTime(0.06, t)
            oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
            osc.connect(oscGain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.5)

            // Small splash at the start
            const splashLen2 = ctx.sampleRate * 0.1
            const splashBuf2 = ctx.createBuffer(1, splashLen2, ctx.sampleRate)
            const splashData2 = splashBuf2.getChannelData(0)
            for (let i = 0; i < splashLen2; i++) {
                splashData2[i] = (Math.random() * 2 - 1) * (1 - i / splashLen2)
            }
            const splashSrc2 = ctx.createBufferSource()
            splashSrc2.buffer = splashBuf2
            const splashGain2 = ctx.createGain()
            splashGain2.gain.setValueAtTime(0.1, t)
            splashGain2.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
            const splashFilter2 = ctx.createBiquadFilter()
            splashFilter2.type = "lowpass"
            splashFilter2.frequency.value = 900
            splashSrc2.connect(splashFilter2).connect(splashGain2).connect(ctx.destination)
            splashSrc2.start(t)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playTickSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "square"
            osc.frequency.setValueAtTime(880, t)
            osc.frequency.exponentialRampToValueAtTime(440, t + 0.06)
            gain.gain.setValueAtTime(0.08, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
            osc.connect(gain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.08)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playTimeoutSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            // Descending buzz
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sawtooth"
            osc.frequency.setValueAtTime(600, t)
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.5)
            gain.gain.setValueAtTime(0.12, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
            const filter = ctx.createBiquadFilter()
            filter.type = "lowpass"
            filter.frequency.value = 1200
            osc.connect(filter).connect(gain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.5)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    // ─── Particles ───
    const spawnParticles = useCallback((x: number, y: number, color: string, count: number, spd: number = 3) => {
        const particles = particlesRef.current
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2
            const s = (Math.random() * 0.7 + 0.3) * spd
            particles.push({
                x, y,
                vx: Math.cos(angle) * s,
                vy: Math.sin(angle) * s,
                radius: Math.random() * 3 + 1,
                life: 1,
                maxLife: Math.random() * 0.5 + 0.3,
                color,
            })
        }
        if (particles.length > 500) particles.splice(0, particles.length - 500)
    }, [])

    // ─── Lane management ───
    const ensureLanes = useCallback((centerRow: number, w: number) => {
        const lanes = lanesRef.current
        const sMult = speedRef.current / 5
        for (let r = centerRow - 5; r <= centerRow + LANE_COUNT_BUFFER; r++) {
            if (!lanes.has(r)) {
                lanes.set(r, generateLane(r, sMult, w))
            }
        }
        // Prune far-behind lanes
        for (const [key] of lanes) {
            if (key < centerRow - 15) lanes.delete(key)
        }
    }, [])

    // ─── Try move ───
    const tryMove = useCallback((dx: number, dy: number) => {
        if (gameStateRef.current !== "playing") return
        if (isMovingRef.current) return

        const newRow = playerRowRef.current + dy
        const newX = playerXRef.current + dx * TILE

        // Prevent moving off-screen left/right
        const w = canvasSize.width
        if (newX < TILE / 2 || newX > w - TILE / 2) return
        if (newRow < 0) return // can't go below start

        prevXRef.current = playerXRef.current
        prevRowRef.current = playerRowRef.current
        targetXRef.current = newX
        targetRowRef.current = newRow
        isMovingRef.current = true
        moveProgressRef.current = 0

        playHopSound()
    }, [canvasSize.width, playHopSound])

    // ─── Start game ───
    const startGame = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const w = parseInt(canvas.style.width)

        lanesRef.current = new Map()
        particlesRef.current = []

        const startX = Math.floor(w / (2 * TILE)) * TILE + TILE / 2
        playerXRef.current = startX
        playerRowRef.current = 0
        targetXRef.current = startX
        targetRowRef.current = 0
        prevXRef.current = startX
        prevRowRef.current = 0
        isMovingRef.current = false
        moveProgressRef.current = 0
        highestRowRef.current = 0
        deathAnimRef.current = 0

        scoreRef.current = 0
        setScore(0)

        timerRef.current = TIMER_START
        lastTickRef.current = Math.floor(TIMER_START)

        ensureLanes(0, w)
        setGameState("playing")
    }, [ensureLanes])

    // ─── Canvas sizing ───
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current
            if (!canvas) return
            const parent = canvas.parentElement
            if (!parent) return
            const w = Math.min(parent.clientWidth, 480)
            const h = Math.min(window.innerHeight - 100, 750)
            const dpr = window.devicePixelRatio || 1
            canvas.width = w * dpr
            canvas.height = h * dpr
            canvas.style.width = `${w}px`
            canvas.style.height = `${h}px`
            const ctx = canvas.getContext("2d")
            if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            setCanvasSize({ width: w, height: h })
        }
        resize()
        window.addEventListener("resize", resize)
        return () => window.removeEventListener("resize", resize)
    }, [])

    // ─── Input ───
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (gameStateRef.current !== "playing") return
            switch (e.key) {
                case "ArrowUp": case "w": case "W":
                    tryMove(0, 1); e.preventDefault(); break
                case "ArrowDown": case "s": case "S":
                    tryMove(0, -1); e.preventDefault(); break
                case "ArrowLeft": case "a": case "A":
                    tryMove(-1, 0); e.preventDefault(); break
                case "ArrowRight": case "d": case "D":
                    tryMove(1, 0); e.preventDefault(); break
            }
        }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [tryMove])

    // ─── Touch/swipe ───
    const touchStartRef = useRef<{ x: number; y: number } | null>(null)
    useEffect(() => {
        const onStart = (e: TouchEvent) => {
            if (gameStateRef.current !== "playing") return
            const t = e.touches[0]
            touchStartRef.current = { x: t.clientX, y: t.clientY }
        }
        const onEnd = (e: TouchEvent) => {
            if (gameStateRef.current !== "playing" || !touchStartRef.current) return
            const t = e.changedTouches[0]
            const dx = t.clientX - touchStartRef.current.x
            const dy = t.clientY - touchStartRef.current.y
            const ax = Math.abs(dx), ay = Math.abs(dy)
            if (Math.max(ax, ay) < 15) {
                // Tap = hop forward
                tryMove(0, 1)
            } else if (ax > ay) {
                tryMove(dx > 0 ? 1 : -1, 0)
            } else {
                tryMove(0, dy < 0 ? 1 : -1)
            }
            touchStartRef.current = null
        }
        window.addEventListener("touchstart", onStart, { passive: true })
        window.addEventListener("touchend", onEnd, { passive: true })
        return () => {
            window.removeEventListener("touchstart", onStart)
            window.removeEventListener("touchend", onEnd)
        }
    }, [tryMove])

    // ─── Game loop ───
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const loop = (timestamp: number) => {
            const rawDt = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 1 / 60
            lastTimeRef.current = timestamp
            const dt = Math.min(rawDt, 1 / 30)

            const w = canvasSize.width
            const h = canvasSize.height
            if (w === 0 || h === 0) { animRef.current = requestAnimationFrame(loop); return }

            const lanes = lanesRef.current

            // ── Update ──
            if (gameStateRef.current === "playing" || gameStateRef.current === "dying") {
                // Move obstacles (keep them moving during dying too)
                for (const [, lane] of lanes) {
                    if (lane.speed === 0) continue
                    for (const obs of lane.obstacles) {
                        obs.x += lane.speed * dt
                        // Wrap around
                        if (lane.speed > 0 && obs.x > w + obs.width) {
                            obs.x = -obs.width
                        } else if (lane.speed < 0 && obs.x + obs.width < 0) {
                            obs.x = w
                        }
                    }
                }

                // Animate hop
                if (isMovingRef.current && gameStateRef.current === "playing") {
                    moveProgressRef.current += dt * 10 // ~0.1s hop
                    if (moveProgressRef.current >= 1) {
                        moveProgressRef.current = 1
                        isMovingRef.current = false
                        playerXRef.current = targetXRef.current
                        playerRowRef.current = targetRowRef.current

                        // Landing particles
                        const py = h - (playerRowRef.current - (highestRowRef.current - Math.floor(h / TILE) * 0.6)) * TILE - TILE / 2
                        spawnParticles(playerXRef.current, py, NEON_CYAN, 6, 2)

                        // Check new high row
                        if (playerRowRef.current > highestRowRef.current) {
                            const gained = playerRowRef.current - highestRowRef.current
                            highestRowRef.current = playerRowRef.current
                            scoreRef.current += gained
                            setScore(scoreRef.current)
                            if (gained > 0) {
                                playScoreSound()
                                timerRef.current = Math.min(timerRef.current + TIMER_BONUS * gained, TIMER_START)
                            }
                        }

                        ensureLanes(playerRowRef.current, w)

                        // ── Collision check (after landing) ──
                        const currentLane = lanes.get(playerRowRef.current)
                        if (currentLane) {
                            const px = playerXRef.current
                            const pHalf = PLAYER_SIZE / 2 - 4

                            if (currentLane.type === "road") {
                                // Hit by car?
                                for (const obs of currentLane.obstacles) {
                                    if (px + pHalf > obs.x && px - pHalf < obs.x + obs.width) {
                                        // Player ran into a vehicle
                                        const screenY = h - (playerRowRef.current - (highestRowRef.current - Math.floor(h / TILE) * 0.6)) * TILE - TILE / 2
                                        spawnParticles(px, screenY, NEON_PINK, 40, 6)
                                        spawnParticles(px, screenY, NEON_ORANGE, 25, 4)
                                        spawnParticles(px, screenY, "#ffffff", 12, 3)
                                        playDeathSound()
                                        // Determine hit direction: player walked into vehicle, fling backwards
                                        const vehicleCenter = obs.x + obs.width / 2
                                        const hitDir = px < vehicleCenter ? -1 : 1
                                        hitDirRef.current = hitDir
                                        hitVxRef.current = hitDir * 180
                                        hitVyRef.current = -120
                                        hitSpinRef.current = 0
                                        hitPxRef.current = 0
                                        hitPyRef.current = 0
                                        hitAnimRef.current = 0
                                        dyingTimerRef.current = 0.8
                                        deathAnimRef.current = 1
                                        if (scoreRef.current > highScore) setHighScore(scoreRef.current)
                                        deathTypeRef.current = "vehicle"
                                        setGameState("dying")
                                        break
                                    }
                                }
                            } else if (currentLane.type === "river") {
                                // On a log?
                                let onLog = false
                                for (const obs of currentLane.obstacles) {
                                    if (px + pHalf > obs.x + 4 && px - pHalf < obs.x + obs.width - 4) {
                                        onLog = true
                                        break
                                    }
                                }
                                if (!onLog) {
                                    // SPLASH! Player jumped into water
                                    const screenY = h - (playerRowRef.current - (highestRowRef.current - Math.floor(h / TILE) * 0.6)) * TILE - TILE / 2
                                    spawnParticles(px, screenY, NEON_BLUE_WATER, 35, 5)
                                    spawnParticles(px, screenY, "#ffffff", 15, 3)
                                    playDrownSound()
                                    deathTypeRef.current = "splash"
                                    hitDirRef.current = 0
                                    hitVxRef.current = 0
                                    hitVyRef.current = 0
                                    hitSpinRef.current = 0
                                    hitPxRef.current = 0
                                    hitPyRef.current = 0
                                    hitAnimRef.current = 0
                                    dyingTimerRef.current = 1.0
                                    deathAnimRef.current = 1
                                    if (scoreRef.current > highScore) setHighScore(scoreRef.current)
                                    setGameState("dying")
                                }
                            }
                        }
                    }
                }

                // Continuous collision: if standing on a road, check if a vehicle ran into player
                if (!isMovingRef.current && gameStateRef.current === "playing") {
                    const currentLane = lanes.get(playerRowRef.current)
                    if (currentLane && currentLane.type === "road") {
                        const px = playerXRef.current
                        const pHalf = PLAYER_SIZE / 2 - 4
                        for (const obs of currentLane.obstacles) {
                            if (px + pHalf > obs.x && px - pHalf < obs.x + obs.width) {
                                const screenY = h - (playerRowRef.current - (highestRowRef.current - Math.floor(h / TILE) * 0.6)) * TILE - TILE / 2
                                spawnParticles(px, screenY, NEON_PINK, 40, 6)
                                spawnParticles(px, screenY, NEON_ORANGE, 25, 4)
                                spawnParticles(px, screenY, "#ffffff", 12, 3)
                                playDeathSound()
                                // Vehicle ran into player — fling in direction of vehicle travel
                                const hitDir = currentLane.speed > 0 ? 1 : -1
                                hitDirRef.current = hitDir
                                hitVxRef.current = hitDir * 250
                                hitVyRef.current = -150
                                hitSpinRef.current = 0
                                hitPxRef.current = 0
                                hitPyRef.current = 0
                                hitAnimRef.current = 0
                                dyingTimerRef.current = 0.8
                                deathAnimRef.current = 1
                                if (scoreRef.current > highScore) setHighScore(scoreRef.current)
                                deathTypeRef.current = "vehicle"
                                setGameState("dying")
                                break
                            }
                        }
                    }
                }

                // River drift: if player is on a log, move with it
                if (!isMovingRef.current && gameStateRef.current === "playing") {
                    const currentLane = lanes.get(playerRowRef.current)
                    if (currentLane && currentLane.type === "river") {
                        let onLog = false
                        const px = playerXRef.current
                        const pHalf = PLAYER_SIZE / 2 - 4
                        for (const obs of currentLane.obstacles) {
                            if (px + pHalf > obs.x + 4 && px - pHalf < obs.x + obs.width - 4) {
                                onLog = true
                                playerXRef.current += currentLane.speed * dt
                                // Clamp to screen
                                if (playerXRef.current < TILE / 2 || playerXRef.current > w - TILE / 2) {
                                    // Fell off edge while drifting on log
                                    const screenY = h - (playerRowRef.current - (highestRowRef.current - Math.floor(h / TILE) * 0.6)) * TILE - TILE / 2
                                    spawnParticles(playerXRef.current, screenY, NEON_BLUE_WATER, 30, 5)
                                    playDriftSound()
                                    deathTypeRef.current = "drift"
                                    const driftDir = playerXRef.current < TILE / 2 ? -1 : 1
                                    hitDirRef.current = driftDir
                                    hitVxRef.current = driftDir * 120
                                    hitVyRef.current = 0
                                    hitSpinRef.current = 0
                                    hitPxRef.current = 0
                                    hitPyRef.current = 0
                                    hitAnimRef.current = 0
                                    dyingTimerRef.current = 0.9
                                    deathAnimRef.current = 1
                                    if (scoreRef.current > highScore) setHighScore(scoreRef.current)
                                    setGameState("dying")
                                }
                                break
                            }
                        }
                        if (!onLog && gameStateRef.current === "playing") {
                            // Log drifted away — player fell into water
                            const screenY = h - (playerRowRef.current - (highestRowRef.current - Math.floor(h / TILE) * 0.6)) * TILE - TILE / 2
                            spawnParticles(playerXRef.current, screenY, NEON_BLUE_WATER, 35, 5)
                            playDrownSound()
                            deathTypeRef.current = "splash"
                            hitDirRef.current = 0
                            hitVxRef.current = 0
                            hitVyRef.current = 0
                            hitSpinRef.current = 0
                            hitPxRef.current = 0
                            hitPyRef.current = 0
                            hitAnimRef.current = 0
                            dyingTimerRef.current = 1.0
                            deathAnimRef.current = 1
                            if (scoreRef.current > highScore) setHighScore(scoreRef.current)
                            setGameState("dying")
                        }
                    }
                }
            }

            // Timer countdown
            if (gameStateRef.current === "playing") {
                timerRef.current -= dt
                // Warning tick sound
                const curSec = Math.ceil(timerRef.current)
                if (timerRef.current <= TIMER_WARNING && timerRef.current > 0 && curSec < lastTickRef.current) {
                    playTickSound()
                }
                lastTickRef.current = curSec

                if (timerRef.current <= 0) {
                    timerRef.current = 0
                    // Time's up — death
                    const px = playerXRef.current
                    const screenY = h - (playerRowRef.current - (highestRowRef.current - Math.floor(h / TILE) * 0.6)) * TILE - TILE / 2
                    spawnParticles(px, screenY, NEON_ORANGE, 30, 5)
                    spawnParticles(px, screenY, NEON_PINK, 20, 4)
                    playTimeoutSound()
                    deathTypeRef.current = "vehicle" // reuse vehicle death animation (collapse)
                    hitDirRef.current = 0
                    hitVxRef.current = 0
                    hitVyRef.current = 60
                    hitSpinRef.current = 0
                    hitPxRef.current = 0
                    hitPyRef.current = 0
                    hitAnimRef.current = 0
                    dyingTimerRef.current = 0.8
                    deathAnimRef.current = 1
                    if (scoreRef.current > highScore) setHighScore(scoreRef.current)
                    setGameState("dying")
                }
            }

            // Dying state: animate knockback/splash then transition to gameover
            if (gameStateRef.current === "dying") {
                hitAnimRef.current += dt
                const dtype = deathTypeRef.current

                if (dtype === "vehicle") {
                    // Vehicle hit: knockback with gravity + spin
                    hitVyRef.current += 400 * dt
                    hitPxRef.current += hitVxRef.current * dt
                    hitPyRef.current += hitVyRef.current * dt
                    hitVxRef.current *= 0.97
                    hitSpinRef.current += hitDirRef.current * dt * 12

                    if (hitAnimRef.current < 0.5) {
                        const trailPx = playerXRef.current + hitPxRef.current
                        const cameraRow = highestRowRef.current - Math.floor(h / TILE) * 0.6
                        const trailPy = h - (playerRowRef.current - cameraRow) * TILE - TILE / 2 + hitPyRef.current
                        spawnParticles(trailPx, trailPy, NEON_PINK, 2, 2)
                    }
                } else if (dtype === "splash") {
                    // Splash: sink downward with wobble, bubble particles
                    hitPyRef.current += 40 * dt // slow sinking
                    hitSpinRef.current = Math.sin(hitAnimRef.current * 8) * 0.15 // gentle wobble

                    // Bubbles rising from player
                    if (hitAnimRef.current < 0.7 && Math.random() < 0.4) {
                        const cameraRow = highestRowRef.current - Math.floor(h / TILE) * 0.6
                        const bubX = playerXRef.current + (Math.random() - 0.5) * 20
                        const bubY = h - (playerRowRef.current - cameraRow) * TILE - TILE / 2 + hitPyRef.current
                        spawnParticles(bubX, bubY, "#88eeff", 1, 1.5)
                    }

                    // Ripple ring particles at splash origin
                    if (hitAnimRef.current < 0.15 && Math.random() < 0.6) {
                        const cameraRow = highestRowRef.current - Math.floor(h / TILE) * 0.6
                        const ry = h - (playerRowRef.current - cameraRow) * TILE - TILE / 2
                        const angle = Math.random() * Math.PI * 2
                        const dist = 10 + hitAnimRef.current * 80
                        spawnParticles(
                            playerXRef.current + Math.cos(angle) * dist,
                            ry + Math.sin(angle) * dist * 0.4,
                            "#aaeeff", 1, 0.5
                        )
                    }
                } else if (dtype === "drift") {
                    // Drift off screen: continue sliding sideways, slight sinking
                    hitPxRef.current += hitVxRef.current * dt
                    hitPyRef.current += 15 * dt // gentle sink
                    hitSpinRef.current += hitDirRef.current * dt * 3 // slow tilt

                    // Water trail particles
                    if (hitAnimRef.current < 0.6 && Math.random() < 0.3) {
                        const cameraRow = highestRowRef.current - Math.floor(h / TILE) * 0.6
                        const trailX = playerXRef.current + hitPxRef.current
                        const trailY = h - (playerRowRef.current - cameraRow) * TILE - TILE / 2 + hitPyRef.current
                        spawnParticles(trailX, trailY, NEON_BLUE_WATER, 1, 1)
                    }
                }

                dyingTimerRef.current -= dt
                if (dyingTimerRef.current <= 0) {
                    setGameState("gameover")
                }
            }

            // Death anim fade (for gameover)
            if (gameStateRef.current === "gameover" && deathAnimRef.current > 0) {
                deathAnimRef.current -= dt * 2
                if (deathAnimRef.current < 0) deathAnimRef.current = 0
            }

            // Update particles
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i]
                p.x += p.vx
                p.y += p.vy
                p.vx *= 0.96
                p.vy *= 0.96
                p.life -= dt / p.maxLife
                if (p.life <= 0) particlesRef.current.splice(i, 1)
            }

            // ── Draw ──
            draw(ctx, w, h, dt)

            animRef.current = requestAnimationFrame(loop)
        }

        const NEON_BLUE_WATER = "#0088ff"

        const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, _dt: number) => {
            const lanes = lanesRef.current

            // Camera: player stays ~60% from bottom
            const cameraRow = highestRowRef.current - Math.floor(h / TILE) * 0.6
            const getScreenY = (row: number) => h - (row - cameraRow) * TILE - TILE / 2

            ctx.fillStyle = TABLE_BG
            ctx.fillRect(0, 0, w, h)

            // Determine visible row range
            const bottomRow = Math.floor(cameraRow - 2)
            const topRow = Math.ceil(cameraRow + h / TILE + 2)

            // ── Draw lanes ──
            for (let r = bottomRow; r <= topRow; r++) {
                const lane = lanes.get(r)
                if (!lane) continue
                const ly = getScreenY(r) - TILE / 2

                // Lane background
                if (lane.type === "safe") {
                    ctx.fillStyle = "#0d1a0d"
                    ctx.fillRect(0, ly, w, TILE)

                    // Safe zone green edge glow (subtle welcoming feel)
                    ctx.save()
                    ctx.shadowColor = NEON_GREEN
                    ctx.shadowBlur = 6
                    ctx.strokeStyle = NEON_GREEN
                    ctx.globalAlpha = 0.1
                    ctx.lineWidth = 1
                    ctx.beginPath()
                    ctx.moveTo(0, ly)
                    ctx.lineTo(w, ly)
                    ctx.stroke()
                    ctx.beginPath()
                    ctx.moveTo(0, ly + TILE)
                    ctx.lineTo(w, ly + TILE)
                    ctx.stroke()
                    ctx.restore()

                    // Grass dots
                    ctx.save()
                    ctx.globalAlpha = 0.15
                    for (let gx = 10; gx < w; gx += 25) {
                        const gy = ly + 10 + ((r * 17 + gx * 7) % 20)
                        ctx.fillStyle = NEON_GREEN
                        ctx.beginPath()
                        ctx.arc(gx, gy, 1.5, 0, Math.PI * 2)
                        ctx.fill()
                    }
                    ctx.restore()
                } else if (lane.type === "road") {
                    ctx.fillStyle = lane.color
                    ctx.fillRect(0, ly, w, TILE)

                    // Danger tint — subtle red overlay
                    ctx.save()
                    ctx.globalAlpha = 0.06
                    ctx.fillStyle = NEON_PINK
                    ctx.fillRect(0, ly, w, TILE)
                    ctx.restore()

                    // Top & bottom edge danger lines (red glow)
                    ctx.save()
                    ctx.shadowColor = EDGE_RED
                    ctx.shadowBlur = 8
                    ctx.strokeStyle = EDGE_RED
                    ctx.globalAlpha = 0.25
                    ctx.lineWidth = 1.5
                    ctx.beginPath()
                    ctx.moveTo(0, ly)
                    ctx.lineTo(w, ly)
                    ctx.stroke()
                    ctx.beginPath()
                    ctx.moveTo(0, ly + TILE)
                    ctx.lineTo(w, ly + TILE)
                    ctx.stroke()
                    ctx.restore()

                    // Lane markings
                    ctx.save()
                    ctx.strokeStyle = "rgba(255,255,255,0.06)"
                    ctx.lineWidth = 1
                    ctx.setLineDash([12, 12])
                    ctx.beginPath()
                    ctx.moveTo(0, ly + TILE / 2)
                    ctx.lineTo(w, ly + TILE / 2)
                    ctx.stroke()
                    ctx.setLineDash([])
                    ctx.restore()

                    // Animated chevron warning markers on sides
                    ctx.save()
                    const chevronPhase = (lastTimeRef.current * 0.003 + r * 2) % 20
                    ctx.globalAlpha = 0.12
                    ctx.fillStyle = NEON_PINK
                    ctx.font = "bold 10px monospace"
                    ctx.textBaseline = "middle"
                    // Left side warning
                    ctx.textAlign = "left"
                    ctx.fillText(lane.speed > 0 ? "▸▸" : "◂◂", 4 + (chevronPhase % 6), ly + TILE / 2)
                    // Right side warning
                    ctx.textAlign = "right"
                    ctx.fillText(lane.speed > 0 ? "▸▸" : "◂◂", w - 4 - (chevronPhase % 6), ly + TILE / 2)
                    ctx.restore()
                } else if (lane.type === "river") {
                    // Deep water base
                    ctx.fillStyle = lane.color
                    ctx.fillRect(0, ly, w, TILE)

                    // Strong blue tint overlay
                    ctx.save()
                    ctx.globalAlpha = 0.18
                    ctx.fillStyle = "#0066dd"
                    ctx.fillRect(0, ly, w, TILE)
                    ctx.restore()

                    // Animated full-width water waves (multiple layers)
                    ctx.save()
                    const time = lastTimeRef.current * 0.001

                    // Layer 1: broad slow sine waves (body of water movement)
                    ctx.globalAlpha = 0.13
                    ctx.fillStyle = "#0088ee"
                    for (let wx = 0; wx < w; wx += 2) {
                        const wy = ly + TILE * 0.3 + Math.sin(wx * 0.03 + time * 1.2 + r * 2) * 6
                        ctx.fillRect(wx, wy, 2, 2.5)
                    }

                    // Layer 2: medium ripple wave (offset)
                    ctx.globalAlpha = 0.11
                    ctx.fillStyle = "#00bbff"
                    for (let wx = 0; wx < w; wx += 4) {
                        const wy = ly + TILE * 0.55 + Math.sin(wx * 0.05 + time * 2.5 + r * 3.7) * 4
                        ctx.fillRect(wx, wy, 3, 1.5)
                    }

                    // Layer 3: fast thin cyan ripples
                    ctx.globalAlpha = 0.16
                    ctx.fillStyle = NEON_CYAN
                    for (let wx = 0; wx < w; wx += 10) {
                        const wy = ly + TILE * 0.65 + Math.sin(wx * 0.09 + time * 4 + r * 5) * 3
                        ctx.fillRect(wx, wy, 6, 1)
                    }

                    // Layer 4: bright specular highlights (sun sparkle)
                    ctx.globalAlpha = 0.25
                    ctx.fillStyle = "#88eeff"
                    for (let wx = 5; wx < w; wx += 25) {
                        const sparkle = Math.sin(wx * 0.12 + time * 5 + r * 1.3)
                        if (sparkle > 0.6) {
                            const wy = ly + TILE * 0.4 + Math.sin(wx * 0.07 + time * 2 + r) * 4
                            ctx.fillRect(wx, wy, 3, 1)
                        }
                    }

                    // Layer 5: flowing curved wave lines
                    ctx.globalAlpha = 0.09
                    ctx.strokeStyle = "#44ccff"
                    ctx.lineWidth = 1
                    ctx.beginPath()
                    for (let wx = 0; wx < w; wx += 2) {
                        const wy = ly + TILE * 0.45 + Math.sin(wx * 0.035 + time * 1.8 + r * 4) * 5
                        if (wx === 0) ctx.moveTo(wx, wy)
                        else ctx.lineTo(wx, wy)
                    }
                    ctx.stroke()

                    // Layer 6: second flowing wave line (offset)
                    ctx.globalAlpha = 0.07
                    ctx.strokeStyle = "#00ddff"
                    ctx.beginPath()
                    for (let wx = 0; wx < w; wx += 2) {
                        const wy = ly + TILE * 0.7 + Math.sin(wx * 0.04 + time * 2.2 + r * 6 + 1) * 4
                        if (wx === 0) ctx.moveTo(wx, wy)
                        else ctx.lineTo(wx, wy)
                    }
                    ctx.stroke()

                    // Foam/bubble dots (random sparkle)
                    ctx.globalAlpha = 0.18
                    ctx.fillStyle = "#aaeeff"
                    for (let bx = 0; bx < w; bx += 35) {
                        const bobble = Math.sin(time * 3 + bx * 0.2 + r * 7)
                        if (bobble > 0.3) {
                            const by = ly + TILE * 0.5 + Math.sin(bx * 0.1 + time * 2) * 6
                            ctx.beginPath()
                            ctx.arc(bx, by, 1 + bobble * 1.2, 0, Math.PI * 2)
                            ctx.fill()
                        }
                    }

                    ctx.restore()

                    // Top & bottom edge lines (bright blue glow)
                    ctx.save()
                    ctx.shadowColor = "#00aaff"
                    ctx.shadowBlur = 14
                    ctx.strokeStyle = "#00aaff"
                    ctx.globalAlpha = 0.45
                    ctx.lineWidth = 2
                    ctx.beginPath()
                    ctx.moveTo(0, ly)
                    ctx.lineTo(w, ly)
                    ctx.stroke()
                    ctx.beginPath()
                    ctx.moveTo(0, ly + TILE)
                    ctx.lineTo(w, ly + TILE)
                    ctx.stroke()
                    ctx.restore()

                    // Animated wave symbols on sides
                    ctx.save()
                    const wavePhase = Math.sin(time * 4 + r) * 0.5 + 0.5
                    ctx.globalAlpha = 0.3 + wavePhase * 0.15
                    ctx.fillStyle = "#00ccff"
                    ctx.font = "bold 12px monospace"
                    ctx.textBaseline = "middle"
                    ctx.textAlign = "left"
                    ctx.fillText("≋", 4, ly + TILE / 2)
                    ctx.textAlign = "right"
                    ctx.fillText("≋", w - 4, ly + TILE / 2)
                    ctx.restore()
                }

                // ── Draw obstacles ──
                for (const obs of lane.obstacles) {
                    const ox = obs.x
                    const oy = ly + 4
                    const oh = TILE - 8

                    if (lane.type === "road") {
                        const goingRight = lane.speed > 0
                        const vType = obs.vehicleType || "car"

                        if (vType === "bike") {
                            // ── BIKE RENDERING ──
                            ctx.save()
                            ctx.shadowColor = obs.glowColor
                            ctx.shadowBlur = 10

                            const bikeCx = ox + obs.width / 2
                            const bikeCy = oy + oh / 2

                            // Bike body — thin elongated shape
                            ctx.fillStyle = obs.color
                            const bw = obs.width - 4
                            const bh = oh * 0.38
                            const br = 3
                            ctx.beginPath()
                            ctx.moveTo(bikeCx - bw / 2 + br, bikeCy - bh / 2)
                            ctx.lineTo(bikeCx + bw / 2 - br, bikeCy - bh / 2)
                            ctx.quadraticCurveTo(bikeCx + bw / 2, bikeCy - bh / 2, bikeCx + bw / 2, bikeCy - bh / 2 + br)
                            ctx.lineTo(bikeCx + bw / 2, bikeCy + bh / 2 - br)
                            ctx.quadraticCurveTo(bikeCx + bw / 2, bikeCy + bh / 2, bikeCx + bw / 2 - br, bikeCy + bh / 2)
                            ctx.lineTo(bikeCx - bw / 2 + br, bikeCy + bh / 2)
                            ctx.quadraticCurveTo(bikeCx - bw / 2, bikeCy + bh / 2, bikeCx - bw / 2, bikeCy + bh / 2 - br)
                            ctx.lineTo(bikeCx - bw / 2, bikeCy - bh / 2 + br)
                            ctx.quadraticCurveTo(bikeCx - bw / 2, bikeCy - bh / 2, bikeCx - bw / 2 + br, bikeCy - bh / 2)
                            ctx.closePath()
                            ctx.fill()

                            // Body gradient
                            ctx.shadowBlur = 0
                            const bg = ctx.createLinearGradient(ox, bikeCy - bh / 2, ox, bikeCy + bh / 2)
                            bg.addColorStop(0, "rgba(255,255,255,0.3)")
                            bg.addColorStop(0.5, "rgba(255,255,255,0)")
                            bg.addColorStop(1, "rgba(0,0,0,0.3)")
                            ctx.fillStyle = bg
                            ctx.fill()

                            // Rider silhouette (small circle head + body blob)
                            const riderX = goingRight ? bikeCx + 1 : bikeCx - 1
                            ctx.fillStyle = "rgba(0,0,0,0.5)"
                            // Head
                            ctx.beginPath()
                            ctx.arc(riderX, bikeCy - 2, 3.5, 0, Math.PI * 2)
                            ctx.fill()
                            // Torso
                            ctx.beginPath()
                            ctx.ellipse(riderX, bikeCy + 3, 2.5, 4, 0, 0, Math.PI * 2)
                            ctx.fill()
                            // Helmet highlight
                            ctx.fillStyle = obs.color
                            ctx.globalAlpha = 0.4
                            ctx.beginPath()
                            ctx.arc(riderX, bikeCy - 3, 2, 0, Math.PI * 2)
                            ctx.fill()
                            ctx.globalAlpha = 1

                            // Two wheels
                            ctx.fillStyle = "#111111"
                            ctx.strokeStyle = "rgba(255,255,255,0.2)"
                            ctx.lineWidth = 0.8
                            const fwX = goingRight ? ox + obs.width - 5 : ox + 5
                            const rwX = goingRight ? ox + 5 : ox + obs.width - 5
                            ctx.beginPath()
                            ctx.arc(fwX, oy - 0.5, 3, 0, Math.PI * 2)
                            ctx.fill(); ctx.stroke()
                            ctx.beginPath()
                            ctx.arc(fwX, oy + oh + 0.5, 3, 0, Math.PI * 2)
                            ctx.fill(); ctx.stroke()
                            ctx.beginPath()
                            ctx.arc(rwX, oy - 0.5, 3, 0, Math.PI * 2)
                            ctx.fill(); ctx.stroke()
                            ctx.beginPath()
                            ctx.arc(rwX, oy + oh + 0.5, 3, 0, Math.PI * 2)
                            ctx.fill(); ctx.stroke()

                            // Single headlight
                            const hlX = goingRight ? ox + obs.width - 1 : ox + 1
                            ctx.fillStyle = "#ffffff"
                            ctx.shadowColor = "#ffffaa"
                            ctx.shadowBlur = 8
                            ctx.beginPath()
                            ctx.arc(hlX, bikeCy, 2, 0, Math.PI * 2)
                            ctx.fill()

                            // Tail light
                            const tlX = goingRight ? ox + 1 : ox + obs.width - 1
                            ctx.fillStyle = NEON_PINK
                            ctx.shadowColor = NEON_PINK
                            ctx.shadowBlur = 6
                            ctx.beginPath()
                            ctx.arc(tlX, bikeCy, 1.5, 0, Math.PI * 2)
                            ctx.fill()

                            ctx.restore()
                        } else if (vType === "police" || vType === "firetruck" || vType === "ambulance" || vType === "taxi") {
                            // ── SPECIAL VEHICLE RENDERING ──
                            const goRight = goingRight
                            const isLong = vType === "firetruck" || vType === "ambulance"

                            ctx.save()
                            ctx.shadowColor = obs.glowColor
                            ctx.shadowBlur = 14
                            ctx.fillStyle = obs.color

                            // Body shape (rounded rect)
                            const cr = 4
                            ctx.beginPath()
                            ctx.moveTo(ox + cr, oy)
                            ctx.lineTo(ox + obs.width - cr, oy)
                            ctx.quadraticCurveTo(ox + obs.width, oy, ox + obs.width, oy + cr)
                            ctx.lineTo(ox + obs.width, oy + oh - cr)
                            ctx.quadraticCurveTo(ox + obs.width, oy + oh, ox + obs.width - cr, oy + oh)
                            ctx.lineTo(ox + cr, oy + oh)
                            ctx.quadraticCurveTo(ox, oy + oh, ox, oy + oh - cr)
                            ctx.lineTo(ox, oy + cr)
                            ctx.quadraticCurveTo(ox, oy, ox + cr, oy)
                            ctx.closePath()
                            ctx.fill()

                            // Body gradient
                            ctx.shadowBlur = 0
                            const sg = ctx.createLinearGradient(ox, oy, ox, oy + oh)
                            sg.addColorStop(0, "rgba(255,255,255,0.22)")
                            sg.addColorStop(0.4, "rgba(255,255,255,0)")
                            sg.addColorStop(1, "rgba(0,0,0,0.3)")
                            ctx.fillStyle = sg
                            ctx.fill()

                            // ── Per-type unique markings ──
                            const time = lastTimeRef.current * 0.001

                            if (vType === "police") {
                                // White lower-body stripe
                                ctx.fillStyle = "#ffffff"
                                ctx.globalAlpha = 0.35
                                ctx.fillRect(ox + 4, oy + oh * 0.55, obs.width - 8, oh * 0.2)
                                ctx.globalAlpha = 1

                                // "P" badge
                                ctx.fillStyle = "#aaccff"
                                ctx.globalAlpha = 0.4
                                ctx.font = "bold 7px monospace"
                                ctx.textAlign = "center"
                                ctx.textBaseline = "middle"
                                ctx.fillText("P", ox + obs.width / 2, oy + oh / 2 + 1)
                                ctx.globalAlpha = 1

                                // Flashing siren lights (red + blue alternating)
                                const sirenPhase = Math.sin(time * 12 + ox * 0.1)
                                const siren1Color = sirenPhase > 0 ? "#ff0000" : "#0044ff"
                                const siren2Color = sirenPhase > 0 ? "#0044ff" : "#ff0000"
                                const sirenY = oy + 2
                                const s1x = ox + obs.width * 0.35
                                const s2x = ox + obs.width * 0.65

                                ctx.shadowColor = siren1Color
                                ctx.shadowBlur = 16
                                ctx.fillStyle = siren1Color
                                ctx.globalAlpha = 0.7 + Math.abs(sirenPhase) * 0.3
                                ctx.beginPath()
                                ctx.arc(s1x, sirenY, 2.5, 0, Math.PI * 2)
                                ctx.fill()

                                ctx.shadowColor = siren2Color
                                ctx.fillStyle = siren2Color
                                ctx.beginPath()
                                ctx.arc(s2x, sirenY, 2.5, 0, Math.PI * 2)
                                ctx.fill()
                                ctx.globalAlpha = 1

                                // Siren glow pulse on the road around the car
                                ctx.globalAlpha = 0.04 + Math.abs(sirenPhase) * 0.04
                                ctx.fillStyle = siren1Color
                                ctx.fillRect(ox - 10, oy - 4, obs.width + 20, oh + 8)
                                ctx.globalAlpha = 1

                            } else if (vType === "firetruck") {
                                // White stripe along midsection
                                ctx.fillStyle = "#ffffff"
                                ctx.globalAlpha = 0.2
                                ctx.fillRect(ox + 4, oy + oh * 0.42, obs.width - 8, oh * 0.16)
                                ctx.globalAlpha = 1

                                // Ladder rack lines on top
                                ctx.strokeStyle = "#ffaa44"
                                ctx.globalAlpha = 0.2
                                ctx.lineWidth = 0.8
                                const ladderStart = goRight ? ox + 14 : ox + 6
                                const ladderEnd = goRight ? ox + obs.width - 6 : ox + obs.width - 14
                                for (let ll = 0; ll < 3; ll++) {
                                    const lly = oy + 4 + ll * 3
                                    ctx.beginPath()
                                    ctx.moveTo(ladderStart, lly)
                                    ctx.lineTo(ladderEnd, lly)
                                    ctx.stroke()
                                }
                                // Ladder cross-rungs
                                for (let rx = ladderStart + 8; rx < ladderEnd - 4; rx += 10) {
                                    ctx.beginPath()
                                    ctx.moveTo(rx, oy + 3)
                                    ctx.lineTo(rx, oy + 10)
                                    ctx.stroke()
                                }
                                ctx.globalAlpha = 1

                                // Flashing red lights
                                const fireFlash = Math.sin(time * 10 + ox * 0.15)
                                ctx.shadowColor = "#ff2200"
                                ctx.shadowBlur = 18
                                ctx.fillStyle = "#ff2200"
                                ctx.globalAlpha = 0.6 + Math.abs(fireFlash) * 0.4
                                ctx.beginPath()
                                ctx.arc(ox + obs.width * 0.3, oy + 2, 2.5, 0, Math.PI * 2)
                                ctx.fill()
                                ctx.beginPath()
                                ctx.arc(ox + obs.width * 0.7, oy + 2, 2.5, 0, Math.PI * 2)
                                ctx.fill()
                                ctx.globalAlpha = 1

                                // Red glow pulse
                                ctx.globalAlpha = 0.03 + Math.abs(fireFlash) * 0.04
                                ctx.fillStyle = "#ff2200"
                                ctx.fillRect(ox - 8, oy - 3, obs.width + 16, oh + 6)
                                ctx.globalAlpha = 1

                            } else if (vType === "ambulance") {
                                // Red cross (medical symbol)
                                ctx.fillStyle = "#ee2222"
                                ctx.globalAlpha = 0.6
                                const crossCx = ox + obs.width / 2
                                const crossCy = oy + oh / 2
                                ctx.fillRect(crossCx - 5, crossCy - 1.5, 10, 3)
                                ctx.fillRect(crossCx - 1.5, crossCy - 5, 3, 10)
                                ctx.globalAlpha = 1

                                // Red stripe along sides
                                ctx.fillStyle = "#dd2222"
                                ctx.globalAlpha = 0.25
                                ctx.fillRect(ox + 3, oy + oh - 6, obs.width - 6, 3)
                                ctx.globalAlpha = 1

                                // Flashing white + red lights
                                const ambuFlash = Math.sin(time * 14 + ox * 0.12)
                                const ambuC1 = ambuFlash > 0 ? "#ffffff" : "#ff0000"
                                const ambuC2 = ambuFlash > 0 ? "#ff0000" : "#ffffff"
                                ctx.shadowColor = ambuC1
                                ctx.shadowBlur = 14
                                ctx.fillStyle = ambuC1
                                ctx.globalAlpha = 0.7 + Math.abs(ambuFlash) * 0.3
                                ctx.beginPath()
                                ctx.arc(ox + obs.width * 0.35, oy + 2, 2.5, 0, Math.PI * 2)
                                ctx.fill()
                                ctx.shadowColor = ambuC2
                                ctx.fillStyle = ambuC2
                                ctx.beginPath()
                                ctx.arc(ox + obs.width * 0.65, oy + 2, 2.5, 0, Math.PI * 2)
                                ctx.fill()
                                ctx.globalAlpha = 1

                                // Ambient glow
                                ctx.globalAlpha = 0.03 + Math.abs(ambuFlash) * 0.03
                                ctx.fillStyle = "#ff4444"
                                ctx.fillRect(ox - 8, oy - 3, obs.width + 16, oh + 6)
                                ctx.globalAlpha = 1

                            } else if (vType === "taxi") {
                                // Checkerboard stripe pattern along side
                                ctx.fillStyle = "#111111"
                                ctx.globalAlpha = 0.4
                                const cbY = oy + oh * 0.6
                                const cbH = 3
                                for (let cbx = ox + 6; cbx < ox + obs.width - 6; cbx += 6) {
                                    const even = Math.floor((cbx - ox) / 6) % 2 === 0
                                    if (even) {
                                        ctx.fillRect(cbx, cbY, 3, cbH)
                                    }
                                }
                                ctx.globalAlpha = 1

                                // "TAXI" roof light (orange/yellow glow on top center)
                                ctx.fillStyle = "#ffee88"
                                ctx.shadowColor = "#ffcc00"
                                ctx.shadowBlur = 12
                                ctx.globalAlpha = 0.9
                                const tlx = ox + obs.width / 2
                                ctx.fillRect(tlx - 5, oy + 1, 10, 3)
                                ctx.globalAlpha = 1

                                // Subtle warm glow
                                ctx.globalAlpha = 0.03
                                ctx.fillStyle = "#ffcc00"
                                ctx.fillRect(ox - 4, oy - 2, obs.width + 8, oh + 4)
                                ctx.globalAlpha = 1
                            }

                            // ── Windshield (shared for specials) ──
                            const sCabinW = isLong ? Math.min(obs.width * 0.25, 18) : Math.min(obs.width * 0.35, 18)
                            const sCabinStart = goRight ? ox + obs.width - 5 - sCabinW : ox + 5
                            ctx.fillStyle = "rgba(0,0,0,0.35)"
                            ctx.shadowBlur = 0
                            const swr = 2
                            ctx.beginPath()
                            ctx.moveTo(sCabinStart + swr, oy + 3)
                            ctx.lineTo(sCabinStart + sCabinW - swr, oy + 3)
                            ctx.quadraticCurveTo(sCabinStart + sCabinW, oy + 3, sCabinStart + sCabinW, oy + 3 + swr)
                            ctx.lineTo(sCabinStart + sCabinW, oy + oh - 3 - swr)
                            ctx.quadraticCurveTo(sCabinStart + sCabinW, oy + oh - 3, sCabinStart + sCabinW - swr, oy + oh - 3)
                            ctx.lineTo(sCabinStart + swr, oy + oh - 3)
                            ctx.quadraticCurveTo(sCabinStart, oy + oh - 3, sCabinStart, oy + oh - 3 - swr)
                            ctx.lineTo(sCabinStart, oy + 3 + swr)
                            ctx.quadraticCurveTo(sCabinStart, oy + 3, sCabinStart + swr, oy + 3)
                            ctx.closePath()
                            ctx.fill()
                            ctx.fillStyle = "rgba(100,200,255,0.1)"
                            ctx.fill()

                            // ── Wheels ──
                            ctx.fillStyle = "#111111"
                            ctx.strokeStyle = "rgba(255,255,255,0.15)"
                            ctx.lineWidth = 0.8
                            const sFrontX = goRight ? ox + obs.width - 8 : ox + 8
                            const sRearX = goRight ? ox + 8 : ox + obs.width - 8
                            ctx.beginPath(); ctx.arc(sFrontX, oy - 0.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
                            ctx.beginPath(); ctx.arc(sFrontX, oy + oh + 0.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
                            ctx.beginPath(); ctx.arc(sRearX, oy - 0.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
                            ctx.beginPath(); ctx.arc(sRearX, oy + oh + 0.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
                            if (isLong) {
                                const sMidX = (sFrontX + sRearX) / 2
                                ctx.beginPath(); ctx.arc(sMidX, oy - 0.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
                                ctx.beginPath(); ctx.arc(sMidX, oy + oh + 0.5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
                            }

                            // ── Headlights ──
                            const sHlSide = goRight ? ox + obs.width - 2 : ox + 2
                            ctx.fillStyle = "#ffffff"
                            ctx.shadowColor = "#ffffaa"
                            ctx.shadowBlur = 10
                            ctx.beginPath(); ctx.arc(sHlSide, oy + 5, 2.5, 0, Math.PI * 2); ctx.fill()
                            ctx.beginPath(); ctx.arc(sHlSide, oy + oh - 5, 2.5, 0, Math.PI * 2); ctx.fill()

                            // ── Taillights ──
                            const sTlSide = goRight ? ox + 2 : ox + obs.width - 2
                            ctx.fillStyle = NEON_PINK
                            ctx.shadowColor = NEON_PINK
                            ctx.shadowBlur = 8
                            ctx.beginPath(); ctx.arc(sTlSide, oy + 5, 2, 0, Math.PI * 2); ctx.fill()
                            ctx.beginPath(); ctx.arc(sTlSide, oy + oh - 5, 2, 0, Math.PI * 2); ctx.fill()

                            ctx.restore()

                        } else {
                            // ── CAR / TRUCK RENDERING ──
                            const isTruck = vType === "truck"

                            // Car/truck body
                            ctx.save()
                            ctx.shadowColor = obs.glowColor
                            ctx.shadowBlur = 12
                            ctx.fillStyle = obs.color
                            const cr = 4
                            ctx.beginPath()
                            ctx.moveTo(ox + cr, oy)
                            ctx.lineTo(ox + obs.width - cr, oy)
                            ctx.quadraticCurveTo(ox + obs.width, oy, ox + obs.width, oy + cr)
                            ctx.lineTo(ox + obs.width, oy + oh - cr)
                            ctx.quadraticCurveTo(ox + obs.width, oy + oh, ox + obs.width - cr, oy + oh)
                            ctx.lineTo(ox + cr, oy + oh)
                            ctx.quadraticCurveTo(ox, oy + oh, ox, oy + oh - cr)
                            ctx.lineTo(ox, oy + cr)
                            ctx.quadraticCurveTo(ox, oy, ox + cr, oy)
                            ctx.closePath()
                            ctx.fill()

                            // Body gradient (top-lit)
                            ctx.shadowBlur = 0
                            const cg = ctx.createLinearGradient(ox, oy, ox, oy + oh)
                            cg.addColorStop(0, "rgba(255,255,255,0.25)")
                            cg.addColorStop(0.4, "rgba(255,255,255,0)")
                            cg.addColorStop(1, "rgba(0,0,0,0.35)")
                            ctx.fillStyle = cg
                            ctx.fill()

                            // ── Windshield / windows ──
                            const cabinInset = isTruck ? 6 : 5
                            const cabinW = isTruck ? Math.min(obs.width * 0.3, 22) : Math.min(obs.width * 0.4, 20)
                            const cabinStart = goingRight ? ox + obs.width - cabinInset - cabinW : ox + cabinInset

                            ctx.fillStyle = "rgba(0,0,0,0.4)"
                            const wr = 2
                            const wxp = cabinStart
                            const wyp = oy + 3
                            const ww = cabinW
                            const wh = oh - 6
                            ctx.beginPath()
                            ctx.moveTo(wxp + wr, wyp)
                            ctx.lineTo(wxp + ww - wr, wyp)
                            ctx.quadraticCurveTo(wxp + ww, wyp, wxp + ww, wyp + wr)
                            ctx.lineTo(wxp + ww, wyp + wh - wr)
                            ctx.quadraticCurveTo(wxp + ww, wyp + wh, wxp + ww - wr, wyp + wh)
                            ctx.lineTo(wxp + wr, wyp + wh)
                            ctx.quadraticCurveTo(wxp, wyp + wh, wxp, wyp + wh - wr)
                            ctx.lineTo(wxp, wyp + wr)
                            ctx.quadraticCurveTo(wxp, wyp, wxp + wr, wyp)
                            ctx.closePath()
                            ctx.fill()

                            ctx.fillStyle = "rgba(100,200,255,0.12)"
                            ctx.fill()

                            ctx.strokeStyle = obs.color
                            ctx.lineWidth = 1
                            ctx.beginPath()
                            ctx.moveTo(wxp + 1, wyp + wh / 2)
                            ctx.lineTo(wxp + ww - 1, wyp + wh / 2)
                            ctx.stroke()

                            // ── Truck cargo area ──
                            if (isTruck) {
                                const cargoStart = goingRight ? ox + 4 : ox + cabinInset + cabinW + 2
                                const cargoW = obs.width - cabinW - cabinInset - 6
                                if (cargoW > 8) {
                                    ctx.strokeStyle = "rgba(255,255,255,0.12)"
                                    ctx.lineWidth = 0.8
                                    ctx.strokeRect(cargoStart, oy + 2, cargoW, oh - 4)
                                    const panels = Math.floor(cargoW / 12)
                                    for (let p = 1; p < panels; p++) {
                                        const px2 = cargoStart + (cargoW / panels) * p
                                        ctx.beginPath()
                                        ctx.moveTo(px2, oy + 4)
                                        ctx.lineTo(px2, oy + oh - 4)
                                        ctx.stroke()
                                    }
                                }
                            }

                            // ── Wheels ──
                            ctx.fillStyle = "#111111"
                            ctx.strokeStyle = "rgba(255,255,255,0.15)"
                            ctx.lineWidth = 0.8
                            const frontX = goingRight ? ox + obs.width - 8 : ox + 8
                            ctx.beginPath()
                            ctx.arc(frontX, oy - 0.5, 3, 0, Math.PI * 2)
                            ctx.fill(); ctx.stroke()
                            ctx.beginPath()
                            ctx.arc(frontX, oy + oh + 0.5, 3, 0, Math.PI * 2)
                            ctx.fill(); ctx.stroke()
                            const rearX = goingRight ? ox + 8 : ox + obs.width - 8
                            ctx.beginPath()
                            ctx.arc(rearX, oy - 0.5, 3, 0, Math.PI * 2)
                            ctx.fill(); ctx.stroke()
                            ctx.beginPath()
                            ctx.arc(rearX, oy + oh + 0.5, 3, 0, Math.PI * 2)
                            ctx.fill(); ctx.stroke()
                            if (isTruck) {
                                const midX = (frontX + rearX) / 2
                                ctx.beginPath()
                                ctx.arc(midX, oy - 0.5, 3, 0, Math.PI * 2)
                                ctx.fill(); ctx.stroke()
                                ctx.beginPath()
                                ctx.arc(midX, oy + oh + 0.5, 3, 0, Math.PI * 2)
                                ctx.fill(); ctx.stroke()
                            }

                            // ── Headlights ──
                            const hlSide = goingRight ? ox + obs.width - 2 : ox + 2
                            ctx.fillStyle = "#ffffff"
                            ctx.shadowColor = "#ffffaa"
                            ctx.shadowBlur = 10
                            ctx.beginPath()
                            ctx.arc(hlSide, oy + 5, 2.5, 0, Math.PI * 2)
                            ctx.fill()
                            ctx.beginPath()
                            ctx.arc(hlSide, oy + oh - 5, 2.5, 0, Math.PI * 2)
                            ctx.fill()

                            // Headlight beam cone
                            ctx.globalAlpha = 0.06
                            ctx.fillStyle = "#ffffcc"
                            if (goingRight) {
                                ctx.beginPath()
                                ctx.moveTo(hlSide, oy + 4)
                                ctx.lineTo(hlSide + 18, oy - 2)
                                ctx.lineTo(hlSide + 18, oy + 12)
                                ctx.closePath()
                                ctx.fill()
                                ctx.beginPath()
                                ctx.moveTo(hlSide, oy + oh - 4)
                                ctx.lineTo(hlSide + 18, oy + oh - 12)
                                ctx.lineTo(hlSide + 18, oy + oh + 2)
                                ctx.closePath()
                                ctx.fill()
                            } else {
                                ctx.beginPath()
                                ctx.moveTo(hlSide, oy + 4)
                                ctx.lineTo(hlSide - 18, oy - 2)
                                ctx.lineTo(hlSide - 18, oy + 12)
                                ctx.closePath()
                                ctx.fill()
                                ctx.beginPath()
                                ctx.moveTo(hlSide, oy + oh - 4)
                                ctx.lineTo(hlSide - 18, oy + oh - 12)
                                ctx.lineTo(hlSide - 18, oy + oh + 2)
                                ctx.closePath()
                                ctx.fill()
                            }
                            ctx.globalAlpha = 1

                            // ── Taillights ──
                            const tlSide = goingRight ? ox + 2 : ox + obs.width - 2
                            ctx.fillStyle = NEON_PINK
                            ctx.shadowColor = NEON_PINK
                            ctx.shadowBlur = 8
                            ctx.beginPath()
                            ctx.arc(tlSide, oy + 5, 2, 0, Math.PI * 2)
                            ctx.fill()
                            ctx.beginPath()
                            ctx.arc(tlSide, oy + oh - 5, 2, 0, Math.PI * 2)
                            ctx.fill()

                            ctx.restore()
                        }
                    } else if (lane.type === "river") {
                        // Log
                        ctx.save()
                        ctx.shadowColor = obs.glowColor
                        ctx.shadowBlur = 8
                        ctx.fillStyle = obs.color
                        const lr = 5
                        ctx.beginPath()
                        ctx.moveTo(ox + lr, oy + 2)
                        ctx.lineTo(ox + obs.width - lr, oy + 2)
                        ctx.quadraticCurveTo(ox + obs.width, oy + 2, ox + obs.width, oy + 2 + lr)
                        ctx.lineTo(ox + obs.width, oy + oh - 2 - lr)
                        ctx.quadraticCurveTo(ox + obs.width, oy + oh - 2, ox + obs.width - lr, oy + oh - 2)
                        ctx.lineTo(ox + lr, oy + oh - 2)
                        ctx.quadraticCurveTo(ox, oy + oh - 2, ox, oy + oh - 2 - lr)
                        ctx.lineTo(ox, oy + 2 + lr)
                        ctx.quadraticCurveTo(ox, oy + 2, ox + lr, oy + 2)
                        ctx.closePath()
                        ctx.fill()

                        // Log grain lines
                        ctx.strokeStyle = "rgba(255,255,255,0.08)"
                        ctx.lineWidth = 1
                        for (let gx = ox + 10; gx < ox + obs.width - 10; gx += 12) {
                            ctx.beginPath()
                            ctx.moveTo(gx, oy + 6)
                            ctx.lineTo(gx, oy + oh - 6)
                            ctx.stroke()
                        }
                        ctx.restore()
                    }
                }
            }

            // ── Neon border ──
            const drawNeonTube = (x1: number, y1: number, x2: number, y2: number, color: string) => {
                ctx.save()
                ctx.shadowColor = color; ctx.shadowBlur = 30
                ctx.strokeStyle = color; ctx.globalAlpha = 0.3
                ctx.lineWidth = 10; ctx.lineCap = "round"
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
                ctx.restore()

                ctx.save()
                ctx.shadowColor = color; ctx.shadowBlur = 15
                ctx.strokeStyle = color; ctx.globalAlpha = 0.8
                ctx.lineWidth = 3; ctx.lineCap = "round"
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
                ctx.restore()

                ctx.save()
                ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 4
                ctx.strokeStyle = "#ffffff"; ctx.globalAlpha = 0.6
                ctx.lineWidth = 1; ctx.lineCap = "round"
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
                ctx.restore()
            }

            // Left/right border
            drawNeonTube(1, 0, 1, h / 2, EDGE_RED)
            drawNeonTube(1, h / 2, 1, h, EDGE_BLUE)
            drawNeonTube(w - 1, 0, w - 1, h / 2, EDGE_YELLOW)
            drawNeonTube(w - 1, h / 2, w - 1, h, EDGE_GREEN)

            // ── Timer bar ──
            if (gameStateRef.current === "playing" || gameStateRef.current === "dying") {
                const timerFrac = Math.max(0, timerRef.current / TIMER_START)
                const barW = (w - 20) * timerFrac
                const barH = 6
                const barX = 10
                const barY = 8

                // Color: green → yellow → red
                let barColor: string
                if (timerFrac > 0.5) {
                    barColor = NEON_GREEN
                } else if (timerFrac > 0.25) {
                    barColor = NEON_YELLOW
                } else {
                    barColor = NEON_PINK
                }

                // Background track
                ctx.save()
                ctx.globalAlpha = 0.2
                ctx.fillStyle = "#ffffff"
                ctx.beginPath()
                ctx.roundRect(barX, barY, w - 20, barH, 3)
                ctx.fill()
                ctx.restore()

                // Filled bar
                ctx.save()
                ctx.shadowColor = barColor
                ctx.shadowBlur = timerFrac < 0.25 ? 15 + Math.sin(Date.now() / 100) * 8 : 10
                ctx.fillStyle = barColor
                ctx.globalAlpha = timerFrac < 0.25 ? 0.7 + Math.sin(Date.now() / 100) * 0.3 : 0.9
                if (barW > 0) {
                    ctx.beginPath()
                    ctx.roundRect(barX, barY, barW, barH, 3)
                    ctx.fill()
                }
                ctx.restore()

                // Timer text
                const secs = Math.ceil(timerRef.current)
                ctx.save()
                ctx.font = "bold 11px 'JetBrains Mono', monospace"
                ctx.textAlign = "right"
                ctx.textBaseline = "top"
                ctx.fillStyle = barColor
                ctx.shadowColor = barColor
                ctx.shadowBlur = 6
                ctx.globalAlpha = timerFrac < 0.25 ? 0.7 + Math.sin(Date.now() / 100) * 0.3 : 0.8
                ctx.fillText(`${secs}s`, w - 12, barY + barH + 2)
                ctx.restore()
            }

            // ── Particles ──
            for (const p of particlesRef.current) {
                ctx.save()
                ctx.globalAlpha = p.life * 0.8
                ctx.shadowColor = p.color
                ctx.shadowBlur = 8
                ctx.fillStyle = p.color
                ctx.beginPath()
                ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()
            }

            // ── Player ──
            if (gameStateRef.current === "playing" || gameStateRef.current === "dying" || (gameStateRef.current === "gameover" && deathAnimRef.current > 0.3)) {
                let px: number, pr: number
                if (isMovingRef.current) {
                    const t = moveProgressRef.current
                    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
                    px = prevXRef.current + (targetXRef.current - prevXRef.current) * ease
                    pr = prevRowRef.current + (targetRowRef.current - prevRowRef.current) * ease
                } else {
                    px = playerXRef.current
                    pr = playerRowRef.current
                }

                const py = getScreenY(pr)
                const hopBounce = isMovingRef.current ? Math.sin(moveProgressRef.current * Math.PI) * 8 : 0
                let drawX = px
                let drawY = py - hopBounce
                let rotation = 0
                let scaleX = 1
                let scaleY = 1
                let playerAlpha = 1

                if (gameStateRef.current === "dying") {
                    const dtype = deathTypeRef.current
                    if (dtype === "vehicle") {
                        // Vehicle hit: knockback + spin + squash
                        drawX += hitPxRef.current
                        drawY += hitPyRef.current
                        rotation = hitSpinRef.current
                        const t2 = Math.min(hitAnimRef.current / 0.15, 1)
                        if (t2 < 1) {
                            scaleX = 1 + 0.4 * Math.sin(t2 * Math.PI)
                            scaleY = 1 - 0.3 * Math.sin(t2 * Math.PI)
                        }
                    } else if (dtype === "splash") {
                        // Splash: sink + shrink + wobble
                        drawY += hitPyRef.current
                        rotation = hitSpinRef.current
                        const sinkT = Math.min(hitAnimRef.current / 0.8, 1)
                        const shrink = 1 - sinkT * 0.6
                        scaleX = shrink + Math.sin(hitAnimRef.current * 10) * 0.05
                        scaleY = shrink
                    } else if (dtype === "drift") {
                        // Drift: slide off + tilt + gentle shrink
                        drawX += hitPxRef.current
                        drawY += hitPyRef.current
                        rotation = hitSpinRef.current
                        const driftT = Math.min(hitAnimRef.current / 0.7, 1)
                        scaleX = 1 - driftT * 0.4
                        scaleY = 1 - driftT * 0.4
                    }
                    // Fade out near end
                    playerAlpha = Math.max(0, dyingTimerRef.current / 0.3)
                    playerAlpha = Math.min(1, playerAlpha)
                } else if (gameStateRef.current === "gameover") {
                    playerAlpha = deathAnimRef.current
                }

                ctx.save()
                ctx.globalAlpha = playerAlpha
                ctx.translate(drawX, drawY)
                ctx.rotate(rotation)
                ctx.scale(scaleX, scaleY)
                ctx.translate(-drawX, -drawY)

                // Player shadow (hide during knockback flight or water death)
                if (gameStateRef.current !== "dying" || (deathTypeRef.current === "vehicle" && hitAnimRef.current < 0.1)) {
                    ctx.fillStyle = "rgba(0,0,0,0.3)"
                    ctx.beginPath()
                    ctx.ellipse(drawX, py + PLAYER_SIZE / 2 - 2, PLAYER_SIZE / 2 - 2, 4, 0, 0, Math.PI * 2)
                    ctx.fill()
                }

                // Player body glow
                const dyingColor = gameStateRef.current === "dying"
                    ? (deathTypeRef.current === "vehicle" ? NEON_PINK : "#0088cc")
                    : NEON_CYAN
                ctx.shadowColor = dyingColor
                ctx.shadowBlur = 20
                ctx.fillStyle = dyingColor
                const half = PLAYER_SIZE / 2
                const r = 6
                const bx = drawX - half, by = drawY - half, bw = PLAYER_SIZE, bh = PLAYER_SIZE

                ctx.beginPath()
                ctx.moveTo(bx + r, by)
                ctx.lineTo(bx + bw - r, by)
                ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r)
                ctx.lineTo(bx + bw, by + bh - r)
                ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh)
                ctx.lineTo(bx + r, by + bh)
                ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r)
                ctx.lineTo(bx, by + r)
                ctx.quadraticCurveTo(bx, by, bx + r, by)
                ctx.closePath()
                ctx.fill()

                // Inner gradient
                ctx.shadowBlur = 0
                const pg = ctx.createRadialGradient(drawX - 3, drawY - 3, 0, drawX, drawY, half)
                pg.addColorStop(0, "#ffffff")
                pg.addColorStop(0.35, gameStateRef.current === "dying"
                    ? (deathTypeRef.current === "vehicle" ? NEON_PINK : "#0088cc")
                    : NEON_CYAN)
                pg.addColorStop(1, gameStateRef.current === "dying"
                    ? (deathTypeRef.current === "vehicle" ? "#661133" : "#003355")
                    : "#006688")
                ctx.fillStyle = pg
                ctx.beginPath()
                ctx.moveTo(bx + r + 2, by + 2)
                ctx.lineTo(bx + bw - r - 2, by + 2)
                ctx.quadraticCurveTo(bx + bw - 2, by + 2, bx + bw - 2, by + r + 2)
                ctx.lineTo(bx + bw - 2, by + bh - r - 2)
                ctx.quadraticCurveTo(bx + bw - 2, by + bh - 2, bx + bw - r - 2, by + bh - 2)
                ctx.lineTo(bx + r + 2, by + bh - 2)
                ctx.quadraticCurveTo(bx + 2, by + bh - 2, bx + 2, by + bh - r - 2)
                ctx.lineTo(bx + 2, by + r + 2)
                ctx.quadraticCurveTo(bx + 2, by + 2, bx + r + 2, by + 2)
                ctx.closePath()
                ctx.fill()

                // Eyes
                ctx.fillStyle = "#ffffff"
                ctx.shadowColor = "#ffffff"
                ctx.shadowBlur = 4
                if (gameStateRef.current === "dying") {
                    // X eyes when dying
                    ctx.strokeStyle = "#000000"
                    ctx.lineWidth = 1.5
                    ctx.shadowBlur = 0
                    // Left X
                    ctx.beginPath()
                    ctx.moveTo(drawX - 7, drawY - 6); ctx.lineTo(drawX - 3, drawY - 2)
                    ctx.stroke()
                    ctx.beginPath()
                    ctx.moveTo(drawX - 3, drawY - 6); ctx.lineTo(drawX - 7, drawY - 2)
                    ctx.stroke()
                    // Right X
                    ctx.beginPath()
                    ctx.moveTo(drawX + 3, drawY - 6); ctx.lineTo(drawX + 7, drawY - 2)
                    ctx.stroke()
                    ctx.beginPath()
                    ctx.moveTo(drawX + 7, drawY - 6); ctx.lineTo(drawX + 3, drawY - 2)
                    ctx.stroke()
                } else {
                    ctx.beginPath()
                    ctx.arc(drawX - 5, drawY - 4, 3, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.beginPath()
                    ctx.arc(drawX + 5, drawY - 4, 3, 0, Math.PI * 2)
                    ctx.fill()

                    // Pupils
                    ctx.shadowBlur = 0
                    ctx.fillStyle = "#000000"
                    ctx.beginPath()
                    ctx.arc(drawX - 4.5, drawY - 3.5, 1.5, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.beginPath()
                    ctx.arc(drawX + 5.5, drawY - 3.5, 1.5, 0, Math.PI * 2)
                    ctx.fill()
                }

                ctx.restore()
            }

            // Score watermark
            ctx.save()
            ctx.font = "bold 72px 'JetBrains Mono', monospace"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.globalAlpha = 0.05
            ctx.fillStyle = NEON_CYAN
            ctx.fillText(String(scoreRef.current), w / 2, h / 2)
            ctx.restore()
        }

        animRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(animRef.current)
    }, [canvasSize, spawnParticles, ensureLanes, playScoreSound, playDeathSound, playDrownSound, playDriftSound, playTickSound, playTimeoutSound, highScore])

    const speedColor = getSpeedColor(speed)
    const speedLabel = getSpeedLabel(speed)

    return (
        <div className="fixed inset-0 bg-[#050810] flex flex-col items-center justify-center overflow-hidden select-none">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-cyan-500/5 blur-3xl rounded-full" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-pink-500/5 blur-3xl rounded-full" />
            </div>

            {/* Top bar */}
            <div className="relative z-10 w-full max-w-[480px] px-4 py-2 flex items-center justify-between">
                <a href="/" className="text-white/60 hover:text-white text-sm font-medium transition-colors">
                    ← Back
                </a>
                <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full border font-mono"
                        style={{ color: speedColor, borderColor: `${speedColor}44` }}>
                        {speedLabel}
                    </span>
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="text-white/60 hover:text-white transition-colors text-lg"
                    >
                        {soundEnabled ? "🔊" : "🔇"}
                    </button>
                </div>
            </div>

            {/* Score bar */}
            {gameState !== "menu" && (
                <div className="relative z-10 w-full max-w-[480px] px-4 py-1 flex items-center justify-center gap-8">
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-cyan-400/70 font-mono">SCORE</div>
                        <div className="text-2xl font-bold font-mono" style={{ color: NEON_CYAN }}>{score}</div>
                    </div>
                    <div className="text-white/20 text-xl font-mono">|</div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-yellow-400/70 font-mono">BEST</div>
                        <div className="text-2xl font-bold font-mono" style={{ color: NEON_YELLOW }}>{highScore}</div>
                    </div>
                </div>
            )}

            {/* Canvas */}
            <div className="relative flex-1 w-full max-w-[480px] flex items-center justify-center px-2">
                <canvas
                    ref={canvasRef}
                    className="rounded-xl border border-white/5 touch-none"
                    style={{ background: TABLE_BG }}
                />

                {/* Menu overlay */}
                {gameState === "menu" && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl"
                        style={{ background: "rgba(5, 8, 16, 0.88)" }}>
                        <div className="text-center px-6">
                            <h1 className="text-4xl font-bold mb-2"
                                style={{
                                    background: `linear-gradient(135deg, ${NEON_CYAN}, ${NEON_GREEN})`,
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}>
                                CROSSY ROAD
                            </h1>
                            <p className="text-white/40 text-sm mb-8 font-mono">Neon Edition</p>

                            <p className="text-white/50 text-xs mb-6 uppercase tracking-widest">Set Traffic Speed</p>

                            {/* Speed slider */}
                            <div className="w-64 mx-auto mb-6">
                                <div className="flex items-center justify-center mb-4">
                                    <span
                                        className="text-5xl font-bold font-mono transition-colors duration-200"
                                        style={{
                                            color: speedColor,
                                            textShadow: `0 0 20px ${speedColor}88, 0 0 40px ${speedColor}44`,
                                        }}
                                    >
                                        {speed}
                                    </span>
                                </div>

                                <div
                                    className="text-xs font-mono font-bold uppercase tracking-widest mb-5 transition-colors duration-200"
                                    style={{ color: speedColor }}
                                >
                                    {speedLabel}
                                </div>

                                <div className="relative h-10 flex items-center">
                                    <div className="absolute left-0 right-0 h-2 rounded-full overflow-hidden"
                                        style={{ background: "rgba(255,255,255,0.06)" }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-150"
                                            style={{
                                                width: `${((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%`,
                                                background: `linear-gradient(90deg, #00ff88, ${speedColor})`,
                                                boxShadow: `0 0 12px ${speedColor}66, 0 0 4px ${speedColor}aa`,
                                            }}
                                        />
                                    </div>

                                    <div className="absolute left-0 right-0 h-2 flex items-center pointer-events-none">
                                        {Array.from({ length: SPEED_MAX - SPEED_MIN + 1 }, (_, i) => {
                                            const v = i + SPEED_MIN
                                            const pct = (i / (SPEED_MAX - SPEED_MIN)) * 100
                                            const isMajor = v % 5 === 0
                                            return (
                                                <div key={v} className="absolute" style={{
                                                    left: `${pct}%`, width: "1px",
                                                    height: isMajor ? "10px" : "4px",
                                                    background: v <= speed ? `${speedColor}88` : "rgba(255,255,255,0.1)",
                                                    transform: "translateX(-50%)",
                                                }} />
                                            )
                                        })}
                                    </div>

                                    <div className="absolute transition-all duration-150" style={{
                                        left: `${((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%`,
                                        transform: "translateX(-50%)",
                                    }}>
                                        <div className="w-5 h-5 rounded-full border-2" style={{
                                            borderColor: speedColor,
                                            background: `radial-gradient(circle at 35% 35%, #ffffff, ${speedColor})`,
                                            boxShadow: `0 0 16px ${speedColor}88, 0 0 32px ${speedColor}44`,
                                        }} />
                                    </div>

                                    <input type="range" min={SPEED_MIN} max={SPEED_MAX} value={speed}
                                        onChange={(e) => setSpeed(Number(e.target.value))}
                                        className="absolute left-0 right-0 w-full h-10 opacity-0 cursor-pointer"
                                        style={{ zIndex: 10 }}
                                    />
                                </div>

                                <div className="flex justify-between mt-2">
                                    <span className="text-[9px] font-mono" style={{ color: "#00ff8866" }}>SLOW</span>
                                    <span className="text-[9px] font-mono" style={{ color: "#ff336666" }}>FAST</span>
                                </div>
                            </div>

                            <button
                                onClick={() => startGame()}
                                className="relative px-10 py-3.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95 w-56 mx-auto"
                                style={{
                                    border: `1px solid ${speedColor}66`,
                                    color: speedColor,
                                    background: `${speedColor}15`,
                                    boxShadow: `0 0 24px ${speedColor}20, inset 0 0 24px ${speedColor}08`,
                                }}
                            >
                                Play
                            </button>

                            <p className="text-white/25 text-[10px] mt-8 font-mono">
                                Swipe or tap to hop · Arrow keys
                            </p>
                        </div>
                    </div>
                )}

                {/* Game over overlay */}
                {gameState === "gameover" && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl"
                        style={{ background: "rgba(5, 8, 16, 0.88)" }}>
                        <div className="text-center px-6">
                            <div className="text-5xl mb-4">💀</div>
                            <h2 className="text-3xl font-bold mb-2" style={{ color: NEON_PINK }}>
                                GAME OVER
                            </h2>
                            <p className="text-white/50 text-sm mb-1 font-mono">
                                Score: {score}
                            </p>
                            {score >= highScore && score > 0 && (
                                <p className="text-sm mb-1 font-mono" style={{ color: NEON_YELLOW }}>
                                    ★ New Best! ★
                                </p>
                            )}
                            <p className="text-white/30 text-xs mb-8 font-mono">
                                Speed {speed} · {speedLabel}
                            </p>

                            <div className="flex flex-col gap-3 w-56 mx-auto">
                                <button
                                    onClick={() => startGame()}
                                    className="px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95"
                                    style={{
                                        border: `1px solid ${NEON_CYAN}44`,
                                        color: NEON_CYAN,
                                        background: `${NEON_CYAN}11`,
                                        boxShadow: `0 0 20px ${NEON_CYAN}15`,
                                    }}
                                >
                                    Play Again
                                </button>
                                <button
                                    onClick={() => setGameState("menu")}
                                    className="px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95"
                                    style={{
                                        border: `1px solid rgba(255,255,255,0.15)`,
                                        color: "rgba(255,255,255,0.6)",
                                        background: "rgba(255,255,255,0.03)",
                                    }}
                                >
                                    Change Speed
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom hint */}
            {gameState === "playing" && (
                <div className="relative z-10 pb-3 pt-1">
                    <p className="text-white/20 text-[10px] font-mono tracking-wider">
                        TAP TO HOP · SWIPE TO MOVE · ARROW KEYS
                    </p>
                </div>
            )}
        </div>
    )
}
