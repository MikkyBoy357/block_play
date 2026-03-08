"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"

type Difficulty = "easy" | "medium" | "hard"
type GameState = "menu" | "playing" | "paused" | "scored" | "gameover"

interface Vec2 {
    x: number
    y: number
}

interface Puck {
    x: number
    y: number
    vx: number
    vy: number
    radius: number
}

interface Paddle {
    x: number
    y: number
    radius: number
    vx: number
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

interface GoalFlash {
    alpha: number
    color: string
}

const WINNING_SCORE = 7
const PUCK_RADIUS = 14
const PADDLE_RADIUS = 28
const PUCK_FRICTION = 0.998
const PUCK_MAX_SPEED = 18
const WALL_BOUNCE = 0.85
const PADDLE_BOUNCE = 1.12
const GOAL_WIDTH_RATIO = 0.36
const SCORE_PAUSE_MS = 1200

const DIFFICULTY_CONFIG = {
    easy: { speed: 2.2, reaction: 0.025, error: 40, aggression: 0.15, label: "Easy", color: "#00ff88" },
    medium: { speed: 3.8, reaction: 0.055, error: 18, aggression: 0.35, label: "Medium", color: "#ffaa00" },
    hard: { speed: 5.5, reaction: 0.1, error: 6, aggression: 0.6, label: "Hard", color: "#ff3366" },
}

const NEON_CYAN = "#00f0ff"
const NEON_PINK = "#ff2d7b"
const NEON_GREEN = "#39ff14"
const TABLE_BG = "#0a0e1a"
const TABLE_LINE = "rgba(0, 240, 255, 0.12)"

export function AirHockeyGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const lastTimeRef = useRef<number>(0)

    const puckRef = useRef<Puck>({ x: 0, y: 0, vx: 0, vy: 0, radius: PUCK_RADIUS })
    const playerRef = useRef<Paddle>({ x: 0, y: 0, radius: PADDLE_RADIUS, vx: 0, vy: 0 })
    const cpuRef = useRef<Paddle>({ x: 0, y: 0, radius: PADDLE_RADIUS, vx: 0, vy: 0 })
    const particlesRef = useRef<GlowParticle[]>([])
    const goalFlashRef = useRef<GoalFlash>({ alpha: 0, color: NEON_CYAN })
    const cpuTargetRef = useRef<Vec2>({ x: 0, y: 0 })
    const cpuErrorRef = useRef<Vec2>({ x: 0, y: 0 })
    const cpuErrorTimerRef = useRef(0)

    const draggingRef = useRef(false)
    const pointerRef = useRef<Vec2>({ x: 0, y: 0 })
    const prevPlayerPos = useRef<Vec2>({ x: 0, y: 0 })

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
    const difficultyRef = useRef<Difficulty>("medium")
    const scorePauseRef = useRef(0)

    const audioCtxRef = useRef<AudioContext | null>(null)

    // Sync refs
    useEffect(() => { gameStateRef.current = gameState }, [gameState])
    useEffect(() => { difficultyRef.current = difficulty }, [difficulty])

