"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"

type GameState = "menu" | "playing" | "paused" | "gameover"
type Direction = "up" | "down" | "left" | "right"

interface Vec2 {
    x: number
    y: number
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

interface FoodPulse {
    phase: number
}

const CELL_SIZE = 20
const WINNING_SCORE = 50

const SPEED_MIN = 3
const SPEED_MAX = 25
const SPEED_DEFAULT = 13

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
    const r = Math.round(0xff)
    const g = Math.round(0xaa * (1 - u))
    const b = Math.round(0x00 + (0x66 - 0x00) * u)
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

const getSpeedLabel = (speed: number): string => {
    if (speed <= 7) return "Chill"
    if (speed <= 11) return "Easy"
    if (speed <= 15) return "Medium"
    if (speed <= 19) return "Fast"
    return "Insane"
}

const NEON_CYAN = "#00f0ff"
const NEON_PINK = "#ff2d7b"
const NEON_GREEN = "#39ff14"
const NEON_ORANGE = "#ff8800"
const NEON_PURPLE = "#aa44ff"
const NEON_YELLOW = "#ffe600"
const TABLE_BG = "#0a0e1a"

const EDGE_RED = "#ff1a1a"
const EDGE_YELLOW = "#ffe600"
const EDGE_BLUE = "#1a8cff"
const EDGE_GREEN = "#00ff66"

const SNAKE_COLORS = [
    "#00f0ff", "#00ccff", "#0099ff", "#0066ff", "#3344ff",
    "#6622ff", "#9900ff", "#cc00ff", "#ff00cc", "#ff0099",
]

export function GlowSnakeGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const lastTimeRef = useRef<number>(0)
    const moveTimerRef = useRef<number>(0)

    const snakeRef = useRef<Vec2[]>([])
    const directionRef = useRef<Direction>("right")
    const nextDirectionRef = useRef<Direction>("right")
    const foodRef = useRef<Vec2>({ x: 5, y: 5 })
    const foodPulseRef = useRef<FoodPulse>({ phase: 0 })
    const particlesRef = useRef<GlowParticle[]>([])
    const trailParticlesRef = useRef<GlowParticle[]>([])

    const [gameState, setGameState] = useState<GameState>("menu")
    const [speed, setSpeed] = useState(SPEED_DEFAULT)
    const [score, setScore] = useState(0)
    const [highScore, setHighScore] = useState(0)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
    const [gridSize, setGridSize] = useState({ cols: 20, rows: 20 })
    const [soundEnabled, setSoundEnabled] = useState(true)

    const scoreRef = useRef(0)
    const gameStateRef = useRef<GameState>("menu")
    const speedRef = useRef(SPEED_DEFAULT)

    // Sync refs
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

