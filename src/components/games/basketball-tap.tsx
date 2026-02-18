"use client"

import React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { useGameSession } from "@/hooks/use-game-session"

interface Ball {
    x: number
    y: number
    vx: number
    vy: number
    radius: number
    rotation: number
    isFlying: boolean
    hasPeaked: boolean
    spawnProgress: number  // 0 to 1 for spawn animation
    isSpawning: boolean
    spawnOriginX: number   // Corner origin for genie animation
    spawnOriginY: number
    targetX: number        // Final position
    targetY: number
}

interface ScoredBall {
    x: number
    y: number
    vx: number
    vy: number
    radius: number
    rotation: number
    opacity: number
    hasBounced: boolean
    scale: number  // Fixed scale at time of scoring
}

interface Hoop {
    x: number
    y: number
    width: number
    height: number
    rimY: number
    direction: number // 1 = right, -1 = left
    speed: number
    isMoving: boolean
}

interface SwipeState {
    startX: number
    startY: number
    startTime: number
    isActive: boolean
}

interface EmojiFeedback {
    id: number
    emoji: string
    x: number
    y: number
    opacity: number
    createdAt: number
}

type GameState = "idle" | "playing" | "gameover"

export function BasketballTapGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ballRef = useRef<Ball | null>(null)
    const hoopRef = useRef<Hoop | null>(null)
    const swipeRef = useRef<SwipeState>({ startX: 0, startY: 0, startTime: 0, isActive: false })
    const animationRef = useRef<number>(0)
    const lastTimeRef = useRef<number>(0)

    const [gameState, setGameState] = useState<GameState>("idle")
    const [score, setScore] = useState(0)
    const [highScore, setHighScore] = useState(0)
    const [displayBest, setDisplayBest] = useState<number | null>(null)
    const [scoreAnim, setScoreAnim] = useState(false)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
    const [showBestOnIdle, setShowBestOnIdle] = useState(false)
    const emojiFeedbackRef = useRef<EmojiFeedback[]>([])
    const emojiIdRef = useRef(0)
    const lastInputWasTouchRef = useRef(false)
    const scoreRef = useRef(0)
    const scoredBallsRef = useRef<ScoredBall[]>([])

    // Emoji lists
    const goodEmojis = ['🏀', '💪🏾', '🔥', '🙌🏾', '🤙🏾', '😎', '🏆', '🥇', '💯']
    const badEmojis = ['🥲', '😭', '😥', '💔', '😔', '🧱']

    const { session, startGame, recordAction, endGame } = useGameSession()

    const audioContextRef = useRef<AudioContext | null>(null)
    const accumulatorRef = useRef(0)

    // Physics constants
    const GRAVITY = 0.35
    const BALL_RADIUS = 50
    const HOOP_MOVE_THRESHOLD = 10
    const RIM_RADIUS = 8
    const RIM_BOUNCE = 0.7
    const MIN_SWIPE_DISTANCE = 50
    
    // Parallax scale constants
    const MIN_SCALE = 0.65  // Ball scale at hoop level (smallest)
    const MAX_SCALE = 1.0   // Ball scale at bottom (largest)

    // Initialize audio context
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        }
        return audioContextRef.current
    }, [])

    // Play swoosh sound (ball thrown)
    const playSwooshSound = useCallback(() => {
        if (!soundEnabled) return

        try {
            const ctx = getAudioContext()
            const oscillator = ctx.createOscillator()
            const gainNode = ctx.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(ctx.destination)

            oscillator.type = 'sine'
            oscillator.frequency.setValueAtTime(400, ctx.currentTime)
            oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15)

            gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

            oscillator.start(ctx.currentTime)
            oscillator.stop(ctx.currentTime + 0.15)
        } catch {
            // Audio not supported
        }
    }, [soundEnabled, getAudioContext])

    // Play score sound
    const playScoreSound = useCallback(() => {
        if (!soundEnabled) return

        try {
            const ctx = getAudioContext()
            
            // First beep
            const osc1 = ctx.createOscillator()
            const gain1 = ctx.createGain()
            osc1.connect(gain1)
            gain1.connect(ctx.destination)
            osc1.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
            gain1.gain.setValueAtTime(0.3, ctx.currentTime)
            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
            osc1.start(ctx.currentTime)
            osc1.stop(ctx.currentTime + 0.1)

            // Second beep
            const osc2 = ctx.createOscillator()
            const gain2 = ctx.createGain()
            osc2.connect(gain2)
            gain2.connect(ctx.destination)
            osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1) // E5
            gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.1)
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
            osc2.start(ctx.currentTime + 0.1)
            osc2.stop(ctx.currentTime + 0.2)
        } catch {
            // Audio not supported
        }
    }, [soundEnabled, getAudioContext])

    // Play miss sound
    const playMissSound = useCallback(() => {
        if (!soundEnabled) return

        try {
            const ctx = getAudioContext()
            const oscillator = ctx.createOscillator()
            const gainNode = ctx.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(ctx.destination)

            oscillator.frequency.setValueAtTime(200, ctx.currentTime)
            oscillator.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3)

            gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

            oscillator.start(ctx.currentTime)
            oscillator.stop(ctx.currentTime + 0.3)
        } catch {
            // Audio not supported
        }
    }, [soundEnabled, getAudioContext])

    // Show emoji feedback
    const showEmojiFeedback = useCallback((emoji: string, x: number, y: number) => {
        const id = emojiIdRef.current++
        const newEmoji: EmojiFeedback = {
            id,
            emoji,
            x,
            y,
            opacity: 1.0,
            createdAt: Date.now(),
        }
        emojiFeedbackRef.current.push(newEmoji)
    }, [])

    // Update emoji feedback (fade out)
    const updateEmojiFeedback = useCallback(() => {
        const now = Date.now()
        const arr = emojiFeedbackRef.current
        for (let i = arr.length - 1; i >= 0; i--) {
            const e = arr[i]
            e.opacity = Math.max(0, 1.0 - (now - e.createdAt) / 1000)
            if (e.opacity <= 0) arr.splice(i, 1)
        }
    }, [])

    // Handle canvas resize
    useEffect(() => {
        const updateSize = () => {
            setCanvasSize({ width: Math.floor(window.innerWidth), height: Math.floor(window.innerHeight) })
        }

        updateSize()
        window.addEventListener("resize", updateSize)
        return () => window.removeEventListener("resize", updateSize)
    }, [])

    // Canvas DPI scaling
    useEffect(() => {
        if (!canvasRef.current || canvasSize.width === 0 || canvasSize.height === 0) return
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5))
        const canvas = canvasRef.current
        canvas.width = Math.floor(canvasSize.width * dpr)
        canvas.height = Math.floor(canvasSize.height * dpr)
        canvas.style.width = `${canvasSize.width}px`
        canvas.style.height = `${canvasSize.height}px`
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }, [canvasSize])

    // Load high score
    useEffect(() => {
        const saved = localStorage.getItem("basketballTap_highScore")
        if (saved) setHighScore(parseInt(saved, 10))
    }, [])

    // Calculate parallax scale based on Y position (simulates depth/distance)
    const getScale = useCallback((y: number, hoopY: number): number => {
        const bottomY = canvasSize.height - BALL_RADIUS - 80
        const topY = hoopY + 100 // Near the rim
        
        // Clamp y between top and bottom
        const clampedY = Math.max(topY, Math.min(bottomY, y))
        
        // Linear interpolation: bottom = MAX_SCALE, top = MIN_SCALE
        const t = (clampedY - topY) / (bottomY - topY)
        return MIN_SCALE + t * (MAX_SCALE - MIN_SCALE)
    }, [canvasSize.height])

    // Draw basketball with scale for parallax effect and optional opacity
    // Supports spawn animation with genie effect
    const drawBall = useCallback((ctx: CanvasRenderingContext2D, ball: Ball | ScoredBall, scale: number = 1.0, opacity: number = 1.0, spawnProgress: number = 1.0) => {
        // Genie spawn effect: starts squished and small, then pops into shape
        const easeOutBack = (t: number) => {
            const c1 = 1.70158
            const c3 = c1 + 1
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
        }
        
        const easeOutElastic = (t: number) => {
            if (t === 0 || t === 1) return t
            const p = 0.4
            return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1
        }
        
        // Apply spawn animation transforms
        const spawnEase = easeOutBack(spawnProgress)
        const scaleX = spawnProgress < 1 ? 0.3 + spawnEase * 0.7 : 1
        const scaleY = spawnProgress < 1 ? 0.3 + easeOutElastic(spawnProgress) * 0.7 : 1
        const spawnOpacity = spawnProgress < 1 ? Math.min(1, spawnProgress * 1.5) : opacity
        
        const scaledRadius = ball.radius * scale
        
        ctx.save()
        ctx.globalAlpha = spawnOpacity
        ctx.translate(ball.x, ball.y)
        ctx.rotate(ball.rotation)
        ctx.scale(scaleX, scaleY)

        // Orange ball
        const gradient = ctx.createRadialGradient(-scaledRadius * 0.3, -scaledRadius * 0.3, 0, 0, 0, scaledRadius)
        gradient.addColorStop(0, '#FF8C42')
        gradient.addColorStop(0.7, '#E85D04')
        gradient.addColorStop(1, '#B84700')

        ctx.beginPath()
        ctx.arc(0, 0, scaledRadius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        // Ball lines - scale line width too
        ctx.strokeStyle = '#1a1a1a'
        ctx.lineWidth = 2.5 * scale

        // Vertical line
        ctx.beginPath()
        ctx.arc(0, 0, scaledRadius * 0.95, -Math.PI * 0.5, Math.PI * 0.5)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, 0, scaledRadius * 0.95, Math.PI * 0.5, Math.PI * 1.5)
        ctx.stroke()

        // Horizontal line
        ctx.beginPath()
        ctx.moveTo(-scaledRadius, 0)
        ctx.lineTo(scaledRadius, 0)
        ctx.stroke()

        // Curved lines
        ctx.beginPath()
        ctx.arc(-scaledRadius * 0.2, 0, scaledRadius * 0.85, -Math.PI * 0.35, Math.PI * 0.35)
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(scaledRadius * 0.2, 0, scaledRadius * 0.85, Math.PI * 0.65, Math.PI * 1.35)
        ctx.stroke()

        ctx.restore()
    }, [])

    // Draw basketball hoop
    const drawHoop = useCallback((ctx: CanvasRenderingContext2D, hoop: Hoop) => {
        ctx.save()
        
        const hoopCenterX = hoop.x

        // Backboard
        const backboardWidth = 180
        const backboardHeight = 120
        const backboardX = hoopCenterX - backboardWidth / 2
        const backboardY = hoop.y

        // Backboard shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
        ctx.fillRect(backboardX + 5, backboardY + 5, backboardWidth, backboardHeight)

        // Backboard main
        ctx.strokeStyle = '#9CA3AF'
        ctx.lineWidth = 4
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.fillRect(backboardX, backboardY, backboardWidth, backboardHeight)
        ctx.strokeRect(backboardX, backboardY, backboardWidth, backboardHeight)

        // Inner square on backboard
        const innerWidth = 70
        const innerHeight = 55
        const innerX = hoopCenterX - innerWidth / 2
        const innerY = backboardY + 25
        ctx.strokeStyle = '#9CA3AF'
        ctx.lineWidth = 3
        ctx.strokeRect(innerX, innerY, innerWidth, innerHeight)

        // Rim
        const rimY = backboardY + backboardHeight - 10
        const rimWidth = 90
        const rimX = hoopCenterX - rimWidth / 2

        // Rim bracket
        ctx.fillStyle = '#6B7280'
        ctx.fillRect(hoopCenterX - 5, rimY - 5, 10, 15)

        // Rim (red)
        ctx.strokeStyle = '#DC2626'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(rimX, rimY)
        ctx.lineTo(rimX + rimWidth, rimY)
        ctx.stroke()

        // Rim end caps
        ctx.fillStyle = '#DC2626'
        ctx.beginPath()
        ctx.arc(rimX, rimY, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(rimX + rimWidth, rimY, 5, 0, Math.PI * 2)
        ctx.fill()

        // Net (simple lines)
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.8)'
        ctx.lineWidth = 1.5
        const netHeight = 50
        const netSegments = 8
        for (let i = 0; i <= netSegments; i++) {
            const startX = rimX + (rimWidth * i / netSegments)
            const endX = hoopCenterX + (startX - hoopCenterX) * 0.3
            ctx.beginPath()
            ctx.moveTo(startX, rimY + 3)
            ctx.quadraticCurveTo(
                (startX + endX) / 2,
                rimY + netHeight * 0.6,
                endX,
                rimY + netHeight
            )
            ctx.stroke()
        }

        // Pole/support
        ctx.fillStyle = '#6B7280'
        ctx.fillRect(hoopCenterX - 8, backboardY + backboardHeight, 16, 20)

        ctx.restore()
    }, [])

    // Draw emoji feedback
    const drawEmojiFeedback = useCallback((ctx: CanvasRenderingContext2D) => {
        const arr = emojiFeedbackRef.current
        for (let i = 0; i < arr.length; i++) {
            const emoji = arr[i]
            ctx.save()
            ctx.globalAlpha = emoji.opacity
            ctx.font = '40px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(emoji.emoji, emoji.x, emoji.y)
            ctx.restore()
        }
    }, [])

    // Initialize ball
    const initBall = useCallback(() => {
        ballRef.current = {
            x: canvasSize.width / 2,
            y: canvasSize.height - BALL_RADIUS - 80,
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS,
            rotation: 0,
            isFlying: false,
            hasPeaked: false,
            spawnProgress: 1,  // Start fully spawned for initial ball
            isSpawning: false,
            spawnOriginX: canvasSize.width / 2,
            spawnOriginY: canvasSize.height - BALL_RADIUS - 80,
            targetX: canvasSize.width / 2,
            targetY: canvasSize.height - BALL_RADIUS - 80,
        }
    }, [canvasSize])

    // Initialize hoop
    const initHoop = useCallback(() => {
        const hoopWidth = 180
        const hoopHeight = 120
        hoopRef.current = {
            x: canvasSize.width / 2,
            y: 80,
            width: hoopWidth,
            height: hoopHeight,
            rimY: 80 + hoopHeight - 10,
            direction: 1,
            speed: 1,  // Slower starting speed
            isMoving: false,
        }
    }, [canvasSize])

    // Re-init when canvas size changes
    useEffect(() => {
        if (canvasSize.width === 0 || canvasSize.height === 0) return
        initBall()
        initHoop()
    }, [canvasSize, initBall, initHoop])

    // Check rim collision and bounce - only when ball has peaked (simulates 3D arc)
    const checkRimCollision = useCallback((ball: Ball, hoop: Hoop, scaledRadius: number): boolean => {
        // Only check collisions after ball has peaked (gone up and started coming down)
        // This simulates the ball arcing "over" the rim in 3D space on the way up
        if (!ball.hasPeaked) {
            return false
        }

        const rimY = hoop.y + hoop.height - 10
        const rimLeft = hoop.x - 45
        const rimRight = hoop.x + 45

        // Left rim collision - use scaled radius
        const distToLeftRim = Math.sqrt((ball.x - rimLeft) ** 2 + (ball.y - rimY) ** 2)
        if (distToLeftRim < scaledRadius + RIM_RADIUS) {
            // Calculate bounce direction
            const nx = (ball.x - rimLeft) / distToLeftRim
            const ny = (ball.y - rimY) / distToLeftRim
            
            // Reflect velocity
            const dot = ball.vx * nx + ball.vy * ny
            ball.vx = (ball.vx - 2 * dot * nx) * RIM_BOUNCE
            ball.vy = (ball.vy - 2 * dot * ny) * RIM_BOUNCE
            
            // Push ball out of collision
            const overlap = scaledRadius + RIM_RADIUS - distToLeftRim
            ball.x += nx * overlap
            ball.y += ny * overlap
            
            return true
        }

        // Right rim collision - use scaled radius
        const distToRightRim = Math.sqrt((ball.x - rimRight) ** 2 + (ball.y - rimY) ** 2)
        if (distToRightRim < scaledRadius + RIM_RADIUS) {
            const nx = (ball.x - rimRight) / distToRightRim
            const ny = (ball.y - rimY) / distToRightRim
            
            const dot = ball.vx * nx + ball.vy * ny
            ball.vx = (ball.vx - 2 * dot * nx) * RIM_BOUNCE
            ball.vy = (ball.vy - 2 * dot * ny) * RIM_BOUNCE
            
            const overlap = scaledRadius + RIM_RADIUS - distToRightRim
            ball.x += nx * overlap
            ball.y += ny * overlap
            
            return true
        }

        // Backboard collision - only after peaked, use scaled radius
        const backboardLeft = hoop.x - 90
        const backboardRight = hoop.x + 90
        const backboardTop = hoop.y
        const backboardBottom = hoop.y + hoop.height

        if (ball.x + scaledRadius > backboardLeft && 
            ball.x - scaledRadius < backboardRight &&
            ball.y - scaledRadius < backboardBottom &&
            ball.y + scaledRadius > backboardTop) {
            
            // Bottom of backboard collision (ball coming up and hitting bottom)
            if (ball.y > backboardBottom - 20 && ball.vy < 0) {
                ball.vy = -ball.vy * RIM_BOUNCE
                ball.y = backboardBottom + scaledRadius
                return true
            }
        }

        return false
    }, [])

    // Check if ball went through hoop - uses scaled radius for smooth entry
    const checkScore = useCallback((ball: Ball, hoop: Hoop, prevY: number, scaledRadius: number): boolean => {
        const rimY = hoop.y + hoop.height - 10
        const rimLeft = hoop.x - 45
        const rimRight = hoop.x + 45

        // Ball must be moving downward and pass through rim area
        // Check if ball crossed the rim plane from above
        // Use scaled radius - smaller ball at this height fits through easier
        if (ball.vy > 0 && 
            prevY <= rimY &&
            ball.y >= rimY &&
            ball.x > rimLeft + scaledRadius * 0.3 && 
            ball.x < rimRight - scaledRadius * 0.3) {
            return true
        }
        return false
    }, [])

    // Game loop
    const gameLoop = useCallback((timestamp: number) => {
        if (!canvasRef.current || !ballRef.current || !hoopRef.current || gameState !== "playing") return

        const ctx = canvasRef.current.getContext("2d")
        if (!ctx) return

        const frameMs = 1000 / 60
        let deltaTime = Math.min(200, Math.max(0, timestamp - lastTimeRef.current))
        lastTimeRef.current = timestamp

        accumulatorRef.current += deltaTime

        const ball = ballRef.current
        const hoop = hoopRef.current

        while (accumulatorRef.current >= frameMs) {
            // Move hoop if score >= HOOP_MOVE_THRESHOLD
            if (hoop.isMoving) {
                hoop.x += hoop.direction * hoop.speed
                
                // Bounce off walls
                const margin = 100
                if (hoop.x >= canvasSize.width - margin) {
                    hoop.x = canvasSize.width - margin
                    hoop.direction = -1
                }
                if (hoop.x <= margin) {
                    hoop.x = margin
                    hoop.direction = 1
                }
            }

            // Update spawn animation
            if (ball.isSpawning) {
                ball.spawnProgress += 0.025  // Slower animation speed
                ball.rotation += 0.12  // Slower, more subtle spin
                
                // Interpolate position from corner to target
                const easeOut = 1 - Math.pow(1 - ball.spawnProgress, 3)
                ball.x = ball.spawnOriginX + (ball.targetX - ball.spawnOriginX) * easeOut
                ball.y = ball.spawnOriginY + (ball.targetY - ball.spawnOriginY) * easeOut
                
                if (ball.spawnProgress >= 1) {
                    ball.spawnProgress = 1
                    ball.isSpawning = false
                    ball.x = ball.targetX
                    ball.y = ball.targetY
                    ball.rotation = 0  // Reset rotation when done
                }
            }

            // Ball physics when flying
            if (ball.isFlying) {
                const prevY = ball.y
                const prevVy = ball.vy
                
                ball.vy += GRAVITY
                ball.x += ball.vx
                ball.y += ball.vy
                ball.rotation += ball.vx * 0.03

                // Detect when ball has peaked (velocity changed from negative to positive)
                if (prevVy < 0 && ball.vy >= 0) {
                    ball.hasPeaked = true
                }

                // Calculate scaled radius for parallax effect
                const scale = getScale(ball.y, hoop.y)
                const scaledRadius = ball.radius * scale

                // Check rim collisions (only after ball has peaked, using scaled radius)
                checkRimCollision(ball, hoop, scaledRadius)

                // Check for scoring (using scaled radius for smooth entry)
                if (checkScore(ball, hoop, prevY, scaledRadius)) {
                    playScoreSound()
                    const newScore = scoreRef.current + 1
                    scoreRef.current = newScore
                    setScore(newScore)
                    
                    // Show good emoji
                    const randomGoodEmoji = goodEmojis[Math.floor(Math.random() * goodEmojis.length)]
                    showEmojiFeedback(randomGoodEmoji, hoop.x, hoop.rimY + 60)

                    // Start hoop moving after score of 10
                    if (newScore >= HOOP_MOVE_THRESHOLD && !hoop.isMoving) {
                        hoop.isMoving = true
                    }

                    // Increase hoop speed as score increases (slower progression)
                    if (newScore > HOOP_MOVE_THRESHOLD) {
                        hoop.speed = 1 + (newScore - HOOP_MOVE_THRESHOLD) * 0.08
                    }

                    // Record action
                    recordAction("score")

                    // Create a scored ball that will fall through and fade
                    // Keep the scale fixed at the size it was when scored
                    const scoreScale = getScale(ball.y, hoop.y)
                    const scoredBall: ScoredBall = {
                        x: ball.x,
                        y: ball.y,
                        vx: ball.vx * 0.3,
                        vy: ball.vy,
                        radius: ball.radius,
                        rotation: ball.rotation,
                        opacity: 1.0,
                        hasBounced: false,
                        scale: scoreScale,
                    }
                    scoredBallsRef.current.push(scoredBall)

                    // Spawn new ball - randomize X position after 10 scores
                    let newBallX = canvasSize.width / 2
                    if (newScore >= HOOP_MOVE_THRESHOLD) {
                        const margin = 80
                        newBallX = margin + Math.random() * (canvasSize.width - margin * 2)
                    }
                    
                    // Pick a random bottom corner for genie animation origin
                    const fromLeftCorner = Math.random() > 0.5
                    const cornerX = fromLeftCorner ? -BALL_RADIUS : canvasSize.width + BALL_RADIUS
                    const cornerY = canvasSize.height + BALL_RADIUS
                    
                    ball.spawnOriginX = cornerX
                    ball.spawnOriginY = cornerY
                    ball.targetX = newBallX
                    ball.targetY = canvasSize.height - BALL_RADIUS - 80
                    ball.x = cornerX  // Start at corner
                    ball.y = cornerY
                    ball.vx = 0
                    ball.vy = 0
                    ball.isFlying = false
                    ball.hasPeaked = false
                    ball.rotation = 0
                    ball.spawnProgress = 0  // Start spawn animation
                    ball.isSpawning = true
                }

                // Ball went off screen (missed)
                if (ball.y > canvasSize.height + ball.radius || 
                    ball.x < -ball.radius || 
                    ball.x > canvasSize.width + ball.radius) {
                    
                    playMissSound()

                    // Show bad emoji
                    const randomBadEmoji = badEmojis[Math.floor(Math.random() * badEmojis.length)]
                    showEmojiFeedback(randomBadEmoji, canvasSize.width / 2, canvasSize.height / 2)

                    // Game over
                    const finalScore = scoreRef.current
                    const immediateBest = Math.max(highScore, finalScore)
                    setDisplayBest(immediateBest)
                    setScoreAnim(true)
                    setGameState("gameover")

                    // Update high score immediately if beaten
                    if (finalScore > highScore) {
                        setHighScore(finalScore)
                        localStorage.setItem("basketballTap_highScore", finalScore.toString())
                    }

                    setTimeout(() => setScoreAnim(false), 800)

                    endGame().finally(() => {
                        setTimeout(() => {
                            initBall()
                            initHoop()
                            scoreRef.current = 0
                            scoredBallsRef.current = [] // Clear any fading balls
                            setShowBestOnIdle(true)
                            setGameState("idle")
                            setDisplayBest(null)
                        }, 1000)
                    })

                    return
                }
            }

            // Update scored balls (falling through, bouncing, fading)
            const scoredBalls = scoredBallsRef.current
            const groundY = canvasSize.height - BALL_RADIUS * MIN_SCALE - 20
            const fadeStartY = groundY - 150 // Start fading before hitting ground
            
            for (let i = scoredBalls.length - 1; i >= 0; i--) {
                const sb = scoredBalls[i]
                
                // Apply gravity
                sb.vy += GRAVITY
                sb.x += sb.vx
                sb.y += sb.vy
                sb.rotation += sb.vx * 0.03
                
                // Start fading just before ground
                if (sb.y >= fadeStartY && !sb.hasBounced) {
                    sb.opacity -= 0.04
                }
                
                // Ground bounce (once)
                if (!sb.hasBounced && sb.y >= groundY) {
                    sb.y = groundY
                    sb.vy = -sb.vy * 0.4 // Bounce with energy loss
                    sb.vx *= 0.5
                    sb.hasBounced = true
                }
                
                // Continue fading after bounce (faster)
                if (sb.hasBounced) {
                    sb.opacity -= 0.06
                }
                
                // Remove when fully faded
                if (sb.opacity <= 0) {
                    scoredBalls.splice(i, 1)
                }
            }

            accumulatorRef.current -= frameMs
        }

        // Clear and redraw
        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)
        
        // White background
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)
        
        // Calculate scale for parallax effect
        const ballScale = getScale(ball.y, hoop.y)
        
        drawHoop(ctx, hoop)
        
        // Draw scored balls (fading) behind the main ball - use their fixed scale
        for (const sb of scoredBallsRef.current) {
            drawBall(ctx, sb, sb.scale, sb.opacity, 1.0)
        }
        
        // Draw main ball with spawn animation
        drawBall(ctx, ball, ballScale, 1.0, ball.spawnProgress)
        
        updateEmojiFeedback()
        drawEmojiFeedback(ctx)

        animationRef.current = requestAnimationFrame(gameLoop)
    }, [gameState, canvasSize, drawBall, drawHoop, checkScore, checkRimCollision, playScoreSound, playMissSound, 
        endGame, highScore, initBall, initHoop, updateEmojiFeedback, drawEmojiFeedback, 
        showEmojiFeedback, goodEmojis, badEmojis, recordAction, getScale])

    // Start game loop
    useEffect(() => {
        if (gameState === "playing") {
            lastTimeRef.current = performance.now()
            animationRef.current = requestAnimationFrame(gameLoop)
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [gameState, gameLoop])

    // Handle swipe start
    const handleSwipeStart = useCallback((clientX: number, clientY: number) => {
        if (!ballRef.current || !canvasRef.current) return
        if (ballRef.current.isFlying) return

        const rect = canvasRef.current.getBoundingClientRect()
        const x = clientX - rect.left
        const y = clientY - rect.top

        const ball = ballRef.current
        const distance = Math.sqrt((x - ball.x) ** 2 + (y - ball.y) ** 2)

        // Check if touch is on or near the ball
        if (distance <= ball.radius * 1.5) {
            swipeRef.current = {
                startX: x,
                startY: y,
                startTime: Date.now(),
                isActive: true,
            }
        }
    }, [])

    // Handle swipe end
    const handleSwipeEnd = useCallback(async (clientX: number, clientY: number) => {
        if (!swipeRef.current.isActive || !ballRef.current || !canvasRef.current) return

        const rect = canvasRef.current.getBoundingClientRect()
        const endX = clientX - rect.left
        const endY = clientY - rect.top

        const swipe = swipeRef.current
        const dx = endX - swipe.startX
        const dy = endY - swipe.startY
        const dt = Date.now() - swipe.startTime

        swipeRef.current.isActive = false

        // Must be an upward swipe
        if (dy >= 0) return

        // Calculate swipe distance
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Minimum swipe requirement - half the threshold is enough for auto-shot
        if (distance < MIN_SWIPE_DISTANCE / 2) return

        // Start game if idle
        if (gameState === "idle") {
            await startGame("basketball-tap")
            setGameState("playing")
            setScore(0)
            scoreRef.current = 0
            emojiFeedbackRef.current = []
            scoredBallsRef.current = [] // Clear any fading balls
            
            // Reset hoop
            if (hoopRef.current) {
                hoopRef.current.isMoving = false
                hoopRef.current.x = canvasSize.width / 2
                hoopRef.current.speed = 2
            }
        }

        const ball = ballRef.current
        const hoop = hoopRef.current

        if (!hoop) return

        // Calculate automatic shot trajectory to aim at the hoop
        // Horizontal direction based on swipe, but auto-calculated power
        const targetX = hoop.x + (dx * 0.3) // Slight horizontal influence from swipe
        
        // Peak should be at the middle of the inner square on backboard
        // Inner square is at hoop.y + 25 to hoop.y + 80, so middle is around hoop.y + 50
        const peakY = hoop.y + 50
        const rimY = hoop.y + hoop.height - 10
        
        const deltaX = targetX - ball.x
        const startY = ball.y
        
        // Calculate trajectory using peak position
        // At peak, vy = 0, so we use: vy_initial^2 = 2 * g * (startY - peakY)
        const peakHeight = startY - peakY
        const vyInitial = -Math.sqrt(2 * GRAVITY * peakHeight)
        
        // Time to reach peak: t_peak = -vy_initial / g
        const timeToPeak = -vyInitial / GRAVITY
        
        // Time to fall from peak to rim: using y = peakY + 0.5 * g * t^2
        const fallDistance = rimY - peakY
        const timeToFall = Math.sqrt(2 * fallDistance / GRAVITY)
        
        // Total time
        const totalTime = timeToPeak + timeToFall
        
        // Horizontal velocity
        ball.vx = deltaX / totalTime
        ball.vy = vyInitial
        
        // Add slight randomness for challenge
        ball.vx += (Math.random() - 0.5) * 1.2
        ball.vy += (Math.random() - 0.5) * 0.8
        
        ball.isFlying = true
        ball.hasPeaked = false

        playSwooshSound()
        recordAction("swipe")

    }, [gameState, startGame, playSwooshSound, recordAction, canvasSize])

    // Canvas event handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (lastInputWasTouchRef.current) return
        handleSwipeStart(e.clientX, e.clientY)
    }

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (lastInputWasTouchRef.current) return
        handleSwipeEnd(e.clientX, e.clientY)
    }

    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        lastInputWasTouchRef.current = true
        setTimeout(() => { lastInputWasTouchRef.current = false }, 500)
        const touch = e.touches[0]
        handleSwipeStart(touch.clientX, touch.clientY)
    }

    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        const touch = e.changedTouches[0]
        handleSwipeEnd(touch.clientX, touch.clientY)
    }

    // Draw initial state
    useEffect(() => {
        if (!canvasRef.current || canvasSize.width === 0) return

        const ctx = canvasRef.current.getContext("2d")
        if (!ctx) return

        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

        // White background
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)

        if (hoopRef.current) {
            drawHoop(ctx, hoopRef.current)
        }

        if (gameState === "idle" || gameState === "gameover") {
            const staticBall: Ball = {
                x: canvasSize.width / 2,
                y: canvasSize.height - BALL_RADIUS - 80,
                vx: 0,
                vy: 0,
                radius: BALL_RADIUS,
                rotation: 0,
                isFlying: false,
                hasPeaked: false,
                spawnProgress: 1,
                isSpawning: false,
                spawnOriginX: canvasSize.width / 2,
                spawnOriginY: canvasSize.height - BALL_RADIUS - 80,
                targetX: canvasSize.width / 2,
                targetY: canvasSize.height - BALL_RADIUS - 80,
            }
            // Static ball at bottom uses full scale (1.0)
            drawBall(ctx, staticBall, MAX_SCALE, 1.0, 1.0)
        }
        
        drawEmojiFeedback(ctx)
    }, [canvasSize, gameState, drawBall, drawHoop, drawEmojiFeedback])

    return (
        <div 
            className="min-h-screen flex flex-col"
            style={{
                backgroundColor: '#fff',
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50
            }}
        >
            {/* High Score Display */}
            <div className="absolute top-4 right-4 z-20 text-right">
                <div className="text-xs text-gray-500 font-medium">High Score</div>
                <div className="text-xl font-bold text-gray-700">{highScore}</div>
            </div>

            {/* Game Area */}
            <div className="flex-1 flex flex-col items-center justify-center relative">
                {/* Current Best / Score Display */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-center pointer-events-none">
                    {gameState === "idle" && (
                        <>
                            <div className="text-gray-400 text-lg font-medium mb-2">
                                {showBestOnIdle ? "Current Best" : "Swipe up to shoot!"}
                            </div>
                            {showBestOnIdle && (
                                <div 
                                    className="text-7xl font-bold"
                                    style={{ 
                                        color: '#60A5FA',
                                        fontFamily: 'system-ui, -apple-system, sans-serif'
                                    }}
                                >
                                    {highScore}
                                </div>
                            )}
                        </>
                    )}
                    {gameState === "playing" && (
                        <div 
                            className="text-8xl font-bold select-none"
                            style={{ 
                                color: 'rgba(156, 163, 175, 0.6)',
                                transform: scoreAnim ? 'scale(1.1)' : 'scale(1)',
                                transition: 'transform 200ms ease-out'
                            }}
                        >
                            {score}
                        </div>
                    )}
                    {gameState === "gameover" && (
                        <>
                            <div className="text-gray-400 text-lg font-medium mb-2">
                                {score > highScore ? "New High Score!" : "Game Over"}
                            </div>
                            <div 
                                className="text-7xl font-bold"
                                style={{ 
                                    color: score > highScore ? '#10B981' : '#60A5FA',
                                    transform: scoreAnim ? 'scale(1.15)' : 'scale(1)',
                                    transition: 'transform 300ms cubic-bezier(.2,.8,.2,1)'
                                }}
                            >
                                {displayBest ?? score}
                            </div>
                        </>
                    )}
                </div>

                {/* Canvas */}
                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    className="touch-none cursor-pointer"
                />
            </div>
        </div>
    )
}
