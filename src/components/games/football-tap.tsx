"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"

type GameState = "menu" | "playing" | "gameover"

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

interface Firework {
    x: number
    y: number
    vx: number
    vy: number
    life: number
    maxLife: number
    color: string
    trail: { x: number; y: number; alpha: number }[]
    exploded: boolean
    sparks: FireworkSpark[]
}

interface FireworkSpark {
    x: number
    y: number
    vx: number
    vy: number
    life: number
    maxLife: number
    color: string
    radius: number
}

type PowerUpType = "slow" | "magnet" | "shield" | "double" | "shrink"

interface PowerUp {
    x: number
    y: number
    vx: number
    vy: number
    radius: number
    type: PowerUpType
    color: string
    label: string
    bobPhase: number
    bobSpeed: number
    life: number
    pulsePhase: number
}

const POWERUP_CONFIG: Record<PowerUpType, { color: string; label: string; duration: number }> = {
    slow:   { color: "#00f0ff", label: "🐢", duration: 5 },
    magnet: { color: "#aa44ff", label: "🧲", duration: 4 },
    shield: { color: "#39ff14", label: "🛡️", duration: 6 },
    double: { color: "#ffe600", label: "×2",  duration: 5 },
    shrink: { color: "#ff2d7b", label: "🔻", duration: 4 },
}

const POWERUP_TYPES: PowerUpType[] = ["slow", "magnet", "shield", "double", "shrink"]

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
const GRAVITY = 1280 // px/s²
const KICK_VY = -520 // upward velocity on tap
const BALL_RADIUS = 22
const HORIZONTAL_DRIFT = 160
const WALL_BOUNCE = 0.45
const AIR_DRAG = 0.996

