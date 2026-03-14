"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"

type GameState = "menu" | "playing" | "gameover"

interface GlowParticle {
    x: number; y: number; vx: number; vy: number
    radius: number; life: number; maxLife: number; color: string
}

interface Firework {
    x: number; y: number; vx: number; vy: number
    life: number; maxLife: number; color: string
    trail: { x: number; y: number; alpha: number }[]
    exploded: boolean; sparks: FireworkSpark[]
}

interface FireworkSpark {
    x: number; y: number; vx: number; vy: number
    life: number; maxLife: number; color: string; radius: number
}

interface NetPoint {
    x: number; y: number; baseX: number; baseY: number
    vx: number; vy: number
}

// ─── Colors ───
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

const BALL_COLORS = [NEON_CYAN, NEON_GREEN, NEON_YELLOW, NEON_PINK, NEON_PURPLE, NEON_ORANGE]
const FIREWORK_COLORS = ["#ff2d7b", "#00f0ff", "#39ff14", "#ffe600", "#aa44ff", "#ff8800", "#ff4466", "#44ddff"]

// ─── Physics ───
const GRAVITY = 650
const BALL_RADIUS = 22
const HOOP_RIM_RADIUS = 6
const HOOP_WIDTH = 80
const MAX_LIVES = 3

export function BasketballTapGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const lastTimeRef = useRef<number>(0)

    // Ball state
    const ballXRef = useRef(0)
    const ballYRef = useRef(0)
    const ballVxRef = useRef(0)
    const ballVyRef = useRef(0)
    const ballRotRef = useRef(0)
    const ballRotSpeedRef = useRef(0)
    const ballFlyingRef = useRef(false)
    const ballLandedRef = useRef(false)
    const ballPrevYRef = useRef(0) // track previous Y for crossing detection

    // Hoop state
    const hoopXRef = useRef(0)
    const hoopYRef = useRef(0)
    const hoopDirRef = useRef(1)
    const hoopSpeedRef = useRef(40)

    // Net points for animation
    const netPointsRef = useRef<NetPoint[]>([])

    // Swipe state
    const swipeRef = useRef({ startX: 0, startY: 0, startTime: 0, isActive: false })

    // Game state
    const [gameState, setGameState] = useState<GameState>("menu")
    const gameStateRef = useRef<GameState>("menu")
    const [score, setScore] = useState(0)
    const scoreRef = useRef(0)
    const [highScore, setHighScore] = useState(0)
    const [lives, setLives] = useState(MAX_LIVES)
    const livesRef = useRef(MAX_LIVES)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
    const [soundEnabled, setSoundEnabled] = useState(true)
    const streakRef = useRef(0)
    const [streak, setStreak] = useState(0)

    // Track if ball has passed through hoop to prevent double-score
    const scoredThisShotRef = useRef(false)
    // Track if upward velocity has been nerfed after leaving view
    const ballNerfedRef = useRef(false)

    // Particles & effects
    const particlesRef = useRef<GlowParticle[]>([])
    const fireworksRef = useRef<Firework[]>([])
    const spotlightTimeRef = useRef(0)

    // Shot trajectory preview
    const trajectoryRef = useRef<{ x: number; y: number }[]>([])

    useEffect(() => { gameStateRef.current = gameState }, [gameState])

    // ─── Audio ───
    const audioCtxRef = useRef<AudioContext | null>(null)
    const getAudioCtx = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        }
        return audioCtxRef.current
    }, [])

    const playSwooshSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            const len = ctx.sampleRate * 0.2
            const buf = ctx.createBuffer(1, len, ctx.sampleRate)
            const data = buf.getChannelData(0)
            for (let i = 0; i < len; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
            }
            const src = ctx.createBufferSource()
            src.buffer = buf
            const filter = ctx.createBiquadFilter()
            filter.type = "bandpass"
            filter.frequency.setValueAtTime(800, t)
            filter.frequency.exponentialRampToValueAtTime(2000, t + 0.15)
            filter.Q.value = 1.5
            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0.2, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
            src.connect(filter).connect(gain).connect(ctx.destination)
            src.start(t)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playSwishSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sine"
            osc.frequency.setValueAtTime(1200, t)
            osc.frequency.exponentialRampToValueAtTime(400, t + 0.15)
            gain.gain.setValueAtTime(0.15, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
            osc.connect(gain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.2)
            const len = ctx.sampleRate * 0.12
            const buf = ctx.createBuffer(1, len, ctx.sampleRate)
            const data = buf.getChannelData(0)
            for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.3 * (1 - i / len)
            const src = ctx.createBufferSource()
            src.buffer = buf
            const ng = ctx.createGain()
            ng.gain.setValueAtTime(0.1, t + 0.05)
            ng.gain.exponentialRampToValueAtTime(0.001, t + 0.17)
            src.connect(ng).connect(ctx.destination)
            src.start(t + 0.05)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playRimBounceSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "triangle"
            osc.frequency.setValueAtTime(900, t)
            osc.frequency.exponentialRampToValueAtTime(300, t + 0.1)
            gain.gain.setValueAtTime(0.2, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
            osc.connect(gain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.15)
            const osc2 = ctx.createOscillator()
            const gain2 = ctx.createGain()
            osc2.type = "sine"
            osc2.frequency.setValueAtTime(1800, t)
            osc2.frequency.exponentialRampToValueAtTime(600, t + 0.08)
            gain2.gain.setValueAtTime(0.08, t)
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
            osc2.connect(gain2).connect(ctx.destination)
            osc2.start(t)
            osc2.stop(t + 0.1)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playMilestoneSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            const notes = [523, 659, 784, 1047]
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = "sine"
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0, t + i * 0.08)
                gain.gain.linearRampToValueAtTime(0.12, t + i * 0.08 + 0.02)
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.2)
                osc.connect(gain).connect(ctx.destination)
                osc.start(t + i * 0.08)
                osc.stop(t + i * 0.08 + 0.2)
            })
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playFireworkSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sawtooth"
            osc.frequency.setValueAtTime(200, t)
            osc.frequency.exponentialRampToValueAtTime(800, t + 0.3)
            gain.gain.setValueAtTime(0.04, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
            const filter = ctx.createBiquadFilter()
            filter.type = "bandpass"
            filter.frequency.value = 600
            filter.Q.value = 2
            osc.connect(filter).connect(gain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.35)
            const noiseLen = ctx.sampleRate * 0.15
            const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
            const noiseData = noiseBuf.getChannelData(0)
            for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
            const noiseSrc = ctx.createBufferSource()
            noiseSrc.buffer = noiseBuf
            const noiseGain = ctx.createGain()
            noiseGain.gain.setValueAtTime(0, t + 0.25)
            noiseGain.gain.linearRampToValueAtTime(0.15, t + 0.28)
            noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
            noiseSrc.connect(noiseGain).connect(ctx.destination)
            noiseSrc.start(t + 0.25)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playGameOverSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sawtooth"
            osc.frequency.setValueAtTime(400, t)
            osc.frequency.exponentialRampToValueAtTime(60, t + 0.6)
            gain.gain.setValueAtTime(0.1, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
            const filter = ctx.createBiquadFilter()
            filter.type = "lowpass"
            filter.frequency.value = 800
            osc.connect(filter).connect(gain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.6)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playBounceSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sine"
            osc.frequency.setValueAtTime(200, t)
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.1)
            gain.gain.setValueAtTime(0.18, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
            osc.connect(gain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.12)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    // ─── Particles ───
    const spawnParticles = useCallback((x: number, y: number, color: string, count: number, spd: number = 3) => {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2
            const s = (Math.random() * 0.7 + 0.3) * spd
            particlesRef.current.push({
                x, y,
                vx: Math.cos(angle) * s, vy: Math.sin(angle) * s,
                radius: Math.random() * 3 + 1,
                life: 1, maxLife: 0.6 + Math.random() * 0.5, color,
            })
        }
    }, [])

    // ─── Fireworks ───
    const launchFirework = useCallback((w: number, h: number) => {
        const x = Math.random() * w * 0.8 + w * 0.1
        const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)]
        fireworksRef.current.push({
            x, y: h,
            vx: (Math.random() - 0.5) * 60,
            vy: -(300 + Math.random() * 200),
            life: 1, maxLife: 1.2 + Math.random() * 0.5,
            color, trail: [], exploded: false, sparks: [],
        })
        playFireworkSound()
    }, [playFireworkSound])

    // ─── Init net ───
    const initNet = useCallback((hoopX: number, hoopY: number) => {
        const points: NetPoint[] = []
        const rows = 5
        const cols = 5
        const netW = HOOP_WIDTH * 0.85
        const netH = 40
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const bx = hoopX - netW / 2 + (c / (cols - 1)) * netW
                const by = hoopY + 6 + (r / (rows - 1)) * netH
                const taper = 1 - (r / (rows - 1)) * 0.35
                const tx = hoopX + (bx - hoopX) * taper
                points.push({ x: tx, y: by, baseX: tx, baseY: by, vx: 0, vy: 0 })
            }
        }
        netPointsRef.current = points
    }, [])

    // ─── Reset ball ───
    const resetBall = useCallback((w: number, h: number) => {
        ballXRef.current = w / 2
        ballYRef.current = h * 0.78
        ballPrevYRef.current = h * 0.78
        ballVxRef.current = 0
        ballVyRef.current = 0
        ballRotRef.current = 0
        ballRotSpeedRef.current = 0
        ballFlyingRef.current = false
        ballLandedRef.current = false
        scoredThisShotRef.current = false
        ballNerfedRef.current = false
        trajectoryRef.current = []
    }, [])

    // ─── Start game ───
    const startGame = useCallback(() => {
        const w = canvasSize.width
        const h = canvasSize.height
        if (w === 0) return

        resetBall(w, h)

        hoopXRef.current = w / 2
        hoopYRef.current = h * 0.22
        hoopDirRef.current = 1
        hoopSpeedRef.current = 40

        initNet(hoopXRef.current, hoopYRef.current)

        particlesRef.current = []
        fireworksRef.current = []
        spotlightTimeRef.current = 0

        scoreRef.current = 0
        setScore(0)
        livesRef.current = MAX_LIVES
        setLives(MAX_LIVES)
        streakRef.current = 0
        setStreak(0)
        setGameState("playing")
    }, [canvasSize, resetBall, initNet])

    // ─── Swipe handling ───
    const handlePointerDown = useCallback((clientX: number, clientY: number) => {
        if (gameStateRef.current === "menu") {
            startGame()
            return
        }
        if (gameStateRef.current !== "playing" || ballFlyingRef.current) return

        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const mx = clientX - rect.left
        const my = clientY - rect.top

        const dx = mx - ballXRef.current
        const dy = my - ballYRef.current
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < BALL_RADIUS * 4) {
            swipeRef.current = { startX: mx, startY: my, startTime: performance.now(), isActive: true }
        }
    }, [startGame])

    const handlePointerMove = useCallback((clientX: number, clientY: number) => {
        if (!swipeRef.current.isActive || ballFlyingRef.current) return

        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const mx = clientX - rect.left
        const my = clientY - rect.top

        const dx = mx - swipeRef.current.startX
        const dy = my - swipeRef.current.startY

        const power = Math.min(Math.sqrt(dx * dx + dy * dy), 200)
        if (power > 10) {
            const angle = Math.atan2(-dy, -dx)
            const launchVx = Math.cos(angle) * power * 3.2
            const launchVy = Math.sin(angle) * power * 3.2

            const points: { x: number; y: number }[] = []
            let px = ballXRef.current, py = ballYRef.current
            let pvx = launchVx, pvy = launchVy
            for (let i = 0; i < 20; i++) {
                const step = 0.04
                pvx *= 0.998
                pvy += GRAVITY * step
                px += pvx * step
                py += pvy * step
                points.push({ x: px, y: py })
            }
            trajectoryRef.current = points
        } else {
            trajectoryRef.current = []
        }
    }, [])

    const handlePointerUp = useCallback((clientX: number, clientY: number) => {
        if (!swipeRef.current.isActive) return
        swipeRef.current.isActive = false
        trajectoryRef.current = []

        if (gameStateRef.current !== "playing" || ballFlyingRef.current) return

        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const mx = clientX - rect.left
        const my = clientY - rect.top

        const dx = mx - swipeRef.current.startX
        const dy = my - swipeRef.current.startY
        const power = Math.sqrt(dx * dx + dy * dy)

        if (power < 10) return

        const elapsed = performance.now() - swipeRef.current.startTime
        const speedFactor = Math.min(1.5, 300 / Math.max(elapsed, 50))

        const angle = Math.atan2(-dy, -dx)
        const force = Math.min(power * speedFactor, 380)

        ballVxRef.current = Math.cos(angle) * force * 2.8
        ballVyRef.current = Math.sin(angle) * force * 2.8
        ballRotSpeedRef.current = ballVxRef.current * 0.008
        ballFlyingRef.current = true
        scoredThisShotRef.current = false

        playSwooshSound()
        const color = BALL_COLORS[scoreRef.current % BALL_COLORS.length]
        spawnParticles(ballXRef.current, ballYRef.current, color, 8, 3)
    }, [playSwooshSound, spawnParticles])

    // ─── Canvas sizing ───
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current
            if (!canvas) return
            const parent = canvas.parentElement
            if (!parent) return
            const w = Math.min(parent.clientWidth, 480)
            const h = Math.min(window.innerHeight - 60, 800)
            const dpr = window.devicePixelRatio || 1
            canvas.width = Math.floor(w * dpr)
            canvas.height = Math.floor(h * dpr)
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
        const canvas = canvasRef.current
        if (!canvas) return
        const onMouseDown = (e: MouseEvent) => { e.preventDefault(); handlePointerDown(e.clientX, e.clientY) }
        const onMouseMove = (e: MouseEvent) => { e.preventDefault(); handlePointerMove(e.clientX, e.clientY) }
        const onMouseUp = (e: MouseEvent) => { e.preventDefault(); handlePointerUp(e.clientX, e.clientY) }
        const onTouchStart = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; handlePointerDown(t.clientX, t.clientY) }
        const onTouchMove = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; handlePointerMove(t.clientX, t.clientY) }
        const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); const t = e.changedTouches[0]; handlePointerUp(t.clientX, t.clientY) }

        canvas.addEventListener("mousedown", onMouseDown)
        canvas.addEventListener("mousemove", onMouseMove)
        window.addEventListener("mouseup", onMouseUp)
        canvas.addEventListener("touchstart", onTouchStart, { passive: false })
        canvas.addEventListener("touchmove", onTouchMove, { passive: false })
        canvas.addEventListener("touchend", onTouchEnd, { passive: false })
        return () => {
            canvas.removeEventListener("mousedown", onMouseDown)
            canvas.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
            canvas.removeEventListener("touchstart", onTouchStart)
            canvas.removeEventListener("touchmove", onTouchMove)
            canvas.removeEventListener("touchend", onTouchEnd)
        }
    }, [handlePointerDown, handlePointerMove, handlePointerUp])

    // ─── Load high score ───
    useEffect(() => {
        const saved = localStorage.getItem("basketballTap_highScore")
        if (saved) setHighScore(parseInt(saved, 10))
    }, [])

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

            // ── Update ──
            if (gameStateRef.current === "playing") {
                // Move hoop only after 15 pts
                if (scoreRef.current >= 15) {
                    const speed = hoopSpeedRef.current + (scoreRef.current - 15) * 3
                    hoopXRef.current += hoopDirRef.current * speed * dt
                    if (hoopXRef.current - HOOP_WIDTH / 2 < 30) {
                        hoopXRef.current = 30 + HOOP_WIDTH / 2
                        hoopDirRef.current = 1
                    }
                    if (hoopXRef.current + HOOP_WIDTH / 2 > w - 30) {
                        hoopXRef.current = w - 30 - HOOP_WIDTH / 2
                        hoopDirRef.current = -1
                    }
                }

                // Update net base positions to follow hoop
                const netCols = 5
                const netRows = 5
                const netW = HOOP_WIDTH * 0.85
                const netH = 40
                for (let r = 0; r < netRows; r++) {
                    for (let c = 0; c < netCols; c++) {
                        const idx = r * netCols + c
                        if (idx >= netPointsRef.current.length) continue
                        const bx = hoopXRef.current - netW / 2 + (c / (netCols - 1)) * netW
                        const by = hoopYRef.current + 6 + (r / (netRows - 1)) * netH
                        const taper = 1 - (r / (netRows - 1)) * 0.35
                        const tx = hoopXRef.current + (bx - hoopXRef.current) * taper
                        netPointsRef.current[idx].baseX = tx
                        netPointsRef.current[idx].baseY = by
                    }
                }

                if (ballFlyingRef.current && !ballLandedRef.current) {
                    // Ball physics
                    ballPrevYRef.current = ballYRef.current
                    ballVyRef.current += GRAVITY * dt
                    ballXRef.current += ballVxRef.current * dt
                    ballYRef.current += ballVyRef.current * dt
                    ballVxRef.current *= 0.999
                    ballRotRef.current += ballRotSpeedRef.current * dt

                    const isDescending = ballVyRef.current > 0

                    // Wall bounces
                    if (ballXRef.current - BALL_RADIUS < 0) {
                        ballXRef.current = BALL_RADIUS
                        ballVxRef.current = Math.abs(ballVxRef.current) * 0.6
                        spawnParticles(BALL_RADIUS, ballYRef.current, EDGE_RED, 6, 2)
                        playBounceSound()
                    } else if (ballXRef.current + BALL_RADIUS > w) {
                        ballXRef.current = w - BALL_RADIUS
                        ballVxRef.current = -Math.abs(ballVxRef.current) * 0.6
                        spawnParticles(w - BALL_RADIUS, ballYRef.current, EDGE_YELLOW, 6, 2)
                        playBounceSound()
                    }

                    // Nerf upward velocity by 60% immediately when ball leaves field of view
                    if (ballYRef.current < 0 && ballVyRef.current < 0 && !ballNerfedRef.current) {
                        ballVyRef.current *= 0.4
                        ballNerfedRef.current = true
                    }

                    const ballCX = ballXRef.current
                    const ballCY = ballYRef.current
                    const curHoopX = hoopXRef.current
                    const curHoopY = hoopYRef.current
                    const curRimLeftX = curHoopX - HOOP_WIDTH / 2
                    const curRimRightX = curHoopX + HOOP_WIDTH / 2

                    // Only collide with rim/backboard when DESCENDING
                    // When ascending, the ball passes "behind" the hoop (parallax depth)
                    if (isDescending) {
                        const rimCollisionRadius = HOOP_RIM_RADIUS + BALL_RADIUS

                        // Left rim
                        const dlx = ballCX - curRimLeftX
                        const dly = ballCY - curHoopY
                        const distL = Math.sqrt(dlx * dlx + dly * dly)
                        if (distL < rimCollisionRadius) {
                            const nx = dlx / distL
                            const ny = dly / distL
                            ballXRef.current = curRimLeftX + nx * rimCollisionRadius
                            ballYRef.current = curHoopY + ny * rimCollisionRadius
                            const dot = ballVxRef.current * nx + ballVyRef.current * ny
                            ballVxRef.current -= 1.5 * dot * nx
                            ballVyRef.current -= 1.5 * dot * ny
                            ballVxRef.current *= 0.7
                            ballVyRef.current *= 0.7
                            spawnParticles(curRimLeftX, curHoopY, NEON_ORANGE, 10, 3)
                            playRimBounceSound()
                        }

                        // Right rim
                        const drx = ballCX - curRimRightX
                        const dry = ballCY - curHoopY
                        const distR = Math.sqrt(drx * drx + dry * dry)
                        if (distR < rimCollisionRadius) {
                            const nx = drx / distR
                            const ny = dry / distR
                            ballXRef.current = curRimRightX + nx * rimCollisionRadius
                            ballYRef.current = curHoopY + ny * rimCollisionRadius
                            const dot = ballVxRef.current * nx + ballVyRef.current * ny
                            ballVxRef.current -= 1.5 * dot * nx
                            ballVyRef.current -= 1.5 * dot * ny
                            ballVxRef.current *= 0.7
                            ballVyRef.current *= 0.7
                            spawnParticles(curRimRightX, curHoopY, NEON_ORANGE, 10, 3)
                            playRimBounceSound()
                        }

                        // Backboard frame is visual-only (no collision)
                    }

                    // Check scoring: ball crosses hoop plane while DESCENDING, having come from ABOVE
                    if (!scoredThisShotRef.current &&
                        isDescending &&
                        ballPrevYRef.current <= curHoopY &&
                        ballCY > curHoopY && ballCY < curHoopY + 35 &&
                        ballCX > curRimLeftX + 8 && ballCX < curRimRightX - 8) {

                        scoredThisShotRef.current = true
                        const points = streakRef.current >= 3 ? 3 : streakRef.current >= 1 ? 2 : 1
                        scoreRef.current += points
                        setScore(scoreRef.current)
                        streakRef.current += 1
                        setStreak(streakRef.current)

                        playSwishSound()
                        spawnParticles(curHoopX, curHoopY + 15, NEON_GREEN, 25, 5)
                        spawnParticles(curHoopX, curHoopY + 15, NEON_CYAN, 15, 3)
                        spawnParticles(curHoopX, curHoopY + 15, "#ffffff", 10, 2)

                        // Jiggle the net
                        for (const np of netPointsRef.current) {
                            np.vy += 3 + Math.random() * 4
                            np.vx += (Math.random() - 0.5) * 3
                        }

                        // Milestones
                        if (scoreRef.current === 10 || scoreRef.current === 20 || scoreRef.current === 30) {
                            playMilestoneSound()
                            spawnParticles(curHoopX, curHoopY, NEON_YELLOW, 40, 7)
                        }
                        if (scoreRef.current >= 20 && scoreRef.current % 5 === 0) {
                            for (let i = 0; i < 3; i++) {
                                setTimeout(() => launchFirework(w, h), i * 200)
                            }
                        }

                        hoopSpeedRef.current = 40 + scoreRef.current * 2

                        // Between 5-14 pts, reposition hoop X after every goal
                        if (scoreRef.current >= 5 && scoreRef.current < 15) {
                            const minX = 30 + HOOP_WIDTH / 2
                            const maxX = w - 30 - HOOP_WIDTH / 2
                            hoopXRef.current = minX + Math.random() * (maxX - minX)
                        }

                        // Reposition hoop X every 5 pts (during continuous movement phase)
                        if (scoreRef.current >= 15 && scoreRef.current % 5 === 0) {
                            const minX = 30 + HOOP_WIDTH / 2
                            const maxX = w - 30 - HOOP_WIDTH / 2
                            hoopXRef.current = minX + Math.random() * (maxX - minX)
                        }
                    }

                    // Ball fell below screen
                    if (ballCY > h + BALL_RADIUS * 2) {
                        if (!scoredThisShotRef.current) {
                            streakRef.current = 0
                            setStreak(0)
                            livesRef.current -= 1
                            setLives(livesRef.current)
                            spawnParticles(ballXRef.current, h, NEON_PINK, 20, 4)

                            if (livesRef.current <= 0) {
                                playGameOverSound()
                                if (scoreRef.current > highScore) {
                                    setHighScore(scoreRef.current)
                                    localStorage.setItem("basketballTap_highScore", String(scoreRef.current))
                                }
                                setGameState("gameover")
                            }
                        }
                        resetBall(w, h)
                    }
                }

                spotlightTimeRef.current += dt

                // Auto-launch fireworks at high scores
                if (scoreRef.current >= 20 && Math.random() < dt * 0.6) {
                    launchFirework(w, h)
                }
            }

            // Update net physics
            for (const np of netPointsRef.current) {
                const springX = (np.baseX - np.x) * 5
                const springY = (np.baseY - np.y) * 5
                np.vx += springX * dt
                np.vy += springY * dt
                np.vx *= 0.92
                np.vy *= 0.92
                np.x += np.vx
                np.y += np.vy
            }

            // Update particles
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i]
                p.x += p.vx; p.y += p.vy
                p.vy += 0.05
                p.vx *= 0.96; p.vy *= 0.96
                p.life -= dt / p.maxLife
                if (p.life <= 0) particlesRef.current.splice(i, 1)
            }

            // Update fireworks
            for (let i = fireworksRef.current.length - 1; i >= 0; i--) {
                const fw = fireworksRef.current[i]
                if (!fw.exploded) {
                    fw.x += fw.vx * dt; fw.y += fw.vy * dt
                    fw.vy += 200 * dt
                    fw.trail.push({ x: fw.x, y: fw.y, alpha: 1 })
                    if (fw.trail.length > 20) fw.trail.shift()
                    if (fw.vy > -50) {
                        fw.exploded = true
                        const sparkCount = 30 + Math.floor(Math.random() * 20)
                        for (let s = 0; s < sparkCount; s++) {
                            const angle = Math.random() * Math.PI * 2
                            const spd = 60 + Math.random() * 180
                            const sparkColor = Math.random() < 0.3
                                ? "#ffffff"
                                : FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)]
                            fw.sparks.push({
                                x: fw.x, y: fw.y,
                                vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
                                life: 1, maxLife: 0.8 + Math.random() * 0.6,
                                color: sparkColor, radius: 1 + Math.random() * 2,
                            })
                        }
                    }
                } else {
                    for (let s = fw.sparks.length - 1; s >= 0; s--) {
                        const sp = fw.sparks[s]
                        sp.x += sp.vx * dt; sp.y += sp.vy * dt
                        sp.vy += 80 * dt
                        sp.vx *= 0.98; sp.vy *= 0.98
                        sp.life -= dt / sp.maxLife
                        if (sp.life <= 0) fw.sparks.splice(s, 1)
                    }
                    if (fw.sparks.length === 0) fireworksRef.current.splice(i, 1)
                }
                for (const tr of fw.trail) { tr.alpha -= dt * 3 }
            }

            // ══════════════════════════════════
            // ── DRAW ──
            // ══════════════════════════════════
            ctx.fillStyle = TABLE_BG
            ctx.fillRect(0, 0, w, h)

            // Background grid
            ctx.save()
            ctx.globalAlpha = 0.03
            ctx.strokeStyle = NEON_ORANGE
            ctx.lineWidth = 0.5
            const gridSize = 40
            for (let gx = 0; gx < w; gx += gridSize) {
                ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke()
            }
            for (let gy = 0; gy < h; gy += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke()
            }
            ctx.restore()

            // ── Basketball court markings ──
            ctx.save()
            const margin = 14
            const keyW = w * 0.42
            const keyH = h * 0.19
            const threePointR = w * 0.42
            const centerR = Math.min(w, h) * 0.13
            const ftCircleR = keyW / 2 * 0.65

            // — Filled paint zones (subtle neon tint) —
            ctx.fillStyle = NEON_ORANGE
            ctx.globalAlpha = 0.025
            // Top paint
            ctx.fillRect((w - keyW) / 2, margin, keyW, keyH)
            // Bottom paint
            ctx.fillRect((w - keyW) / 2, h - margin - keyH, keyW, keyH)

            // — Line work —
            ctx.strokeStyle = NEON_ORANGE
            ctx.lineWidth = 1.5
            ctx.globalAlpha = 0.09
            ctx.shadowColor = NEON_ORANGE
            ctx.shadowBlur = 6

            // Outer boundary
            ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2)

            // Half-court line
            ctx.beginPath(); ctx.moveTo(margin, h / 2); ctx.lineTo(w - margin, h / 2); ctx.stroke()

            // Center circle
            ctx.beginPath(); ctx.arc(w / 2, h / 2, centerR, 0, Math.PI * 2); ctx.stroke()

            // Center dot
            ctx.fillStyle = NEON_ORANGE
            ctx.globalAlpha = 0.12
            ctx.beginPath(); ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2); ctx.fill()
            ctx.globalAlpha = 0.09
            ctx.strokeStyle = NEON_ORANGE

            // ─ Top half ─
            // Three-point arc
            ctx.beginPath()
            ctx.arc(w / 2, margin, threePointR, 0.12 * Math.PI, 0.88 * Math.PI)
            ctx.stroke()
            // Three-point straight side lines
            ctx.beginPath(); ctx.moveTo(w / 2 - threePointR, margin); ctx.lineTo(w / 2 - threePointR, margin + 8); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(w / 2 + threePointR, margin); ctx.lineTo(w / 2 + threePointR, margin + 8); ctx.stroke()

            // Key / paint box
            ctx.strokeRect((w - keyW) / 2, margin, keyW, keyH)

            // Free throw circle (solid bottom half, dashed top)
            ctx.beginPath()
            ctx.arc(w / 2, margin + keyH, ftCircleR, 0, Math.PI)
            ctx.stroke()
            ctx.setLineDash([4, 4])
            ctx.beginPath()
            ctx.arc(w / 2, margin + keyH, ftCircleR, Math.PI, Math.PI * 2)
            ctx.stroke()
            ctx.setLineDash([])

            // Restricted area arc
            ctx.beginPath()
            ctx.arc(w / 2, margin + 6, keyW * 0.25, 0.15 * Math.PI, 0.85 * Math.PI)
            ctx.stroke()

            // Key hash marks (left & right of paint)
            for (let i = 1; i <= 3; i++) {
                const hy = margin + keyH * (i / 4)
                const hashLen = 6
                ctx.beginPath(); ctx.moveTo((w - keyW) / 2 - hashLen, hy); ctx.lineTo((w - keyW) / 2, hy); ctx.stroke()
                ctx.beginPath(); ctx.moveTo((w + keyW) / 2, hy); ctx.lineTo((w + keyW) / 2 + hashLen, hy); ctx.stroke()
            }

            // ─ Bottom half ─
            // Three-point arc
            ctx.beginPath()
            ctx.arc(w / 2, h - margin, threePointR, 1.12 * Math.PI, 1.88 * Math.PI)
            ctx.stroke()
            // Three-point straight side lines
            ctx.beginPath(); ctx.moveTo(w / 2 - threePointR, h - margin); ctx.lineTo(w / 2 - threePointR, h - margin - 8); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(w / 2 + threePointR, h - margin); ctx.lineTo(w / 2 + threePointR, h - margin - 8); ctx.stroke()

            // Key / paint box
            ctx.strokeRect((w - keyW) / 2, h - margin - keyH, keyW, keyH)

            // Free throw circle (solid top half, dashed bottom)
            ctx.beginPath()
            ctx.arc(w / 2, h - margin - keyH, ftCircleR, Math.PI, Math.PI * 2)
            ctx.stroke()
            ctx.setLineDash([4, 4])
            ctx.beginPath()
            ctx.arc(w / 2, h - margin - keyH, ftCircleR, 0, Math.PI)
            ctx.stroke()
            ctx.setLineDash([])

            // Restricted area arc
            ctx.beginPath()
            ctx.arc(w / 2, h - margin - 6, keyW * 0.25, 1.15 * Math.PI, 1.85 * Math.PI)
            ctx.stroke()

            // Key hash marks
            for (let i = 1; i <= 3; i++) {
                const hy = h - margin - keyH * (i / 4)
                const hashLen = 6
                ctx.beginPath(); ctx.moveTo((w - keyW) / 2 - hashLen, hy); ctx.lineTo((w - keyW) / 2, hy); ctx.stroke()
                ctx.beginPath(); ctx.moveTo((w + keyW) / 2, hy); ctx.lineTo((w + keyW) / 2 + hashLen, hy); ctx.stroke()
            }

            ctx.restore()

            const currentScore = scoreRef.current

            // ── Spotlights ──
            if (gameStateRef.current === "playing" && currentScore >= 10) {
                const t = spotlightTimeRef.current
                ctx.save()

                const spotX1 = w / 2 + Math.sin(t * 1.2) * w * 0.3
                const spotAngle1 = Math.sin(t * 1.2) * 0.4
                const grad1 = ctx.createRadialGradient(spotX1, -30, 0, spotX1, h * 0.5, h * 0.9)
                const spotColor1 = currentScore >= 15 ? NEON_PURPLE : NEON_ORANGE
                grad1.addColorStop(0, spotColor1 + "18")
                grad1.addColorStop(0.3, spotColor1 + "08")
                grad1.addColorStop(1, "transparent")
                ctx.globalAlpha = 0.6
                ctx.fillStyle = grad1
                ctx.save()
                ctx.translate(spotX1, -30)
                ctx.rotate(spotAngle1)
                ctx.translate(-spotX1, 30)
                ctx.fillRect(0, 0, w, h)
                ctx.restore()

                ctx.globalAlpha = 0.12
                ctx.strokeStyle = spotColor1
                ctx.shadowColor = spotColor1
                ctx.shadowBlur = 20
                ctx.lineWidth = 1.5
                const beamW = w * 0.25
                ctx.beginPath(); ctx.moveTo(spotX1, -10); ctx.lineTo(spotX1 - beamW + Math.sin(spotAngle1) * 40, h); ctx.stroke()
                ctx.beginPath(); ctx.moveTo(spotX1, -10); ctx.lineTo(spotX1 + beamW + Math.sin(spotAngle1) * 40, h); ctx.stroke()

                if (currentScore >= 15) {
                    const spotX2 = w / 2 + Math.sin(t * 0.8 + 2.5) * w * 0.35
                    const spotAngle2 = Math.sin(t * 0.8 + 2.5) * 0.35
                    const grad2 = ctx.createRadialGradient(spotX2, h + 30, 0, spotX2, h * 0.4, h * 0.85)
                    const spotColor2 = NEON_PINK
                    grad2.addColorStop(0, spotColor2 + "15")
                    grad2.addColorStop(0.3, spotColor2 + "06")
                    grad2.addColorStop(1, "transparent")
                    ctx.globalAlpha = 0.5
                    ctx.fillStyle = grad2
                    ctx.save()
                    ctx.translate(spotX2, h + 30)
                    ctx.rotate(spotAngle2)
                    ctx.translate(-spotX2, -(h + 30))
                    ctx.fillRect(0, 0, w, h)
                    ctx.restore()

                    ctx.globalAlpha = 0.1
                    ctx.strokeStyle = spotColor2
                    ctx.shadowColor = spotColor2
                    ctx.shadowBlur = 15
                    ctx.lineWidth = 1
                    ctx.beginPath(); ctx.moveTo(spotX2, h + 10); ctx.lineTo(spotX2 - beamW * 0.8 + Math.sin(spotAngle2) * 30, 0); ctx.stroke()
                    ctx.beginPath(); ctx.moveTo(spotX2, h + 10); ctx.lineTo(spotX2 + beamW * 0.8 + Math.sin(spotAngle2) * 30, 0); ctx.stroke()
                }

                ctx.restore()
            }

            // ── Fireworks ──
            for (const fw of fireworksRef.current) {
                ctx.save()
                for (const tr of fw.trail) {
                    if (tr.alpha <= 0) continue
                    ctx.globalAlpha = tr.alpha * 0.4
                    ctx.fillStyle = fw.color
                    ctx.shadowColor = fw.color
                    ctx.shadowBlur = 6
                    ctx.beginPath(); ctx.arc(tr.x, tr.y, 2, 0, Math.PI * 2); ctx.fill()
                }
                ctx.restore()
                if (!fw.exploded) {
                    ctx.save()
                    ctx.globalAlpha = 0.9
                    ctx.fillStyle = fw.color
                    ctx.shadowColor = fw.color
                    ctx.shadowBlur = 15
                    ctx.beginPath(); ctx.arc(fw.x, fw.y, 3, 0, Math.PI * 2); ctx.fill()
                    ctx.restore()
                }
                ctx.save()
                for (const sp of fw.sparks) {
                    ctx.globalAlpha = sp.life * 0.8
                    ctx.fillStyle = sp.color
                    ctx.shadowColor = sp.color
                    ctx.shadowBlur = 8
                    ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.radius * sp.life, 0, Math.PI * 2); ctx.fill()
                }
                ctx.restore()
            }

            // ── Particles ──
            for (const p of particlesRef.current) {
                ctx.save()
                ctx.globalAlpha = p.life * 0.8
                ctx.shadowColor = p.color
                ctx.shadowBlur = 8
                ctx.fillStyle = p.color
                ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2); ctx.fill()
                ctx.restore()
            }

            // ── Parallax hoop drawing helpers ──
            // Rim ellipse radiusY simulates viewing the hoop from below at an angle
            const RIM_ELLIPSE_RY = 12 // vertical radius of the rim ellipse

            const drawBackboard = (hx: number, hy: number) => {
                ctx.save()
                ctx.strokeStyle = NEON_CYAN
                ctx.shadowColor = NEON_CYAN
                ctx.shadowBlur = 12
                ctx.lineWidth = 3
                ctx.globalAlpha = 0.6
                const bbW = HOOP_WIDTH * 0.7
                const bbH = 50
                ctx.strokeRect(hx - bbW / 2, hy - bbH, bbW, bbH + 5)
                ctx.lineWidth = 1.5
                ctx.globalAlpha = 0.4
                const sqSize = 18
                ctx.strokeRect(hx - sqSize / 2, hy - sqSize - 8, sqSize, sqSize)
                ctx.restore()
            }

            const drawBackRim = (hx: number, hy: number) => {
                // Back (far) half of the rim ellipse — drawn behind ball
                ctx.save()
                ctx.strokeStyle = NEON_ORANGE
                ctx.shadowColor = NEON_ORANGE
                ctx.shadowBlur = 12
                ctx.lineWidth = 3.5
                ctx.globalAlpha = 0.5
                ctx.beginPath()
                ctx.ellipse(hx, hy, HOOP_WIDTH / 2, RIM_ELLIPSE_RY, 0, Math.PI, Math.PI * 2) // top half = far side
                ctx.stroke()
                // Far rim dots (smaller, dimmer = parallax depth)
                ctx.fillStyle = NEON_ORANGE
                ctx.globalAlpha = 0.4
                ctx.beginPath(); ctx.arc(hx - HOOP_WIDTH / 2, hy, HOOP_RIM_RADIUS * 0.7, 0, Math.PI * 2); ctx.fill()
                ctx.beginPath(); ctx.arc(hx + HOOP_WIDTH / 2, hy, HOOP_RIM_RADIUS * 0.7, 0, Math.PI * 2); ctx.fill()
                ctx.restore()
            }

            const drawNet = (/* uses netPointsRef */) => {
                ctx.save()
                ctx.strokeStyle = "#ffffff"
                ctx.globalAlpha = 0.25
                ctx.lineWidth = 1
                ctx.shadowColor = NEON_CYAN
                ctx.shadowBlur = 4
                const cols = 5
                const rows = 5
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const idx = r * cols + c
                        if (idx >= netPointsRef.current.length) continue
                        const np = netPointsRef.current[idx]
                        if (c < cols - 1) {
                            const next = netPointsRef.current[idx + 1]
                            if (next) {
                                ctx.beginPath(); ctx.moveTo(np.x, np.y); ctx.lineTo(next.x, next.y); ctx.stroke()
                            }
                        }
                        if (r < rows - 1) {
                            const below = netPointsRef.current[idx + cols]
                            if (below) {
                                ctx.beginPath(); ctx.moveTo(np.x, np.y); ctx.lineTo(below.x, below.y); ctx.stroke()
                            }
                        }
                    }
                }
                ctx.restore()
            }

            const drawFrontRim = (hx: number, hy: number) => {
                // Front (near) half of the rim ellipse — drawn in front of ball
                ctx.save()
                ctx.strokeStyle = NEON_ORANGE
                ctx.shadowColor = NEON_ORANGE
                ctx.shadowBlur = 15
                ctx.lineWidth = 4.5
                ctx.globalAlpha = 0.9
                ctx.beginPath()
                ctx.ellipse(hx, hy, HOOP_WIDTH / 2, RIM_ELLIPSE_RY, 0, 0, Math.PI) // bottom half = near side
                ctx.stroke()
                // Near rim dots (larger, brighter)
                ctx.fillStyle = NEON_ORANGE
                ctx.beginPath(); ctx.arc(hx - HOOP_WIDTH / 2, hy, HOOP_RIM_RADIUS, 0, Math.PI * 2); ctx.fill()
                ctx.beginPath(); ctx.arc(hx + HOOP_WIDTH / 2, hy, HOOP_RIM_RADIUS, 0, Math.PI * 2); ctx.fill()
                // Inner rim glow (ellipse fill)
                ctx.globalAlpha = 0.1
                ctx.fillStyle = NEON_ORANGE
                ctx.shadowBlur = 25
                ctx.beginPath()
                ctx.ellipse(hx, hy, HOOP_WIDTH / 2 - 4, RIM_ELLIPSE_RY - 2, 0, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()
            }

            const drawBall = () => {
                const bx = ballXRef.current
                const by = ballYRef.current
                const rot = ballRotRef.current

                // Parallax: scale ball slightly by Y position for depth
                const depthScale = 0.85 + (by / h) * 0.2 // smaller when high (far), larger when low (close)
                const drawRadius = BALL_RADIUS * depthScale

                // Ball trail when flying
                if (ballFlyingRef.current) {
                    const speed = Math.sqrt(ballVxRef.current ** 2 + ballVyRef.current ** 2)
                    if (speed > 150) {
                        ctx.save()
                        ctx.globalAlpha = Math.min(0.15, speed / 3000)
                        ctx.fillStyle = NEON_ORANGE
                        ctx.shadowColor = NEON_ORANGE
                        ctx.shadowBlur = 10
                        ctx.beginPath()
                        ctx.arc(bx - ballVxRef.current * 0.03, by - ballVyRef.current * 0.03, drawRadius * 0.8, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.restore()
                    }
                }

                ctx.save()
                ctx.translate(bx, by)
                ctx.rotate(rot)

                // Outer glow
                const glowColor = gameStateRef.current === "gameover" ? NEON_PINK : NEON_ORANGE
                ctx.shadowColor = glowColor
                ctx.shadowBlur = 20
                ctx.fillStyle = glowColor
                ctx.globalAlpha = 0.12
                ctx.beginPath(); ctx.arc(0, 0, drawRadius + 5, 0, Math.PI * 2); ctx.fill()

                // Ball body
                ctx.globalAlpha = 1
                ctx.shadowBlur = 15
                const ballGrad = ctx.createRadialGradient(-4, -4, 0, 0, 0, drawRadius)
                ballGrad.addColorStop(0, "#ff8833")
                ballGrad.addColorStop(0.5, "#e65c00")
                ballGrad.addColorStop(0.85, "#cc4400")
                ballGrad.addColorStop(1, "#993300")
                ctx.fillStyle = ballGrad
                ctx.beginPath(); ctx.arc(0, 0, drawRadius, 0, Math.PI * 2); ctx.fill()

                // Basketball lines
                ctx.strokeStyle = "#331100"
                ctx.lineWidth = 1.5
                ctx.shadowBlur = 0
                ctx.globalAlpha = 0.5
                ctx.beginPath(); ctx.moveTo(-drawRadius, 0); ctx.lineTo(drawRadius, 0); ctx.stroke()
                ctx.beginPath(); ctx.moveTo(0, -drawRadius); ctx.lineTo(0, drawRadius); ctx.stroke()
                ctx.beginPath()
                ctx.arc(-drawRadius * 0.35, 0, drawRadius * 0.85, -Math.PI * 0.5, Math.PI * 0.5)
                ctx.stroke()
                ctx.beginPath()
                ctx.arc(drawRadius * 0.35, 0, drawRadius * 0.85, Math.PI * 0.5, -Math.PI * 0.5)
                ctx.stroke()

                // Neon rim
                ctx.strokeStyle = glowColor
                ctx.shadowColor = glowColor
                ctx.shadowBlur = 8
                ctx.lineWidth = 1.2
                ctx.globalAlpha = 0.4
                ctx.beginPath(); ctx.arc(0, 0, drawRadius, 0, Math.PI * 2); ctx.stroke()

                ctx.restore()

                // Ground shadow
                if (!ballFlyingRef.current) {
                    ctx.save()
                    ctx.globalAlpha = 0.1
                    ctx.fillStyle = NEON_ORANGE
                    ctx.shadowColor = NEON_ORANGE
                    ctx.shadowBlur = 8
                    ctx.beginPath()
                    ctx.ellipse(bx, by + drawRadius + 5, drawRadius * 0.6, 4, 0, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.restore()
                }
            }

            // ── Draw hoop with parallax layering ──
            // Layer order: backboard → back rim → net → ball → front rim
            // This creates the illusion of depth: ball passes through the hoop
            if (gameStateRef.current === "playing" || gameStateRef.current === "gameover") {
                const hx = hoopXRef.current
                const hy = hoopYRef.current

                drawBackboard(hx, hy)
                drawBackRim(hx, hy)
                drawNet()
            }

            // ── Trajectory preview ──
            if (trajectoryRef.current.length > 0 && !ballFlyingRef.current) {
                ctx.save()
                for (let i = 0; i < trajectoryRef.current.length; i++) {
                    const pt = trajectoryRef.current[i]
                    const alpha = (1 - i / trajectoryRef.current.length) * 0.4
                    ctx.globalAlpha = alpha
                    ctx.fillStyle = NEON_CYAN
                    ctx.shadowColor = NEON_CYAN
                    ctx.shadowBlur = 6
                    ctx.beginPath(); ctx.arc(pt.x, pt.y, 3 - i * 0.1, 0, Math.PI * 2); ctx.fill()
                }
                ctx.restore()
            }

            // ── Ball + Front rim (draw order depends on ball direction) ──
            if (gameStateRef.current === "playing" || gameStateRef.current === "gameover") {
                const ballAscending = ballFlyingRef.current && ballVyRef.current < 0
                if (ballAscending) {
                    // Ball ascending: draw front rim first, then ball on top
                    drawFrontRim(hoopXRef.current, hoopYRef.current)
                    drawBall()
                } else {
                    // Ball descending/idle: draw ball first, then front rim on top
                    drawBall()
                    drawFrontRim(hoopXRef.current, hoopYRef.current)
                }
            }

            // ── Neon border tubes ──
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
            drawNeonTube(1, 0, 1, h / 2, EDGE_RED)
            drawNeonTube(1, h / 2, 1, h, EDGE_BLUE)
            drawNeonTube(w - 1, 0, w - 1, h / 2, EDGE_YELLOW)
            drawNeonTube(w - 1, h / 2, w - 1, h, EDGE_GREEN)

            // Foreground spotlight
            if (gameStateRef.current === "playing" && currentScore >= 15) {
                const t = spotlightTimeRef.current
                ctx.save()
                const fgX = w / 2 + Math.cos(t * 1.5 + 1.0) * w * 0.3
                const fgAngle = Math.cos(t * 1.5 + 1.0) * 0.3
                const fgGrad = ctx.createRadialGradient(fgX, -20, 0, fgX, h * 0.5, h * 0.7)
                fgGrad.addColorStop(0, NEON_YELLOW + "10")
                fgGrad.addColorStop(0.4, NEON_YELLOW + "05")
                fgGrad.addColorStop(1, "transparent")
                ctx.globalAlpha = 0.5
                ctx.fillStyle = fgGrad
                ctx.save()
                ctx.translate(fgX, -20)
                ctx.rotate(fgAngle)
                ctx.translate(-fgX, 20)
                ctx.fillRect(0, 0, w, h)
                ctx.restore()
                ctx.restore()
            }

            // ── Lives display (on canvas) ──
            if (gameStateRef.current === "playing") {
                ctx.save()
                const livesY = 20
                const livesStartX = w - 20
                for (let i = 0; i < MAX_LIVES; i++) {
                    const lx = livesStartX - i * 24
                    const active = i < livesRef.current
                    ctx.globalAlpha = active ? 0.9 : 0.15
                    ctx.fillStyle = active ? NEON_PINK : "#666"
                    ctx.shadowColor = active ? NEON_PINK : "transparent"
                    ctx.shadowBlur = active ? 10 : 0
                    ctx.font = "16px sans-serif"
                    ctx.textAlign = "center"
                    ctx.fillText("❤", lx, livesY)
                }
                ctx.restore()
            }

            // ── Streak indicator (on canvas) ──
            if (gameStateRef.current === "playing" && streakRef.current >= 2) {
                ctx.save()
                ctx.font = "bold 14px 'JetBrains Mono', monospace"
                ctx.textAlign = "center"
                ctx.textBaseline = "top"
                const streakColor = streakRef.current >= 5 ? NEON_YELLOW : streakRef.current >= 3 ? NEON_GREEN : NEON_CYAN
                ctx.fillStyle = streakColor
                ctx.shadowColor = streakColor
                ctx.shadowBlur = 10
                ctx.globalAlpha = 0.8
                ctx.fillText(`🔥 ${streakRef.current}x STREAK`, w / 2, 10)
                ctx.restore()
            }

            // Score watermark
            if (gameStateRef.current === "playing") {
                ctx.save()
                ctx.font = "bold 120px 'JetBrains Mono', monospace"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                ctx.globalAlpha = 0.04
                ctx.fillStyle = NEON_ORANGE
                ctx.fillText(String(currentScore), w / 2, h / 2)
                ctx.restore()
            }

            animRef.current = requestAnimationFrame(loop)
        }

        animRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(animRef.current)
    }, [canvasSize, spawnParticles, launchFirework, playGameOverSound, playSwishSound, playRimBounceSound, playBounceSound, highScore, resetBall])

    return (
        <div className="fixed inset-0 bg-[#050810] flex flex-col items-center justify-center overflow-hidden select-none">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-orange-500/5 blur-3xl rounded-full" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-pink-500/5 blur-3xl rounded-full" />
            </div>

            {/* Top bar */}
            <div className="relative z-10 w-full max-w-120 px-4 py-2 flex items-center justify-between">
                <a href="/" className="text-white/60 hover:text-white text-sm font-medium transition-colors">
                    ← Back
                </a>
                <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="text-white/60 hover:text-white transition-colors text-lg"
                >
                    {soundEnabled ? "🔊" : "🔇"}
                </button>
            </div>

            {/* Score bar */}
            {gameState !== "menu" && (
                <div className="relative z-10 w-full max-w-120 px-4 py-1 flex items-center justify-center gap-8">
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-orange-400/70 font-mono">SCORE</div>
                        <div className="text-2xl font-bold font-mono" style={{ color: NEON_ORANGE }}>{score}</div>
                    </div>
                    <div className="text-white/20 text-xl font-mono">|</div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-yellow-400/70 font-mono">BEST</div>
                        <div className="text-2xl font-bold font-mono" style={{ color: NEON_YELLOW }}>{highScore}</div>
                    </div>
                    {streak >= 2 && (
                        <>
                            <div className="text-white/20 text-xl font-mono">|</div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase tracking-wider text-green-400/70 font-mono">STREAK</div>
                                <div className="text-2xl font-bold font-mono" style={{ color: NEON_GREEN }}>{streak}x</div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Canvas */}
            <div className="relative flex-1 w-full max-w-120 flex items-center justify-center px-2">
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
                                    background: `linear-gradient(135deg, ${NEON_ORANGE}, ${NEON_YELLOW})`,
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}>
                                BASKETBALL
                            </h1>
                            <p className="text-white/40 text-sm mb-8 font-mono">Neon Edition</p>

                            <div className="text-white/30 text-xs mb-4 space-y-1">
                                <p>🏀 Swipe to shoot the ball!</p>
                                <p>🎯 Score through the moving hoop</p>
                                <p>❤ 3 lives — don&apos;t miss!</p>
                                <p>🔥 Build streaks for bonus points</p>
                            </div>

                            <button
                                onClick={startGame}
                                className="px-8 py-3 rounded-xl font-bold text-lg transition-all duration-200 hover:scale-105 active:scale-95"
                                style={{
                                    background: `linear-gradient(135deg, ${NEON_ORANGE}33, ${NEON_YELLOW}33)`,
                                    border: `1px solid ${NEON_ORANGE}66`,
                                    color: NEON_ORANGE,
                                    boxShadow: `0 0 20px ${NEON_ORANGE}22, inset 0 0 20px ${NEON_ORANGE}11`,
                                }}
                            >
                                TAP TO START
                            </button>

                            {highScore > 0 && (
                                <div className="mt-4 text-sm font-mono" style={{ color: NEON_YELLOW + "88" }}>
                                    Best: {highScore}
                                </div>
                            )}

                            <div className="mt-6 space-y-1 text-white/25 text-[10px] font-mono">
                                <p>10 pts → Spotlight show</p>
                                <p>15 pts → Double spotlights</p>
                                <p>20 pts → Fireworks!</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Game over overlay */}
                {gameState === "gameover" && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl"
                        style={{ background: "rgba(5, 8, 16, 0.85)" }}>
                        <div className="text-center px-6">
                            <h2 className="text-3xl font-bold mb-2" style={{ color: NEON_PINK }}>
                                GAME OVER
                            </h2>
                            <div className="text-5xl font-bold font-mono mb-1" style={{ color: NEON_ORANGE }}>
                                {score}
                            </div>
                            <div className="text-white/40 text-xs font-mono mb-4">POINTS</div>

                            {score >= highScore && score > 0 && (
                                <div className="text-sm font-bold mb-4 animate-pulse"
                                    style={{ color: NEON_YELLOW }}>
                                    ⭐ NEW BEST! ⭐
                                </div>
                            )}

                            <button
                                onClick={startGame}
                                className="px-8 py-3 rounded-xl font-bold text-lg transition-all duration-200 hover:scale-105 active:scale-95"
                                style={{
                                    background: `linear-gradient(135deg, ${NEON_ORANGE}33, ${NEON_YELLOW}33)`,
                                    border: `1px solid ${NEON_ORANGE}66`,
                                    color: NEON_ORANGE,
                                    boxShadow: `0 0 20px ${NEON_ORANGE}22, inset 0 0 20px ${NEON_ORANGE}11`,
                                }}
                            >
                                PLAY AGAIN
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