    const playEatSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            // Rising sparkle
            const notes = [660, 880, 1100, 1320]
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.type = "sine"
                osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.04)
                gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.04)
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.04 + 0.15)
                osc.connect(gain).connect(ctx.destination)
                osc.start(ctx.currentTime + i * 0.04)
                osc.stop(ctx.currentTime + i * 0.04 + 0.15)
            })
        } catch { /* silent */ }
    }, [soundEnabled, getAudioCtx])

    const playTurnSound = useCallback(() => {
        if (!soundEnabled) return
        try {
            const ctx = getAudioCtx()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sine"
            osc.frequency.setValueAtTime(500, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05)
            gain.gain.setValueAtTime(0.06, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
            osc.connect(gain).connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + 0.05)
        } catch { /* silent */ }
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

    // ─── Particles ───
    const spawnParticles = useCallback((x: number, y: number, color: string, count: number, speed: number = 3) => {
        const particles = particlesRef.current
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2
            const spd = (Math.random() * 0.7 + 0.3) * speed
            particles.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                radius: Math.random() * 3 + 1,
                life: 1,
                maxLife: Math.random() * 0.5 + 0.3,
                color,
            })
        }
        if (particles.length > 600) particles.splice(0, particles.length - 600)
    }, [])

    const spawnTrail = useCallback((x: number, y: number, color: string) => {
        const trails = trailParticlesRef.current
        trails.push({
            x: x + (Math.random() - 0.5) * 4,
            y: y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: Math.random() * 2.5 + 0.5,
            life: 1,
            maxLife: 0.4 + Math.random() * 0.3,
            color,
        })
        if (trails.length > 300) trails.splice(0, trails.length - 300)
    }, [])

    // ─── Food placement ───
    const placeFood = useCallback((cols: number, rows: number) => {
        const snake = snakeRef.current
        let fx: number, fy: number
        do {
            fx = Math.floor(Math.random() * cols)
            fy = Math.floor(Math.random() * rows)
        } while (snake.some(s => s.x === fx && s.y === fy))
        foodRef.current = { x: fx, y: fy }
    }, [])

    // ─── Game init ───
    const startGame = useCallback(() => {
        setScore(0)
        scoreRef.current = 0
        particlesRef.current = []
        trailParticlesRef.current = []
        moveTimerRef.current = 0

        const canvas = canvasRef.current
        if (!canvas) return
        const w = parseInt(canvas.style.width)
        const h = parseInt(canvas.style.height)
        const cols = Math.floor(w / CELL_SIZE)
        const rows = Math.floor(h / CELL_SIZE)

        // Start snake in center
        const cx = Math.floor(cols / 2)
        const cy = Math.floor(rows / 2)
        snakeRef.current = [
            { x: cx, y: cy },
            { x: cx - 1, y: cy },
            { x: cx - 2, y: cy },
        ]
        directionRef.current = "right"
        nextDirectionRef.current = "right"
        placeFood(cols, rows)

        setGameState("playing")
    }, [placeFood])

    // ─── Canvas sizing ───
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current
            if (!canvas) return
            const parent = canvas.parentElement
            if (!parent) return
            const maxW = Math.min(parent.clientWidth, 480)
            const maxH = Math.min(window.innerHeight - 120, 700)
            const cols = Math.floor(maxW / CELL_SIZE)
            const rows = Math.floor(maxH / CELL_SIZE)
            const w = cols * CELL_SIZE
            const h = rows * CELL_SIZE
            const dpr = window.devicePixelRatio || 1
            canvas.width = w * dpr
            canvas.height = h * dpr
            canvas.style.width = `${w}px`
            canvas.style.height = `${h}px`
            const ctx = canvas.getContext("2d")
            if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            setCanvasSize({ width: w, height: h })
            setGridSize({ cols, rows })
        }
        resize()
        window.addEventListener("resize", resize)
        return () => window.removeEventListener("resize", resize)
    }, [])

    // ─── Input handling ───
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (gameStateRef.current !== "playing") return
            const dir = directionRef.current
            switch (e.key) {
                case "ArrowUp": case "w": case "W":
                    if (dir !== "down") { nextDirectionRef.current = "up"; playTurnSound() }
                    e.preventDefault()
                    break
                case "ArrowDown": case "s": case "S":
                    if (dir !== "up") { nextDirectionRef.current = "down"; playTurnSound() }
                    e.preventDefault()
                    break
                case "ArrowLeft": case "a": case "A":
                    if (dir !== "right") { nextDirectionRef.current = "left"; playTurnSound() }
                    e.preventDefault()
                    break
                case "ArrowRight": case "d": case "D":
                    if (dir !== "left") { nextDirectionRef.current = "right"; playTurnSound() }
                    e.preventDefault()
                    break
            }
        }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [playTurnSound])

    // ─── Touch/swipe controls ───
    const touchStartRef = useRef<Vec2 | null>(null)

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            if (gameStateRef.current !== "playing") return
            const t = e.touches[0]
            touchStartRef.current = { x: t.clientX, y: t.clientY }
        }
        const handleTouchEnd = (e: TouchEvent) => {
            if (gameStateRef.current !== "playing" || !touchStartRef.current) return
            const t = e.changedTouches[0]
            const dx = t.clientX - touchStartRef.current.x
            const dy = t.clientY - touchStartRef.current.y
            const absDx = Math.abs(dx)
            const absDy = Math.abs(dy)
            if (Math.max(absDx, absDy) < 15) return // too small
            const dir = directionRef.current
            if (absDx > absDy) {
                if (dx > 0 && dir !== "left") { nextDirectionRef.current = "right"; playTurnSound() }
                else if (dx < 0 && dir !== "right") { nextDirectionRef.current = "left"; playTurnSound() }
            } else {
                if (dy > 0 && dir !== "up") { nextDirectionRef.current = "down"; playTurnSound() }
                else if (dy < 0 && dir !== "down") { nextDirectionRef.current = "up"; playTurnSound() }
            }
            touchStartRef.current = null
        }
        window.addEventListener("touchstart", handleTouchStart, { passive: true })
        window.addEventListener("touchend", handleTouchEnd, { passive: true })
        return () => {
            window.removeEventListener("touchstart", handleTouchStart)
            window.removeEventListener("touchend", handleTouchEnd)
        }
    }, [playTurnSound])

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
            const cols = gridSize.cols
            const rows = gridSize.rows
            if (w === 0 || h === 0) { animRef.current = requestAnimationFrame(loop); return }

            // ── Update ──
            if (gameStateRef.current === "playing") {
                moveTimerRef.current += dt

                const moveInterval = 1 / speedRef.current

                if (moveTimerRef.current >= moveInterval) {
                    moveTimerRef.current -= moveInterval

                    // Apply direction
                    directionRef.current = nextDirectionRef.current
                    const dir = directionRef.current
                    const snake = snakeRef.current
                    const head = snake[0]

                    // New head position
                    let nx = head.x
                    let ny = head.y
                    if (dir === "up") ny--
                    else if (dir === "down") ny++
                    else if (dir === "left") nx--
                    else if (dir === "right") nx++

                    // Wall collision
                    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) {
                        // Death — wall hit
                        setGameState("gameover")
                        playDeathSound()
                        // Death explosion
                        const hx = head.x * CELL_SIZE + CELL_SIZE / 2
                        const hy = head.y * CELL_SIZE + CELL_SIZE / 2
                        spawnParticles(hx, hy, NEON_PINK, 50, 6)
                        spawnParticles(hx, hy, NEON_ORANGE, 30, 5)
                        spawnParticles(hx, hy, "#ffffff", 15, 4)
                        // Spread death particles along body
                        for (let i = 0; i < snake.length; i += 2) {
                            const sx = snake[i].x * CELL_SIZE + CELL_SIZE / 2
                            const sy = snake[i].y * CELL_SIZE + CELL_SIZE / 2
                            const c = SNAKE_COLORS[i % SNAKE_COLORS.length]
                            spawnParticles(sx, sy, c, 5, 3)
                        }

                        // Update high score
                        if (scoreRef.current > highScore) {
                            setHighScore(scoreRef.current)
                        }

                        animRef.current = requestAnimationFrame(loop)
                        return
                    }

                    // Self collision
                    if (snake.some(s => s.x === nx && s.y === ny)) {
                        setGameState("gameover")
                        playDeathSound()
                        const hx = head.x * CELL_SIZE + CELL_SIZE / 2
                        const hy = head.y * CELL_SIZE + CELL_SIZE / 2
                        spawnParticles(hx, hy, NEON_PINK, 50, 6)
                        spawnParticles(hx, hy, "#ff4400", 30, 5)
                        for (let i = 0; i < snake.length; i += 2) {
                            const sx = snake[i].x * CELL_SIZE + CELL_SIZE / 2
                            const sy = snake[i].y * CELL_SIZE + CELL_SIZE / 2
                            const c = SNAKE_COLORS[i % SNAKE_COLORS.length]
                            spawnParticles(sx, sy, c, 5, 3)
                        }
                        if (scoreRef.current > highScore) {
                            setHighScore(scoreRef.current)
                        }
                        animRef.current = requestAnimationFrame(loop)
                        return
                    }

                    // Move snake
                    snake.unshift({ x: nx, y: ny })

                    // Check food
                    const food = foodRef.current
                    if (nx === food.x && ny === food.y) {
                        scoreRef.current++
                        setScore(scoreRef.current)
                        playEatSound()

                        // Food eat particles
                        const fx = food.x * CELL_SIZE + CELL_SIZE / 2
                        const fy = food.y * CELL_SIZE + CELL_SIZE / 2
                        spawnParticles(fx, fy, NEON_GREEN, 20, 4)
                        spawnParticles(fx, fy, NEON_YELLOW, 12, 3)
                        spawnParticles(fx, fy, "#ffffff", 8, 2)

                        // Check win
                        if (scoreRef.current >= WINNING_SCORE) {
                            setGameState("gameover")
                            playWinSound()
                            if (scoreRef.current > highScore) {
                                setHighScore(scoreRef.current)
                            }
                            animRef.current = requestAnimationFrame(loop)
                            return
                        }

                        placeFood(cols, rows)
                    } else {
                        snake.pop()
                    }

                    // Head trail particles
                    const hpx = nx * CELL_SIZE + CELL_SIZE / 2
                    const hpy = ny * CELL_SIZE + CELL_SIZE / 2
                    spawnTrail(hpx, hpy, NEON_CYAN)
                }
            }

            // Food pulse
            foodPulseRef.current.phase += dt * 4

            // Update particles
            updateParticles(particlesRef.current, dt)
            updateParticles(trailParticlesRef.current, dt)

            // ── Draw ──
            draw(ctx, w, h, cols, rows, dt)

            animRef.current = requestAnimationFrame(loop)
        }

        const updateParticles = (particles: GlowParticle[], dt: number) => {
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

        const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, cols: number, rows: number, _dt: number) => {
            const snake = snakeRef.current
            const food = foodRef.current
            const pulse = Math.sin(foodPulseRef.current.phase) * 0.3 + 0.7

            // Clear
            ctx.fillStyle = TABLE_BG
            ctx.fillRect(0, 0, w, h)

            // Subtle grid
            ctx.strokeStyle = "rgba(255,255,255,0.03)"
            ctx.lineWidth = 0.5
            for (let x = 0; x <= cols; x++) {
                ctx.beginPath()
                ctx.moveTo(x * CELL_SIZE, 0)
                ctx.lineTo(x * CELL_SIZE, h)
                ctx.stroke()
            }
            for (let y = 0; y <= rows; y++) {
                ctx.beginPath()
                ctx.moveTo(0, y * CELL_SIZE)
                ctx.lineTo(w, y * CELL_SIZE)
                ctx.stroke()
            }

            // ── Neon border edges ──
            const halfW = w / 2
            const halfH = h / 2

            const drawNeonTube = (x1: number, y1: number, x2: number, y2: number, color: string) => {
                ctx.save()
                ctx.shadowColor = color
                ctx.shadowBlur = 45
                ctx.strokeStyle = color
                ctx.globalAlpha = 0.15
                ctx.lineWidth = 22
                ctx.lineCap = "round"
                ctx.beginPath()
                ctx.moveTo(x1, y1)
                ctx.lineTo(x2, y2)
                ctx.stroke()
                ctx.restore()

                ctx.save()
                ctx.shadowColor = color
                ctx.shadowBlur = 30
                ctx.strokeStyle = color
                ctx.globalAlpha = 0.35
                ctx.lineWidth = 12
                ctx.lineCap = "round"
                ctx.beginPath()
                ctx.moveTo(x1, y1)
                ctx.lineTo(x2, y2)
                ctx.stroke()
                ctx.restore()

                ctx.save()
                ctx.shadowColor = color
                ctx.shadowBlur = 15
                ctx.strokeStyle = color
                ctx.globalAlpha = 0.85
                ctx.lineWidth = 5
                ctx.lineCap = "round"
                ctx.beginPath()
                ctx.moveTo(x1, y1)
                ctx.lineTo(x2, y2)
                ctx.stroke()
                ctx.restore()

                ctx.save()
                ctx.shadowColor = "#ffffff"
                ctx.shadowBlur = 4
                ctx.strokeStyle = "#ffffff"
                ctx.globalAlpha = 0.7
                ctx.lineWidth = 1.5
                ctx.lineCap = "round"
                ctx.beginPath()
                ctx.moveTo(x1, y1)
                ctx.lineTo(x2, y2)
                ctx.stroke()
                ctx.restore()
            }

            const drawCornerGlow = (cx: number, cy: number, color: string) => {
                ctx.save()
                ctx.shadowColor = color
                ctx.shadowBlur = 35
                const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16)
                cg.addColorStop(0, "#ffffff")
                cg.addColorStop(0.3, color)
                cg.addColorStop(1, "transparent")
                ctx.fillStyle = cg
                ctx.globalAlpha = 0.8
                ctx.beginPath()
                ctx.arc(cx, cy, 16, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()

                ctx.save()
                ctx.shadowColor = color
                ctx.shadowBlur = 15
                ctx.fillStyle = "#ffffff"
                ctx.globalAlpha = 0.9
                ctx.beginPath()
                ctx.arc(cx, cy, 3, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()
            }

            // Left wall
            drawNeonTube(2, 0, 2, halfH, EDGE_RED)
            drawNeonTube(2, halfH, 2, h, EDGE_BLUE)
            // Right wall
            drawNeonTube(w - 2, 0, w - 2, halfH, EDGE_YELLOW)
            drawNeonTube(w - 2, halfH, w - 2, h, EDGE_GREEN)
            // Top wall
            drawNeonTube(0, 2, halfW, 2, EDGE_RED)
            drawNeonTube(halfW, 2, w, 2, EDGE_YELLOW)
            // Bottom wall
            drawNeonTube(0, h - 2, halfW, h - 2, EDGE_BLUE)
            drawNeonTube(halfW, h - 2, w, h - 2, EDGE_GREEN)

            // Corners
            drawCornerGlow(2, 2, EDGE_RED)
            drawCornerGlow(w - 2, 2, EDGE_YELLOW)
            drawCornerGlow(2, h - 2, EDGE_BLUE)
            drawCornerGlow(w - 2, h - 2, EDGE_GREEN)
            // Mid-wall junctions
            drawCornerGlow(2, halfH, EDGE_RED)
            drawCornerGlow(w - 2, halfH, EDGE_YELLOW)
            drawCornerGlow(halfW, 2, EDGE_RED)
            drawCornerGlow(halfW, h - 2, EDGE_BLUE)

            // ── Trail particles (behind snake) ──
            for (const p of trailParticlesRef.current) {
                ctx.save()
                ctx.globalAlpha = p.life * 0.5
                ctx.shadowColor = p.color
                ctx.shadowBlur = 6
                ctx.fillStyle = p.color
                ctx.beginPath()
                ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()
            }

            // ── Snake ──
            if (snake.length > 0 && gameStateRef.current !== "gameover") {
                for (let i = snake.length - 1; i >= 0; i--) {
                    const seg = snake[i]
                    const px = seg.x * CELL_SIZE + CELL_SIZE / 2
                    const py = seg.y * CELL_SIZE + CELL_SIZE / 2
                    const colorIdx = i % SNAKE_COLORS.length
                    const segColor = SNAKE_COLORS[colorIdx]
                    const isHead = i === 0

                    // Glow
                    ctx.save()
                    ctx.shadowColor = segColor
                    ctx.shadowBlur = isHead ? 25 : 15
                    ctx.fillStyle = segColor
                    const segSize = isHead ? CELL_SIZE * 0.48 : CELL_SIZE * 0.42

                    // Rounded rect for each segment
                    const rx = px - segSize
                    const ry = py - segSize
                    const rw = segSize * 2
                    const rh = segSize * 2
                    const radius = isHead ? 6 : 4
                    ctx.beginPath()
                    ctx.moveTo(rx + radius, ry)
                    ctx.lineTo(rx + rw - radius, ry)
                    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius)
                    ctx.lineTo(rx + rw, ry + rh - radius)
                    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh)
                    ctx.lineTo(rx + radius, ry + rh)
                    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius)
                    ctx.lineTo(rx, ry + radius)
                    ctx.quadraticCurveTo(rx, ry, rx + radius, ry)
                    ctx.closePath()
                    ctx.fill()

                    // Inner gradient
                    ctx.shadowBlur = 0
                    const innerGrad = ctx.createRadialGradient(px - 2, py - 2, 0, px, py, segSize)
                    innerGrad.addColorStop(0, "#ffffff")
                    innerGrad.addColorStop(0.3, segColor)
                    innerGrad.addColorStop(1, `${segColor}88`)
                    ctx.fillStyle = innerGrad
                    const innerSize = segSize - 2
                    const irx = px - innerSize
                    const iry = py - innerSize
                    const irw = innerSize * 2
                    const irh = innerSize * 2
                    const ir = isHead ? 5 : 3
                    ctx.beginPath()
                    ctx.moveTo(irx + ir, iry)
                    ctx.lineTo(irx + irw - ir, iry)
                    ctx.quadraticCurveTo(irx + irw, iry, irx + irw, iry + ir)
                    ctx.lineTo(irx + irw, iry + irh - ir)
                    ctx.quadraticCurveTo(irx + irw, iry + irh, irx + irw - ir, iry + irh)
                    ctx.lineTo(irx + ir, iry + irh)
                    ctx.quadraticCurveTo(irx, iry + irh, irx, iry + irh - ir)
                    ctx.lineTo(irx, iry + ir)
                    ctx.quadraticCurveTo(irx, iry, irx + ir, iry)
                    ctx.closePath()
                    ctx.fill()

                    ctx.restore()

                    // Eyes on head
                    if (isHead) {
                        const dir = directionRef.current
                        let e1x = px - 4, e1y = py - 3, e2x = px + 4, e2y = py - 3
                        if (dir === "up") { e1x = px - 4; e1y = py - 3; e2x = px + 4; e2y = py - 3 }
                        else if (dir === "down") { e1x = px - 4; e1y = py + 3; e2x = px + 4; e2y = py + 3 }
                        else if (dir === "left") { e1x = px - 3; e1y = py - 4; e2x = px - 3; e2y = py + 4 }
                        else if (dir === "right") { e1x = px + 3; e1y = py - 4; e2x = px + 3; e2y = py + 4 }

                        ctx.save()
                        ctx.shadowColor = "#ffffff"
                        ctx.shadowBlur = 6
                        ctx.fillStyle = "#ffffff"
                        ctx.beginPath()
                        ctx.arc(e1x, e1y, 2.5, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.beginPath()
                        ctx.arc(e2x, e2y, 2.5, 0, Math.PI * 2)
                        ctx.fill()

                        // Pupils
                        ctx.fillStyle = "#000000"
                        ctx.shadowBlur = 0
                        let pdx = 0, pdy = 0
                        if (dir === "up") pdy = -1
                        else if (dir === "down") pdy = 1
                        else if (dir === "left") pdx = -1
                        else if (dir === "right") pdx = 1
                        ctx.beginPath()
                        ctx.arc(e1x + pdx, e1y + pdy, 1.2, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.beginPath()
                        ctx.arc(e2x + pdx, e2y + pdy, 1.2, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.restore()
                    }
                }
            }

            // ── Food ──
            const fx = food.x * CELL_SIZE + CELL_SIZE / 2
            const fy = food.y * CELL_SIZE + CELL_SIZE / 2
            const foodRadius = CELL_SIZE * 0.38 * (0.85 + pulse * 0.15)

            // Food pulsing outer glow
            ctx.save()
            ctx.shadowColor = NEON_GREEN
            ctx.shadowBlur = 25 + pulse * 10
            ctx.globalAlpha = 0.3 + pulse * 0.2
            ctx.fillStyle = NEON_GREEN
            ctx.beginPath()
            ctx.arc(fx, fy, foodRadius + 4, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()

            // Food body
            ctx.save()
            ctx.shadowColor = NEON_GREEN
            ctx.shadowBlur = 15
            const foodGrad = ctx.createRadialGradient(fx - 2, fy - 2, 0, fx, fy, foodRadius)
            foodGrad.addColorStop(0, "#ffffff")
            foodGrad.addColorStop(0.4, NEON_GREEN)
            foodGrad.addColorStop(1, "#00aa00")
            ctx.fillStyle = foodGrad
            ctx.beginPath()
            ctx.arc(fx, fy, foodRadius, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()

            // Food sparkle ring
            const sparkleCount = 6
            for (let i = 0; i < sparkleCount; i++) {
                const angle = (i / sparkleCount) * Math.PI * 2 + foodPulseRef.current.phase
                const sr = foodRadius + 8 + Math.sin(foodPulseRef.current.phase * 2 + i) * 3
                const sx = fx + Math.cos(angle) * sr
                const sy = fy + Math.sin(angle) * sr
                ctx.save()
                ctx.globalAlpha = 0.4 + pulse * 0.3
                ctx.shadowColor = NEON_YELLOW
                ctx.shadowBlur = 6
                ctx.fillStyle = NEON_YELLOW
                ctx.beginPath()
                ctx.arc(sx, sy, 1.5, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()
            }

            // ── Explosion/particles ──
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

            // ── Score watermark on table ──
            ctx.save()
            ctx.font = "bold 72px 'JetBrains Mono', monospace"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.globalAlpha = 0.06
            ctx.fillStyle = NEON_CYAN
            ctx.fillText(String(scoreRef.current), w / 2, h / 2)
            ctx.restore()
        }

        animRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(animRef.current)
    }, [canvasSize, gridSize, spawnParticles, spawnTrail, placeFood, playEatSound, playDeathSound, playWinSound, highScore])

    const won = scoreRef.current >= WINNING_SCORE
    const speedColor = getSpeedColor(speed)
    const speedLabel = getSpeedLabel(speed)

    return (
        <div className="fixed inset-0 bg-[#050810] flex flex-col items-center justify-center overflow-hidden select-none">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-cyan-500/5 blur-3xl rounded-full" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-green-500/5 blur-3xl rounded-full" />
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
                                GLOW SNAKE
                            </h1>
                            <p className="text-white/40 text-sm mb-8 font-mono">Neon Edition</p>

                            <p className="text-white/50 text-xs mb-6 uppercase tracking-widest">Set Speed</p>

                            {/* Speed slider */}
                            <div className="w-64 mx-auto mb-6">
                                {/* Speed number */}
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

                                {/* Label */}
                                <div
                                    className="text-xs font-mono font-bold uppercase tracking-widest mb-5 transition-colors duration-200"
                                    style={{ color: speedColor }}
                                >
                                    {speedLabel}
                                </div>

                                {/* Slider track */}
                                <div className="relative h-10 flex items-center">
                                    {/* Background track */}
                                    <div className="absolute left-0 right-0 h-2 rounded-full overflow-hidden"
                                        style={{ background: "rgba(255,255,255,0.06)" }}>
                                        {/* Filled portion */}
                                        <div
                                            className="h-full rounded-full transition-all duration-150"
                                            style={{
                                                width: `${((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%`,
                                                background: `linear-gradient(90deg, #00ff88, ${speedColor})`,
                                                boxShadow: `0 0 12px ${speedColor}66, 0 0 4px ${speedColor}aa`,
                                            }}
                                        />
                                    </div>

                                    {/* Tick marks */}
                                    <div className="absolute left-0 right-0 h-2 flex items-center pointer-events-none">
                                        {Array.from({ length: SPEED_MAX - SPEED_MIN + 1 }, (_, i) => {
                                            const v = i + SPEED_MIN
                                            const pct = (i / (SPEED_MAX - SPEED_MIN)) * 100
                                            const isMajor = v % 5 === 0
                                            return (
                                                <div
                                                    key={v}
                                                    className="absolute"
                                                    style={{
                                                        left: `${pct}%`,
                                                        width: "1px",
                                                        height: isMajor ? "10px" : "4px",
                                                        background: v <= speed
                                                            ? `${speedColor}88`
                                                            : "rgba(255,255,255,0.1)",
                                                        transform: "translateX(-50%)",
                                                    }}
                                                />
                                            )
                                        })}
                                    </div>

                                    {/* Thumb */}
                                    <div
                                        className="absolute transition-all duration-150"
                                        style={{
                                            left: `${((speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%`,
                                            transform: "translateX(-50%)",
                                        }}
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full border-2"
                                            style={{
                                                borderColor: speedColor,
                                                background: `radial-gradient(circle at 35% 35%, #ffffff, ${speedColor})`,
                                                boxShadow: `0 0 16px ${speedColor}88, 0 0 32px ${speedColor}44`,
                                            }}
                                        />
                                    </div>

                                    {/* Invisible range input */}
                                    <input
                                        type="range"
                                        min={SPEED_MIN}
                                        max={SPEED_MAX}
                                        value={speed}
                                        onChange={(e) => setSpeed(Number(e.target.value))}
                                        className="absolute left-0 right-0 w-full h-10 opacity-0 cursor-pointer"
                                        style={{ zIndex: 10 }}
                                    />
                                </div>

                                {/* Speed range labels */}
                                <div className="flex justify-between mt-2">
                                    <span className="text-[9px] font-mono" style={{ color: "#00ff8866" }}>SLOW</span>
                                    <span className="text-[9px] font-mono" style={{ color: "#ff336666" }}>FAST</span>
                                </div>
                            </div>

                            {/* Play button */}
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
                                Swipe or use arrow keys
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
                                style={{ color: won ? NEON_GREEN : NEON_PINK }}>
                                {won ? "YOU WIN!" : "GAME OVER"}
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
                        SWIPE OR USE ARROW KEYS TO CHANGE DIRECTION
                    </p>
                </div>
            )}
        </div>
    )
}