export function FootballTapGame() {
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
    const ballScaleRef = useRef(1)

    // Game state
    const [gameState, setGameState] = useState<GameState>("menu")
    const gameStateRef = useRef<GameState>("menu")
    const [score, setScore] = useState(0)
    const scoreRef = useRef(0)
    const [highScore, setHighScore] = useState(0)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
    const [soundEnabled, setSoundEnabled] = useState(true)

    // Particles & effects
    const particlesRef = useRef<GlowParticle[]>([])
    const fireworksRef = useRef<Firework[]>([])
    const spotlightTimeRef = useRef(0)
    const kickFlashRef = useRef(0)

    // Power-ups
    const powerUpsRef = useRef<PowerUp[]>([])
    const powerUpTimerRef = useRef(0)
    const activePowerUpRef = useRef<{ type: PowerUpType; remaining: number } | null>(null)
    const [activePowerUp, setActivePowerUp] = useState<{ type: PowerUpType; remaining: number } | null>(null)

    useEffect(() => { gameStateRef.current = gameState }, [gameState])

    // ─── Audio ───
    const audioCtxRef = useRef<AudioContext | null>(null)
    const getAudioCtx = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        }
        return audioCtxRef.current
    }, [])

    const playKickSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sine"
            osc.frequency.setValueAtTime(280, t)
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.08)
            gain.gain.setValueAtTime(0.25, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
            osc.connect(gain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.12)

            const osc2 = ctx.createOscillator()
            const gain2 = ctx.createGain()
            osc2.type = "triangle"
            osc2.frequency.setValueAtTime(600, t)
            osc2.frequency.exponentialRampToValueAtTime(200, t + 0.04)
            gain2.gain.setValueAtTime(0.12, t)
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
            osc2.connect(gain2).connect(ctx.destination)
            osc2.start(t)
            osc2.stop(t + 0.06)
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
            for (let i = 0; i < noiseLen; i++) {
                noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
            }
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

    const playWallBounceSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            // Thud
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sine"
            osc.frequency.setValueAtTime(150, t)
            osc.frequency.exponentialRampToValueAtTime(60, t + 0.1)
            gain.gain.setValueAtTime(0.2, t)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
            osc.connect(gain).connect(ctx.destination)
            osc.start(t)
            osc.stop(t + 0.12)
            // Rattle
            const noiseLen = ctx.sampleRate * 0.06
            const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
            const noiseData = noiseBuf.getChannelData(0)
            for (let i = 0; i < noiseLen; i++) {
                noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
            }
            const noiseSrc = ctx.createBufferSource()
            noiseSrc.buffer = noiseBuf
            const noiseGain = ctx.createGain()
            noiseGain.gain.setValueAtTime(0.08, t)
            noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
            const filter = ctx.createBiquadFilter()
            filter.type = "highpass"
            filter.frequency.value = 400
            noiseSrc.connect(filter).connect(noiseGain).connect(ctx.destination)
            noiseSrc.start(t)
        } catch { /* */ }
    }, [soundEnabled, getAudioCtx])

    const playPowerUpCollect = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const t = ctx.currentTime
            const notes = [880, 1100, 1320]
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = "sine"
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0, t + i * 0.06)
                gain.gain.linearRampToValueAtTime(0.15, t + i * 0.06 + 0.02)
                gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15)
                osc.connect(gain).connect(ctx.destination)
                osc.start(t + i * 0.06)
                osc.stop(t + i * 0.06 + 0.15)
            })
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
                maxLife: 0.6 + Math.random() * 0.5,
                color,
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

    // ─── Start game ───
    const startGame = useCallback(() => {
        const w = canvasSize.width
        const h = canvasSize.height
        if (w === 0) return

        ballXRef.current = w / 2
        ballYRef.current = h * 0.5
        ballVxRef.current = 0
        ballVyRef.current = 0
        ballRotRef.current = 0
        ballRotSpeedRef.current = 0
        ballScaleRef.current = 1
        kickFlashRef.current = 0

        particlesRef.current = []
        fireworksRef.current = []
        powerUpsRef.current = []
        powerUpTimerRef.current = 0
        activePowerUpRef.current = null
        setActivePowerUp(null)
        spotlightTimeRef.current = 0

        scoreRef.current = 0
        setScore(0)
        setGameState("playing")
    }, [canvasSize])

    // ─── Kick handler ───
    const handleKick = useCallback((clientX: number, clientY: number) => {
        if (gameStateRef.current === "menu") {
            startGame()
            return
        }
        if (gameStateRef.current !== "playing") return

        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const mx = clientX - rect.left
        const my = clientY - rect.top

        const dx = mx - ballXRef.current
        const dy = my - ballYRef.current
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Check power-up taps first
        const pups = powerUpsRef.current
        for (let i = pups.length - 1; i >= 0; i--) {
            const pu = pups[i]
            const pdx = mx - pu.x
            const pdy = my - pu.y
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy)
            if (pdist < pu.radius * 2) {
                const cfg = POWERUP_CONFIG[pu.type]
                activePowerUpRef.current = { type: pu.type, remaining: cfg.duration }
                setActivePowerUp({ type: pu.type, remaining: cfg.duration })
                spawnParticles(pu.x, pu.y, cfg.color, 20, 5)
                spawnParticles(pu.x, pu.y, "#ffffff", 10, 3)
                playPowerUpCollect()
                pups.splice(i, 1)
                break
            }
        }

        const hitRadius = activePowerUpRef.current?.type === "shrink" ? BALL_RADIUS * 1.5 : BALL_RADIUS * 2.0
        if (dist < hitRadius) {
            // Y-axis thrust: tap bottom of ball → stronger kick, tap top → weaker
            // dy < 0 means tapped above center, dy > 0 means tapped below center
            // Map from ~0.75x to ~1.25x of base kick velocity
            const verticalFactor = 1 + (dy / (BALL_RADIUS * 2.0)) * 0.25
            ballVyRef.current = KICK_VY * verticalFactor
            // Recoil: strong directional + random burst + curve spin
            const recoilX = -dx / (BALL_RADIUS * 2.0) * HORIZONTAL_DRIFT * 3
            const randomBurst = (Math.random() - 0.5) * 160
            const scoreChaos = Math.min(scoreRef.current * 4, 120)
            const curveSpin = (Math.random() > 0.5 ? 1 : -1) * (40 + Math.random() * scoreChaos)
            ballVxRef.current = recoilX + randomBurst + curveSpin
            ballRotSpeedRef.current = ballVxRef.current * 0.12 + (Math.random() - 0.5) * 12
            ballScaleRef.current = 0.7
            kickFlashRef.current = 1

            const points = activePowerUpRef.current?.type === "double" ? 2 : 1
            scoreRef.current += points
            setScore(scoreRef.current)
            playKickSound()

            const color = BALL_COLORS[scoreRef.current % BALL_COLORS.length]
            spawnParticles(ballXRef.current, ballYRef.current, color, 12, 4)
            spawnParticles(ballXRef.current, ballYRef.current, "#ffffff", 6, 2)

            if (scoreRef.current === 10 || scoreRef.current === 15 || scoreRef.current === 20) {
                playMilestoneSound()
                spawnParticles(ballXRef.current, ballYRef.current, NEON_YELLOW, 30, 6)
            }
            if (scoreRef.current >= 20 && scoreRef.current % 5 === 0) {
                const w = canvasSize.width
                const h = canvasSize.height
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => launchFirework(w, h), i * 200)
                }
            }
        }
    }, [startGame, playKickSound, playMilestoneSound, playPowerUpCollect, spawnParticles, launchFirework, canvasSize])

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
        const onMouse = (e: MouseEvent) => { e.preventDefault(); handleKick(e.clientX, e.clientY) }
        const onTouch = (e: TouchEvent) => {
            e.preventDefault()
            const t = e.touches[0] || e.changedTouches[0]
            handleKick(t.clientX, t.clientY)
        }
        canvas.addEventListener("mousedown", onMouse)
        canvas.addEventListener("touchstart", onTouch, { passive: false })
        return () => { canvas.removeEventListener("mousedown", onMouse); canvas.removeEventListener("touchstart", onTouch) }
    }, [handleKick])

    // ─── Load high score ───
    useEffect(() => {
        const saved = localStorage.getItem("footballTap_highScore")
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
                // Active power-up timer
                const pup = activePowerUpRef.current
                if (pup) {
                    pup.remaining -= dt
                    setActivePowerUp({ ...pup })
                    if (pup.remaining <= 0) {
                        activePowerUpRef.current = null
                        setActivePowerUp(null)
                    }
                }

                const activeType = activePowerUpRef.current?.type
                const gravMult = activeType === "slow" ? 0.55 : 1

                ballVyRef.current += GRAVITY * gravMult * dt
                ballXRef.current += ballVxRef.current * dt
                ballYRef.current += ballVyRef.current * dt
                ballVxRef.current *= AIR_DRAG
                ballRotRef.current += ballRotSpeedRef.current * dt
                ballRotSpeedRef.current *= 0.995

                ballScaleRef.current += (1 - ballScaleRef.current) * 8 * dt
                kickFlashRef.current *= Math.pow(0.01, dt)

                // Magnet: pull ball toward center
                if (activeType === "magnet") {
                    const centerX = w / 2
                    const pullX = (centerX - ballXRef.current) * 0.8 * dt
                    ballVxRef.current += pullX
                }

                // Wall bounces — add vertical jolt + random horizontal burst
                if (ballXRef.current - BALL_RADIUS < 0) {
                    ballXRef.current = BALL_RADIUS
                    ballVxRef.current = Math.abs(ballVxRef.current) * WALL_BOUNCE + 60 + Math.random() * 80
                    ballVyRef.current += (Math.random() - 0.4) * 200
                    ballRotSpeedRef.current = (Math.random() - 0.5) * 15
                    spawnParticles(BALL_RADIUS, ballYRef.current, EDGE_RED, 14, 5)
                    playWallBounceSound()
                } else if (ballXRef.current + BALL_RADIUS > w) {
                    ballXRef.current = w - BALL_RADIUS
                    ballVxRef.current = -(Math.abs(ballVxRef.current) * WALL_BOUNCE + 60 + Math.random() * 80)
                    ballVyRef.current += (Math.random() - 0.4) * 200
                    ballRotSpeedRef.current = (Math.random() - 0.5) * 15
                    spawnParticles(w - BALL_RADIUS, ballYRef.current, EDGE_YELLOW, 14, 5)
                    playWallBounceSound()
                }

                // Floor = game over (shield saves once)
                if (ballYRef.current + BALL_RADIUS > h && activeType === "shield") {
                    ballYRef.current = h - BALL_RADIUS
                    ballVyRef.current = KICK_VY * 0.8
                    activePowerUpRef.current = null
                    setActivePowerUp(null)
                    spawnParticles(ballXRef.current, h - BALL_RADIUS, NEON_GREEN, 30, 5)
                } else if (ballYRef.current + BALL_RADIUS > h) {
                    ballYRef.current = h - BALL_RADIUS
                    ballVyRef.current = 0
                    ballVxRef.current = 0
                    spawnParticles(ballXRef.current, h - BALL_RADIUS, NEON_PINK, 40, 6)
                    spawnParticles(ballXRef.current, h - BALL_RADIUS, NEON_ORANGE, 25, 4)
                    playGameOverSound()
                    if (scoreRef.current > highScore) {
                        setHighScore(scoreRef.current)
                        localStorage.setItem("footballTap_highScore", String(scoreRef.current))
                    }
                    setGameState("gameover")
                }

                // Spawn power-ups
                powerUpTimerRef.current -= dt
                if (powerUpTimerRef.current <= 0 && powerUpsRef.current.length < 2) {
                    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]
                    const cfg = POWERUP_CONFIG[type]
                    powerUpsRef.current.push({
                        x: Math.random() * (w - 60) + 30,
                        y: Math.random() * (h * 0.5) + 40,
                        vx: (Math.random() - 0.5) * 50,
                        vy: (Math.random() - 0.5) * 30,
                        radius: 18,
                        type,
                        color: cfg.color,
                        label: cfg.label,
                        bobPhase: Math.random() * Math.PI * 2,
                        bobSpeed: 2 + Math.random() * 1.5,
                        life: 8 + Math.random() * 4,
                        pulsePhase: Math.random() * Math.PI * 2,
                    })
                    powerUpTimerRef.current = 6 + Math.random() * 6
                }

                // Update power-ups
                for (let i = powerUpsRef.current.length - 1; i >= 0; i--) {
                    const pu = powerUpsRef.current[i]
                    pu.bobPhase += pu.bobSpeed * dt
                    pu.pulsePhase += 4 * dt
                    pu.x += pu.vx * dt
                    pu.y += pu.vy * dt + Math.sin(pu.bobPhase) * 0.8
                    pu.life -= dt
                    // Bounce off walls
                    if (pu.x - pu.radius < 0) { pu.x = pu.radius; pu.vx = Math.abs(pu.vx) }
                    if (pu.x + pu.radius > w) { pu.x = w - pu.radius; pu.vx = -Math.abs(pu.vx) }
                    if (pu.y - pu.radius < 0) { pu.y = pu.radius; pu.vy = Math.abs(pu.vy) }
                    if (pu.y + pu.radius > h * 0.7) { pu.vy = -Math.abs(pu.vy) }
                    // Random direction changes
                    if (Math.random() < dt * 0.5) {
                        pu.vx += (Math.random() - 0.5) * 40
                        pu.vy += (Math.random() - 0.5) * 30
                    }
                    pu.vx = Math.max(-70, Math.min(70, pu.vx))
                    pu.vy = Math.max(-50, Math.min(50, pu.vy))
                    if (pu.life <= 0) powerUpsRef.current.splice(i, 1)
                }

                spotlightTimeRef.current += dt

                // Auto-launch fireworks when >= 20
                if (scoreRef.current >= 20 && Math.random() < dt * 0.8) {
                    launchFirework(w, h)
                }
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
                            const speed = 60 + Math.random() * 180
                            const sparkColor = Math.random() < 0.3
                                ? "#ffffff"
                                : FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)]
                            fw.sparks.push({
                                x: fw.x, y: fw.y,
                                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
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

            // ── Draw ──
            ctx.fillStyle = TABLE_BG
            ctx.fillRect(0, 0, w, h)

            // Background grid
            ctx.save()
            ctx.globalAlpha = 0.03
            ctx.strokeStyle = NEON_CYAN
            ctx.lineWidth = 0.5
            const gridSize = 40
            for (let x = 0; x < w; x += gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
            }
            for (let y = 0; y < h; y += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
            }
            ctx.restore()

            // ── Soccer pitch markings ──
            ctx.save()
            ctx.strokeStyle = NEON_GREEN
            ctx.lineWidth = 1.5
            ctx.globalAlpha = 0.08
            ctx.shadowColor = NEON_GREEN
            ctx.shadowBlur = 4

            // Center line
            ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()

            // Center circle
            const centerR = Math.min(w, h) * 0.15
            ctx.beginPath(); ctx.arc(w / 2, h / 2, centerR, 0, Math.PI * 2); ctx.stroke()

            // Center dot
            ctx.fillStyle = NEON_GREEN
            ctx.globalAlpha = 0.12
            ctx.beginPath(); ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2); ctx.fill()
            ctx.globalAlpha = 0.08

            // Pitch outline
            const margin = 12
            ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2)

            // Top penalty box
            const boxW = w * 0.55
            const boxH = h * 0.12
            ctx.strokeRect((w - boxW) / 2, margin, boxW, boxH)

            // Top goal box (smaller)
            const goalW = w * 0.3
            const goalH = h * 0.05
            ctx.strokeRect((w - goalW) / 2, margin, goalW, goalH)

            // Top penalty arc
            ctx.beginPath()
            ctx.arc(w / 2, margin + boxH, centerR * 0.5, 0.15 * Math.PI, 0.85 * Math.PI)
            ctx.stroke()

            // Bottom penalty box
            ctx.strokeRect((w - boxW) / 2, h - margin - boxH, boxW, boxH)

            // Bottom goal box
            ctx.strokeRect((w - goalW) / 2, h - margin - goalH, goalW, goalH)

            // Bottom penalty arc
            ctx.beginPath()
            ctx.arc(w / 2, h - margin - boxH, centerR * 0.5, 1.15 * Math.PI, 1.85 * Math.PI)
            ctx.stroke()

            // Corner arcs
            const cornerR = 12
            ctx.beginPath(); ctx.arc(margin, margin, cornerR, 0, Math.PI * 0.5); ctx.stroke()
            ctx.beginPath(); ctx.arc(w - margin, margin, cornerR, Math.PI * 0.5, Math.PI); ctx.stroke()
            ctx.beginPath(); ctx.arc(w - margin, h - margin, cornerR, Math.PI, Math.PI * 1.5); ctx.stroke()
            ctx.beginPath(); ctx.arc(margin, h - margin, cornerR, Math.PI * 1.5, Math.PI * 2); ctx.stroke()

            ctx.restore()

            // Ground line
            ctx.save()
            ctx.shadowColor = NEON_GREEN
            ctx.shadowBlur = 15
            ctx.strokeStyle = NEON_GREEN
            ctx.globalAlpha = 0.4
            ctx.lineWidth = 2
            ctx.beginPath(); ctx.moveTo(0, h - 2); ctx.lineTo(w, h - 2); ctx.stroke()
            ctx.restore()

            const currentScore = scoreRef.current

            // ── Spotlights (background layer) ──
            if (gameStateRef.current === "playing" && currentScore >= 10) {
                const t = spotlightTimeRef.current
                ctx.save()

                // Spotlight 1
                const spotAngle1 = Math.sin(t * 1.2) * 0.4
                const spotX1 = w / 2 + Math.sin(t * 1.2) * w * 0.3
                const grad1 = ctx.createRadialGradient(spotX1, -30, 0, spotX1, h * 0.5, h * 0.9)
                const spotColor1 = currentScore >= 15 ? NEON_PURPLE : NEON_CYAN
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

                // Beam edges
                ctx.globalAlpha = 0.12
                ctx.strokeStyle = spotColor1
                ctx.shadowColor = spotColor1
                ctx.shadowBlur = 20
                ctx.lineWidth = 1.5
                const beamW = w * 0.25
                ctx.beginPath(); ctx.moveTo(spotX1, -10); ctx.lineTo(spotX1 - beamW + Math.sin(spotAngle1) * 40, h); ctx.stroke()
                ctx.beginPath(); ctx.moveTo(spotX1, -10); ctx.lineTo(spotX1 + beamW + Math.sin(spotAngle1) * 40, h); ctx.stroke()

                // Spotlight 2 (score >= 15)
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

            // ── Power-ups ──
            for (const pu of powerUpsRef.current) {
                const pulse = 1 + Math.sin(pu.pulsePhase) * 0.15
                const fadeAlpha = pu.life < 2 ? pu.life / 2 : 1
                ctx.save()
                ctx.globalAlpha = fadeAlpha * 0.7
                // Outer bubble glow
                ctx.shadowColor = pu.color
                ctx.shadowBlur = 20
                ctx.strokeStyle = pu.color
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(pu.x, pu.y, pu.radius * pulse, 0, Math.PI * 2)
                ctx.stroke()
                // Inner bubble fill
                const bubGrad = ctx.createRadialGradient(pu.x - 4, pu.y - 4, 0, pu.x, pu.y, pu.radius * pulse)
                bubGrad.addColorStop(0, pu.color + "30")
                bubGrad.addColorStop(0.6, pu.color + "15")
                bubGrad.addColorStop(1, pu.color + "05")
                ctx.fillStyle = bubGrad
                ctx.fill()
                // Shine highlight
                ctx.beginPath()
                ctx.arc(pu.x - pu.radius * 0.3, pu.y - pu.radius * 0.3, pu.radius * 0.25, 0, Math.PI * 2)
                ctx.fillStyle = "rgba(255,255,255,0.35)"
                ctx.fill()
                // Label
                ctx.globalAlpha = fadeAlpha
                ctx.font = `bold ${Math.floor(pu.radius * 0.9)}px sans-serif`
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                ctx.fillStyle = "#ffffff"
                ctx.shadowBlur = 0
                ctx.fillText(pu.label, pu.x, pu.y + 1)
                ctx.restore()
            }

            // ── Ball ──
            if (gameStateRef.current === "playing" || gameStateRef.current === "gameover") {
                const bx = ballXRef.current
                const by = ballYRef.current
                const scale = ballScaleRef.current
                const rot = ballRotRef.current

                // Ball trail
                const speed = Math.sqrt(ballVxRef.current ** 2 + ballVyRef.current ** 2)
                if (speed > 200 && gameStateRef.current === "playing") {
                    ctx.save()
                    ctx.globalAlpha = Math.min(0.2, speed / 3000)
                    ctx.fillStyle = NEON_CYAN
                    ctx.shadowColor = NEON_CYAN
                    ctx.shadowBlur = 10
                    ctx.beginPath()
                    ctx.arc(bx - ballVxRef.current * 0.03, by - ballVyRef.current * 0.03, BALL_RADIUS * 0.8, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.restore()
                }

                ctx.save()
                ctx.translate(bx, by)
                ctx.rotate(rot)
                ctx.scale(scale + (1 - scale) * 0.3, 2 - scale - (1 - scale) * 0.3)

                // Outer glow
                const glowColor = gameStateRef.current === "gameover" ? NEON_PINK : NEON_CYAN
                ctx.shadowColor = glowColor
                ctx.shadowBlur = 25 + kickFlashRef.current * 15
                ctx.fillStyle = glowColor
                ctx.globalAlpha = 0.15 + kickFlashRef.current * 0.2
                ctx.beginPath(); ctx.arc(0, 0, BALL_RADIUS + 6, 0, Math.PI * 2); ctx.fill()

                // Ball body
                ctx.shadowBlur = 20
                ctx.globalAlpha = 1
                const ballGrad = ctx.createRadialGradient(-6, -6, 0, 0, 0, BALL_RADIUS)
                ballGrad.addColorStop(0, "#ffffff")
                ballGrad.addColorStop(0.4, "#e8e8e8")
                ballGrad.addColorStop(0.8, "#aaaaaa")
                ballGrad.addColorStop(1, "#666666")
                ctx.fillStyle = ballGrad
                ctx.beginPath(); ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2); ctx.fill()

                // Pentagon pattern
                ctx.strokeStyle = "#333333"
                ctx.lineWidth = 1.5
                ctx.shadowBlur = 0
                const pentR = BALL_RADIUS * 0.38
                ctx.beginPath()
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
                    const px = Math.cos(a) * pentR
                    const py = Math.sin(a) * pentR
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
                }
                ctx.closePath()
                ctx.fillStyle = "#333333"
                ctx.fill(); ctx.stroke()

                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
                    ctx.beginPath()
                    ctx.moveTo(Math.cos(a) * pentR, Math.sin(a) * pentR)
                    ctx.lineTo(Math.cos(a) * BALL_RADIUS * 0.75, Math.sin(a) * BALL_RADIUS * 0.75)
                    ctx.stroke()
                }

                // Neon rim
                ctx.strokeStyle = glowColor
                ctx.shadowColor = glowColor
                ctx.shadowBlur = 10
                ctx.lineWidth = 1.5
                ctx.globalAlpha = 0.5 + kickFlashRef.current * 0.3
                ctx.beginPath(); ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2); ctx.stroke()

                ctx.restore()

                // Ground shadow
                if (gameStateRef.current === "playing") {
                    const shadowY = h - 4
                    const distFromGround = (h - by) / h
                    const shadowScale = 0.3 + distFromGround * 0.7
                    ctx.save()
                    ctx.globalAlpha = 0.15 * (1 - distFromGround * 0.5)
                    ctx.fillStyle = NEON_CYAN
                    ctx.shadowColor = NEON_CYAN
                    ctx.shadowBlur = 8
                    ctx.beginPath()
                    ctx.ellipse(bx, shadowY, BALL_RADIUS * shadowScale, 4, 0, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.restore()
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
            drawNeonTube(1, 0, 1, h / 2, EDGE_RED)
            drawNeonTube(1, h / 2, 1, h, EDGE_BLUE)
            drawNeonTube(w - 1, 0, w - 1, h / 2, EDGE_YELLOW)
            drawNeonTube(w - 1, h / 2, w - 1, h, EDGE_GREEN)

            // Foreground spotlight (score >= 15, drawn on top)
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

            // Score watermark
            if (gameStateRef.current === "playing") {
                ctx.save()
                ctx.font = "bold 120px 'JetBrains Mono', monospace"
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                ctx.globalAlpha = 0.04
                ctx.fillStyle = NEON_CYAN
                ctx.fillText(String(currentScore), w / 2, h / 2)
                ctx.restore()
            }

            animRef.current = requestAnimationFrame(loop)
        }

        animRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(animRef.current)
    }, [canvasSize, spawnParticles, launchFirework, playGameOverSound, playWallBounceSound, highScore])

    return (
        <div className="fixed inset-0 bg-[#050810] flex flex-col items-center justify-center overflow-hidden select-none">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-cyan-500/5 blur-3xl rounded-full" />
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
                        <div className="text-[10px] uppercase tracking-wider text-cyan-400/70 font-mono">SCORE</div>
                        <div className="text-2xl font-bold font-mono" style={{ color: NEON_CYAN }}>{score}</div>
                    </div>
                    <div className="text-white/20 text-xl font-mono">|</div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-yellow-400/70 font-mono">BEST</div>
                        <div className="text-2xl font-bold font-mono" style={{ color: NEON_YELLOW }}>{highScore}</div>
                    </div>
                    {activePowerUp && (
                        <>
                            <div className="text-white/20 text-xl font-mono">|</div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase tracking-wider font-mono" style={{ color: POWERUP_CONFIG[activePowerUp.type].color + "bb" }}>
                                    {activePowerUp.type.toUpperCase()}
                                </div>
                                <div className="text-lg font-bold font-mono" style={{ color: POWERUP_CONFIG[activePowerUp.type].color }}>
                                    {POWERUP_CONFIG[activePowerUp.type].label} {activePowerUp.remaining.toFixed(1)}s
                                </div>
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
                                    background: `linear-gradient(135deg, ${NEON_CYAN}, ${NEON_GREEN})`,
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}>
                                FOOTBALL TAP
                            </h1>
                            <p className="text-white/40 text-sm mb-8 font-mono">Neon Edition</p>

                            <div className="text-white/30 text-xs mb-6">
                                ⚽ Keep the ball in the air!
                            </div>

                            <button
                                onClick={startGame}
                                className="px-8 py-3 rounded-xl font-bold text-lg transition-all duration-200 hover:scale-105 active:scale-95"
                                style={{
                                    background: `linear-gradient(135deg, ${NEON_CYAN}33, ${NEON_GREEN}33)`,
                                    border: `1px solid ${NEON_CYAN}66`,
                                    color: NEON_CYAN,
                                    boxShadow: `0 0 20px ${NEON_CYAN}22, inset 0 0 20px ${NEON_CYAN}11`,
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
                            <div className="text-5xl font-bold font-mono mb-1" style={{ color: NEON_CYAN }}>
                                {score}
                            </div>
                            <div className="text-white/40 text-xs font-mono mb-4">JUGGLES</div>

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
                                    background: `linear-gradient(135deg, ${NEON_CYAN}33, ${NEON_GREEN}33)`,
                                    border: `1px solid ${NEON_CYAN}66`,
                                    color: NEON_CYAN,
                                    boxShadow: `0 0 20px ${NEON_CYAN}22, inset 0 0 20px ${NEON_CYAN}11`,
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