    const getAudioCtx = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        }
        return audioCtxRef.current
    }, [])

    const playHitSound = useCallback((intensity: number = 0.5) => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sine"
            osc.frequency.setValueAtTime(800 + intensity * 600, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1)
            gain.gain.setValueAtTime(0.15 * intensity, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
            osc.connect(gain).connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + 0.1)
        } catch { /* silent */ }
    }, [soundEnabled, getAudioCtx])

    const playWallSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "triangle"
            osc.frequency.setValueAtTime(400, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08)
            gain.gain.setValueAtTime(0.08, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
            osc.connect(gain).connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + 0.08)
        } catch { /* silent */ }
    }, [soundEnabled, getAudioCtx])

    const playGoalSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const notes = [523, 659, 784, 1047]
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = "square"
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08)
                gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i * 0.08 + 0.02)
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2)
                osc.connect(gain).connect(ctx.destination)
                osc.start(ctx.currentTime + i * 0.08)
                osc.stop(ctx.currentTime + i * 0.08 + 0.2)
            })
        } catch { /* silent */ }
    }, [soundEnabled, getAudioCtx])

    const playWinSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const notes = [523, 659, 784, 1047, 1319]
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = "sine"
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12)
                gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.12 + 0.03)
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4)
                osc.connect(gain).connect(ctx.destination)
                osc.start(ctx.currentTime + i * 0.12)
                osc.stop(ctx.currentTime + i * 0.12 + 0.4)
            })
        } catch { /* silent */ }
    }, [soundEnabled, getAudioCtx])

    const playLoseSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const notes = [400, 350, 300, 250]
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = "sawtooth"
                osc.frequency.value = freq
                gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15)
                gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.15 + 0.03)
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3)
                osc.connect(gain).connect(ctx.destination)
                osc.start(ctx.currentTime + i * 0.15)
                osc.stop(ctx.currentTime + i * 0.15 + 0.3)
            })
        } catch { /* silent */ }
    }, [soundEnabled, getAudioCtx])

    // Spawn glow particles
    const spawnParticles = useCallback((x: number, y: number, color: string, count: number, speed: number = 3) => {
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
                maxLife: Math.random() * 0.5 + 0.3,
                color,
            })
        }
        if (particles.length > 500) particles.splice(0, particles.length - 500)
    }, [])

    // Reset puck to center
    const resetPuck = useCallback((w: number, h: number, towardPlayer: boolean) => {
        const puck = puckRef.current
        puck.x = w / 2
        puck.y = h / 2
        puck.vx = (Math.random() - 0.5) * 2
        puck.vy = towardPlayer ? 3 : -3
    }, [])

    // Reset positions
    const resetPositions = useCallback((w: number, h: number) => {
        const player = playerRef.current
        const cpu = cpuRef.current
        player.x = w / 2
        player.y = h * 0.82
        player.vx = 0
        player.vy = 0
        cpu.x = w / 2
        cpu.y = h * 0.18
        cpu.vx = 0
        cpu.vy = 0
        prevPlayerPos.current = { x: player.x, y: player.y }
        resetPuck(w, h, true)
    }, [resetPuck])

    // Start game
    const startGame = useCallback((diff: Difficulty) => {
        setDifficulty(diff)
        difficultyRef.current = diff
        setPlayerScore(0)
        setCpuScore(0)
        playerScoreRef.current = 0
        cpuScoreRef.current = 0
        setLastScorer(null)
        particlesRef.current = []
        scorePauseRef.current = 0
        const canvas = canvasRef.current
        if (canvas) resetPositions(canvas.width, canvas.height)
        setGameState("playing")
    }, [resetPositions])

    // Canvas sizing
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current
            if (!canvas) return
            const parent = canvas.parentElement
            if (!parent) return
            const w = Math.min(parent.clientWidth, 480)
            const h = Math.min(window.innerHeight - 60, 780)
            const dpr = window.devicePixelRatio || 1
            canvas.width = w * dpr
            canvas.height = h * dpr
            canvas.style.width = `${w}px`
            canvas.style.height = `${h}px`
            const ctx = canvas.getContext("2d")
            if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            setCanvasSize({ width: w, height: h })
            if (gameStateRef.current === "menu") {
                // Set initial positions
                const player = playerRef.current
                const cpu = cpuRef.current
                player.x = w / 2
                player.y = h * 0.82
                cpu.x = w / 2
                cpu.y = h * 0.18
                puckRef.current.x = w / 2
                puckRef.current.y = h / 2
            }
        }
        resize()
        window.addEventListener("resize", resize)
        return () => window.removeEventListener("resize", resize)
    }, [])

    // Pointer handlers
    const getCanvasPos = useCallback((e: React.PointerEvent | PointerEvent): Vec2 => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }, [])

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (gameStateRef.current !== "playing") return
        const pos = getCanvasPos(e.nativeEvent)
        const player = playerRef.current
        const dx = pos.x - player.x
        const dy = pos.y - player.y
        if (Math.sqrt(dx * dx + dy * dy) < player.radius * 2.5) {
            draggingRef.current = true
            pointerRef.current = pos
            canvasRef.current?.setPointerCapture(e.pointerId)
        }
    }, [getCanvasPos])

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!draggingRef.current || gameStateRef.current !== "playing") return
        pointerRef.current = getCanvasPos(e.nativeEvent)
    }, [getCanvasPos])

    const handlePointerUp = useCallback(() => {
        draggingRef.current = false
    }, [])

    // CPU AI
    const updateCPU = useCallback((w: number, h: number, dt: number) => {
        const cfg = DIFFICULTY_CONFIG[difficultyRef.current]
        const cpu = cpuRef.current
        const puck = puckRef.current
        const halfH = h / 2

        // Update error offset periodically
        cpuErrorTimerRef.current -= dt
        if (cpuErrorTimerRef.current <= 0) {
            cpuErrorTimerRef.current = 0.5 + Math.random() * 1.0
            cpuErrorRef.current = {
                x: (Math.random() - 0.5) * cfg.error * 2,
                y: (Math.random() - 0.5) * cfg.error,
            }
        }

        // Determine target
        let targetX = w / 2
        let targetY = h * 0.18

        if (puck.y < halfH) {
            // Puck in CPU half - go to puck
            targetX = puck.x + cpuErrorRef.current.x
            targetY = puck.y - PADDLE_RADIUS * 0.5 + cpuErrorRef.current.y

            // If puck moving toward CPU goal, be more aggressive
            if (puck.vy < -2) {
                targetX = puck.x + puck.vx * 3 + cpuErrorRef.current.x
                targetY = puck.y + puck.vy * 2 + cpuErrorRef.current.y
            }
        } else if (puck.vy < 0 && puck.y < halfH + 80) {
            // Puck approaching - intercept
            targetX = puck.x + puck.vx * 5 + cpuErrorRef.current.x
            targetY = halfH * 0.4
        } else {
            // Puck far away - return to defensive position
            targetX = w / 2 + cpuErrorRef.current.x * 0.5
            targetY = h * 0.15

            // Slight aggression toward center
            if (cfg.aggression > 0.3 && puck.y > halfH) {
                targetY = h * 0.22
                targetX = puck.x * cfg.aggression + w / 2 * (1 - cfg.aggression) + cpuErrorRef.current.x
            }
        }

        // Clamp target to CPU half
        targetY = Math.max(cpu.radius + 4, Math.min(halfH - cpu.radius, targetY))
        targetX = Math.max(cpu.radius + 4, Math.min(w - cpu.radius - 4, targetX))

        cpuTargetRef.current = { x: targetX, y: targetY }

        // Move toward target
        const dx = targetX - cpu.x
        const dy = targetY - cpu.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 1) {
            const moveSpeed = cfg.speed * cfg.reaction * 60 * dt
            const factor = Math.min(moveSpeed / dist, 1)
            const oldX = cpu.x
            const oldY = cpu.y
            cpu.x += dx * factor
            cpu.y += dy * factor
            cpu.vx = cpu.x - oldX
            cpu.vy = cpu.y - oldY
        } else {
            cpu.vx *= 0.8
            cpu.vy *= 0.8
        }
    }, [])

    // Main game loop
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

            const puck = puckRef.current
            const player = playerRef.current
            const cpu = cpuRef.current
            const halfH = h / 2
            const goalW = w * GOAL_WIDTH_RATIO
            const goalLeft = (w - goalW) / 2
            const goalRight = goalLeft + goalW

            // --- UPDATE ---
            if (gameStateRef.current === "playing") {
                // Score pause
                if (scorePauseRef.current > 0) {
                    scorePauseRef.current -= dt * 1000
                    if (scorePauseRef.current <= 0) {
                        scorePauseRef.current = 0
                        resetPositions(w, h)
                        // Check winner
                        if (playerScoreRef.current >= WINNING_SCORE) {
                            setGameState("gameover")
                            playWinSound()
                        } else if (cpuScoreRef.current >= WINNING_SCORE) {
                            setGameState("gameover")
                            playLoseSound()
                        }
                    }
                    // Update particles during pause
                    updateParticles(dt)
                    draw(ctx, w, h)
                    animRef.current = requestAnimationFrame(loop)
                    return
                }

                // Player paddle
                if (draggingRef.current) {
                    const target = pointerRef.current
                    const newX = Math.max(player.radius + 4, Math.min(w - player.radius - 4, target.x))
                    const newY = Math.max(halfH + player.radius + 4, Math.min(h - player.radius - 4, target.y))
                    player.vx = newX - player.x
                    player.vy = newY - player.y
                    player.x = newX
                    player.y = newY
                } else {
                    player.vx *= 0.85
                    player.vy *= 0.85
                }

                // CPU
                updateCPU(w, h, dt)

                // Puck physics
                puck.x += puck.vx
                puck.y += puck.vy
                puck.vx *= PUCK_FRICTION
                puck.vy *= PUCK_FRICTION

                // Clamp speed
                const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy)
                if (speed > PUCK_MAX_SPEED) {
                    puck.vx = (puck.vx / speed) * PUCK_MAX_SPEED
                    puck.vy = (puck.vy / speed) * PUCK_MAX_SPEED
                }

                // Trail particles from puck
                if (speed > 2) {
                    spawnParticles(puck.x, puck.y, NEON_GREEN, 1, speed * 0.3)
                }

                // Wall collisions
                if (puck.x - puck.radius < 0) {
                    puck.x = puck.radius
                    puck.vx = Math.abs(puck.vx) * WALL_BOUNCE
                    playWallSound()
                    spawnParticles(puck.x, puck.y, NEON_CYAN, 8, 2)
                }
                if (puck.x + puck.radius > w) {
                    puck.x = w - puck.radius
                    puck.vx = -Math.abs(puck.vx) * WALL_BOUNCE
                    playWallSound()
                    spawnParticles(puck.x, puck.y, NEON_CYAN, 8, 2)
                }

                // Top/bottom walls with goal openings
                // Top wall (CPU goal)
                if (puck.y - puck.radius < 0) {
                    if (puck.x > goalLeft && puck.x < goalRight) {
                        // PLAYER SCORES!
                        playerScoreRef.current++
                        setPlayerScore(playerScoreRef.current)
                        setLastScorer("player")
                        playGoalSound()
                        goalFlashRef.current = { alpha: 1, color: NEON_CYAN }
                        spawnParticles(puck.x, puck.y, NEON_CYAN, 40, 5)
                        spawnParticles(puck.x, puck.y, NEON_GREEN, 25, 4)
                        scorePauseRef.current = SCORE_PAUSE_MS
                        puck.vx = 0
                        puck.vy = 0
                    } else {
                        puck.y = puck.radius
                        puck.vy = Math.abs(puck.vy) * WALL_BOUNCE
                        playWallSound()
                        spawnParticles(puck.x, puck.y, NEON_CYAN, 8)
                    }
                }

                // Bottom wall (Player goal)
                if (puck.y + puck.radius > h) {
                    if (puck.x > goalLeft && puck.x < goalRight) {
                        // CPU SCORES!
                        cpuScoreRef.current++
                        setCpuScore(cpuScoreRef.current)
                        setLastScorer("cpu")
                        playGoalSound()
                        goalFlashRef.current = { alpha: 1, color: NEON_PINK }
                        spawnParticles(puck.x, puck.y, NEON_PINK, 40, 5)
                        spawnParticles(puck.x, puck.y, "#ff8800", 25, 4)
                        scorePauseRef.current = SCORE_PAUSE_MS
                        puck.vx = 0
                        puck.vy = 0
                    } else {
                        puck.y = h - puck.radius
                        puck.vy = -Math.abs(puck.vy) * WALL_BOUNCE
                        playWallSound()
                        spawnParticles(puck.x, puck.y, NEON_PINK, 8)
                    }
                }

                // Paddle-puck collisions
                collidePaddlePuck(player, puck, 1)
                collidePaddlePuck(cpu, puck, -1)

                prevPlayerPos.current = { x: player.x, y: player.y }
            }

            // Update particles
            updateParticles(dt)

            // Goal flash fade
            if (goalFlashRef.current.alpha > 0) {
                goalFlashRef.current.alpha *= 0.95
                if (goalFlashRef.current.alpha < 0.01) goalFlashRef.current.alpha = 0
            }

            draw(ctx, w, h)
            animRef.current = requestAnimationFrame(loop)
        }

        const collidePaddlePuck = (paddle: Paddle, puck: Puck, side: number) => {
            const dx = puck.x - paddle.x
            const dy = puck.y - paddle.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const minDist = puck.radius + paddle.radius

            if (dist < minDist && dist > 0) {
                // Separate
                const nx = dx / dist
                const ny = dy / dist
                const overlap = minDist - dist
                puck.x += nx * overlap
                puck.y += ny * overlap

                // Reflect + paddle velocity transfer
                const relVx = puck.vx - paddle.vx
                const relVy = puck.vy - paddle.vy
                const dot = relVx * nx + relVy * ny

                if (dot < 0) {
                    puck.vx -= 2 * dot * nx * PADDLE_BOUNCE + paddle.vx * 0.5
                    puck.vy -= 2 * dot * ny * PADDLE_BOUNCE + paddle.vy * 0.5
                }

                const hitIntensity = Math.min(Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy) / PUCK_MAX_SPEED, 1)
                playHitSound(hitIntensity)

                const hitColor = side > 0 ? NEON_CYAN : NEON_PINK
                spawnParticles(
                    (puck.x + paddle.x) / 2,
                    (puck.y + paddle.y) / 2,
                    hitColor,
                    12 + Math.floor(hitIntensity * 15),
                    2 + hitIntensity * 4,
                )
            }
        }

        const updateParticles = (dt: number) => {
            const particles = particlesRef.current
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]
                p.x += p.vx
                p.y += p.vy
                p.vx *= 0.96
                p.vy *= 0.96
                p.life -= dt / p.maxLife
                if (p.life <= 0) particles.splice(i, 1)
            }
        }

        const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
            const halfH = h / 2
            const goalW = w * GOAL_WIDTH_RATIO
            const goalLeft = (w - goalW) / 2
            const goalRight = goalLeft + goalW
            const puck = puckRef.current
            const player = playerRef.current
            const cpu = cpuRef.current

            // Clear
            ctx.fillStyle = TABLE_BG
            ctx.fillRect(0, 0, w, h)

            // Goal flash overlay
            if (goalFlashRef.current.alpha > 0) {
                ctx.save()
                ctx.globalAlpha = goalFlashRef.current.alpha * 0.15
                ctx.fillStyle = goalFlashRef.current.color
                ctx.fillRect(0, 0, w, h)
                ctx.restore()
            }

            // Table markings
            ctx.save()

            // Center line
            ctx.strokeStyle = TABLE_LINE
            ctx.lineWidth = 2
            ctx.setLineDash([8, 8])
            ctx.beginPath()
            ctx.moveTo(0, halfH)
            ctx.lineTo(w, halfH)
            ctx.stroke()
            ctx.setLineDash([])

            // Center circle
            ctx.beginPath()
            ctx.arc(w / 2, halfH, 60, 0, Math.PI * 2)
            ctx.strokeStyle = TABLE_LINE
            ctx.lineWidth = 2
            ctx.stroke()

            // Center dot
            ctx.beginPath()
            ctx.arc(w / 2, halfH, 5, 0, Math.PI * 2)
            ctx.fillStyle = "rgba(0, 240, 255, 0.2)"
            ctx.fill()

            // Goal zones
            // Top goal
            const goalGlowTop = ctx.createLinearGradient(goalLeft, 0, goalLeft, 30)
            goalGlowTop.addColorStop(0, "rgba(0, 240, 255, 0.25)")
            goalGlowTop.addColorStop(1, "rgba(0, 240, 255, 0)")
            ctx.fillStyle = goalGlowTop
            ctx.fillRect(goalLeft, 0, goalW, 30)

            // Bottom goal
            const goalGlowBot = ctx.createLinearGradient(goalLeft, h, goalLeft, h - 30)
            goalGlowBot.addColorStop(0, "rgba(255, 45, 123, 0.25)")
            goalGlowBot.addColorStop(1, "rgba(255, 45, 123, 0)")
            ctx.fillStyle = goalGlowBot
            ctx.fillRect(goalLeft, h - 30, goalW, 30)

            // Goal posts
            ctx.lineWidth = 3
            // Top
            ctx.strokeStyle = NEON_CYAN
            ctx.shadowColor = NEON_CYAN
            ctx.shadowBlur = 10
            ctx.beginPath()
            ctx.moveTo(goalLeft, 0)
            ctx.lineTo(goalLeft, 15)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(goalRight, 0)
            ctx.lineTo(goalRight, 15)
            ctx.stroke()

            // Bottom
            ctx.strokeStyle = NEON_PINK
            ctx.shadowColor = NEON_PINK
            ctx.beginPath()
            ctx.moveTo(goalLeft, h)
            ctx.lineTo(goalLeft, h - 15)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(goalRight, h)
            ctx.lineTo(goalRight, h - 15)
            ctx.stroke()

            ctx.shadowBlur = 0

            // Border
            ctx.strokeStyle = "rgba(0, 240, 255, 0.15)"
            ctx.lineWidth = 2
            // Top wall segments (with gap for goal)
            ctx.beginPath()
            ctx.moveTo(0, 0)
            ctx.lineTo(goalLeft, 0)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(goalRight, 0)
            ctx.lineTo(w, 0)
            ctx.stroke()
            // Bottom wall segments
            ctx.beginPath()
            ctx.moveTo(0, h)
            ctx.lineTo(goalLeft, h)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(goalRight, h)
            ctx.lineTo(w, h)
            ctx.stroke()
            // Side walls
            ctx.beginPath()
            ctx.moveTo(0, 0)
            ctx.lineTo(0, h)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(w, 0)
            ctx.lineTo(w, h)
            ctx.stroke()

            ctx.restore()

            // Particles
            const particles = particlesRef.current
            for (const p of particles) {
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

            // Draw puck
            if (scorePauseRef.current <= 0 || gameStateRef.current === "menu") {
                ctx.save()
                // Puck glow
                ctx.shadowColor = NEON_GREEN
                ctx.shadowBlur = 20
                ctx.fillStyle = NEON_GREEN
                ctx.beginPath()
                ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2)
                ctx.fill()

                // Inner puck
                ctx.shadowBlur = 0
                const puckGrad = ctx.createRadialGradient(puck.x - 3, puck.y - 3, 0, puck.x, puck.y, puck.radius)
                puckGrad.addColorStop(0, "#aaffaa")
                puckGrad.addColorStop(0.6, NEON_GREEN)
                puckGrad.addColorStop(1, "#00aa00")
                ctx.fillStyle = puckGrad
                ctx.beginPath()
                ctx.arc(puck.x, puck.y, puck.radius - 2, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()
            }

            // Draw paddles
            drawPaddle(ctx, player, NEON_CYAN)
            drawPaddle(ctx, cpu, NEON_PINK)

            // Score display (on table)
            ctx.save()
            ctx.font = "bold 56px 'JetBrains Mono', monospace"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"

            // CPU score (top half)
            ctx.globalAlpha = 0.12
            ctx.fillStyle = NEON_PINK
            ctx.fillText(String(cpuScoreRef.current), w / 2, halfH * 0.5)

            // Player score (bottom half)
            ctx.fillStyle = NEON_CYAN
            ctx.fillText(String(playerScoreRef.current), w / 2, halfH + halfH * 0.5)
            ctx.restore()

            // Score pause feedback text
            if (scorePauseRef.current > 0) {
                ctx.save()
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                ctx.font = "bold 28px 'Inter', sans-serif"
                const alpha = Math.min(scorePauseRef.current / 400, 1)
                if (lastScorer === "player") {
                    ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`
                    ctx.shadowColor = NEON_CYAN
                    ctx.shadowBlur = 20
                    ctx.fillText("GOAL! 🎯", w / 2, halfH)
                } else if (lastScorer === "cpu") {
                    ctx.fillStyle = `rgba(255, 45, 123, ${alpha})`
                    ctx.shadowColor = NEON_PINK
                    ctx.shadowBlur = 20
                    ctx.fillText("CPU SCORES!", w / 2, halfH)
                }
                ctx.restore()
            }
        }

        const drawPaddle = (ctx: CanvasRenderingContext2D, paddle: Paddle, color: string) => {
            ctx.save()
            // Outer glow
            ctx.shadowColor = color
            ctx.shadowBlur = 25
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(paddle.x, paddle.y, paddle.radius, 0, Math.PI * 2)
            ctx.fill()

            // Inner gradient
            ctx.shadowBlur = 0
            const grad = ctx.createRadialGradient(paddle.x - 4, paddle.y - 4, 0, paddle.x, paddle.y, paddle.radius)
            grad.addColorStop(0, "#ffffff")
            grad.addColorStop(0.3, color)
            grad.addColorStop(1, `${color}88`)
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(paddle.x, paddle.y, paddle.radius - 3, 0, Math.PI * 2)
            ctx.fill()

            // Center circle
            ctx.fillStyle = `${color}44`
            ctx.beginPath()
            ctx.arc(paddle.x, paddle.y, paddle.radius * 0.35, 0, Math.PI * 2)
            ctx.fill()

            ctx.restore()
        }

        animRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(animRef.current)
    }, [canvasSize, updateCPU, spawnParticles, playHitSound, playWallSound, playGoalSound, playWinSound, playLoseSound, resetPositions, lastScorer])

    const won = playerScoreRef.current >= WINNING_SCORE
    const cfg = DIFFICULTY_CONFIG[difficulty]

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
                        style={{ color: cfg.color, borderColor: `${cfg.color}44` }}>
                        {cfg.label}
                    </span>
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="text-white/60 hover:text-white transition-colors text-lg"
                    >
                        {soundEnabled ? "🔊" : "🔇"}
                    </button>
                </div>
            </div>

            {/* Scoreboard */}
            {gameState !== "menu" && (
                <div className="relative z-10 w-full max-w-[480px] px-4 py-1 flex items-center justify-center gap-8">
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-pink-400/70 font-mono">CPU</div>
                        <div className="text-2xl font-bold font-mono" style={{ color: NEON_PINK }}>{cpuScore}</div>
                    </div>
                    <div className="text-white/20 text-xl font-mono">:</div>
                    <div className="text-center">
                        <div className="text-[10px] uppercase tracking-wider text-cyan-400/70 font-mono">YOU</div>
                        <div className="text-2xl font-bold font-mono" style={{ color: NEON_CYAN }}>{playerScore}</div>
                    </div>
                </div>
            )}

            {/* Canvas */}
            <div className="relative flex-1 w-full max-w-[480px] flex items-center justify-center px-2">
                <canvas
                    ref={canvasRef}
                    className="rounded-xl border border-white/5 touch-none"
                    style={{ background: TABLE_BG }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
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
                                AIR HOCKEY
                            </h1>
                            <p className="text-white/40 text-sm mb-8 font-mono">Glow Edition</p>

                            <p className="text-white/50 text-xs mb-4 uppercase tracking-widest">Select Difficulty</p>
                            <div className="flex flex-col gap-3 w-56 mx-auto">
                                {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
                                    const c = DIFFICULTY_CONFIG[d]
                                    return (
                                        <button
                                            key={d}
                                            onClick={() => startGame(d)}
                                            className="relative px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95"
                                            style={{
                                                border: `1px solid ${c.color}44`,
                                                color: c.color,
                                                background: `${c.color}11`,
                                                boxShadow: `0 0 20px ${c.color}15`,
                                            }}
                                        >
                                            {c.label}
                                        </button>
                                    )
                                })}
                            </div>

                            <p className="text-white/25 text-[10px] mt-8 font-mono">
                                First to {WINNING_SCORE} wins
                            </p>
                        </div>
                    </div>
                )}

                {/* Game over overlay */}
                {gameState === "gameover" && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl"
                        style={{ background: "rgba(5, 8, 16, 0.88)" }}>
                        <div className="text-center px-6">
                            <div className="text-5xl mb-4">{won ? "🏆" : "💀"}</div>
                            <h2 className="text-3xl font-bold mb-2"
                                style={{ color: won ? NEON_CYAN : NEON_PINK }}>
                                {won ? "YOU WIN!" : "YOU LOSE"}
                            </h2>
                            <p className="text-white/50 text-sm mb-1 font-mono">
                                {playerScore} – {cpuScore}
                            </p>
                            <p className="text-white/30 text-xs mb-8 font-mono">
                                {cfg.label} difficulty
                            </p>

                            <div className="flex flex-col gap-3 w-56 mx-auto">
                                <button
                                    onClick={() => startGame(difficulty)}
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
                                    Change Difficulty
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom hint */}
            {gameState === "playing" && scorePauseRef.current <= 0 && (
                <div className="relative z-10 pb-3 pt-1">
                    <p className="text-white/20 text-[10px] font-mono tracking-wider">
                        DRAG YOUR PADDLE TO HIT THE PUCK
                    </p>
                </div>
            )}
        </div>
    )
}
