"use client"

import React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import { ArrowLeft, Play, RotateCcw, Trophy, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGameSession } from "@/hooks/use-game-session"
import Link from "next/link"

interface Ball {
    x: number
    y: number
    vx: number
    vy: number
    radius: number
    rotation: number
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

export function FootballTapGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ballRef = useRef<Ball | null>(null)
    const animationRef = useRef<number>(0)
    const lastTimeRef = useRef<number>(0)
    const backgroundImageRef = useRef<HTMLImageElement | null>(null)
    const ballImageRef = useRef<HTMLImageElement | null>(null)

    const [gameState, setGameState] = useState<GameState>("idle")
    const [score, setScore] = useState(0)
    const [highScore, setHighScore] = useState(0)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
    const [imagesLoaded, setImagesLoaded] = useState(false)
    const [gameStarted, setGameStarted] = useState(false)
    const emojiFeedbackRef = useRef<EmojiFeedback[]>([])
    const emojiIdRef = useRef(0)
    const lastInputWasTouchRef = useRef(false)

    // Emoji lists
    const goodEmojis = ['😎', '🤙🏾', '🙌🏾', '🔥', '⚽️', '💪🏾', '🏆', '🥇']
    const badEmojis = ['🥲', '😭', '😥', '💔', '😔']

    const { session, startGame, recordAction, endGame } = useGameSession()

    const audioContextRef = useRef<AudioContext | null>(null)
    const accumulatorRef = useRef(0)

    // Physics constants
    const GRAVITY = 0.4
    const BOUNCE_VELOCITY = -12
    const HORIZONTAL_BOUNCE = 4
    const BALL_RADIUS = 45
    const FRICTION = 0.99

    // Initialize audio context
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        }
        return audioContextRef.current
    }, [])

    // Play kick sound
    const playKickSound = useCallback(() => {
        if (!soundEnabled) return

        try {
            const ctx = getAudioContext()
            const oscillator = ctx.createOscillator()
            const gainNode = ctx.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(ctx.destination)

            oscillator.frequency.setValueAtTime(200, ctx.currentTime)
            oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1)

            gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)

            oscillator.start(ctx.currentTime)
            oscillator.stop(ctx.currentTime + 0.1)
        } catch {
            // Audio not supported
        }
    }, [soundEnabled, getAudioContext])

    // Play game over sound
    const playGameOverSound = useCallback(() => {
        if (!soundEnabled) return

        try {
            const ctx = getAudioContext()
            const oscillator = ctx.createOscillator()
            const gainNode = ctx.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(ctx.destination)

            oscillator.frequency.setValueAtTime(400, ctx.currentTime)
            oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3)

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
            const aspectRatio = 9 / 16 // 9:16 aspect ratio
            const maxWidth = Math.min(window.innerWidth, 500)
            const maxHeight = Math.min(window.innerHeight - 100, 700)
            
            let width = maxWidth
            let height = width / aspectRatio
            
            if (height > maxHeight) {
                height = maxHeight
                width = height * aspectRatio
            }
            
            setCanvasSize({ width: Math.floor(width), height: Math.floor(height) })
        }

        updateSize()
        window.addEventListener("resize", updateSize)
        return () => window.removeEventListener("resize", updateSize)
    }, [])

    // Ensure canvas uses device pixel ratio for stable rendering
    useEffect(() => {
        if (!canvasRef.current || canvasSize.width === 0 || canvasSize.height === 0) return
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5)) // cap for performance
        const canvas = canvasRef.current
        canvas.width = Math.floor(canvasSize.width * dpr)
        canvas.height = Math.floor(canvasSize.height * dpr)
        canvas.style.width = `${canvasSize.width}px`
        canvas.style.height = `${canvasSize.height}px`
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }, [canvasSize])

    // Load high score from localStorage (this is just for display, actual scores are server-validated)
    useEffect(() => {
        const saved = localStorage.getItem("footballTap_highScore")
        if (saved) setHighScore(parseInt(saved, 10))
    }, [])

    // Load images
    useEffect(() => {
        const loadImages = async () => {
            const backgroundImg = new Image()
            const ballImg = new Image()
            
            backgroundImg.src = '/football/images/background.jpg'
            ballImg.src = '/football/images/ball.png'
            
            await Promise.all([
                new Promise((resolve) => {
                    backgroundImg.onload = resolve
                }),
                new Promise((resolve) => {
                    ballImg.onload = resolve
                })
            ])
            
            backgroundImageRef.current = backgroundImg
            ballImageRef.current = ballImg
            setImagesLoaded(true)
        }
        
        loadImages()
    }, [])

    // Draw the soccer ball
    const drawBall = useCallback((ctx: CanvasRenderingContext2D, ball: Ball) => {
        if (!ballImageRef.current) return
        
        ctx.save()
        ctx.translate(ball.x, ball.y)
        ctx.rotate(ball.rotation)
        
        // Create circular clipping path for perfect circle
        ctx.beginPath()
        ctx.arc(0, 0, ball.radius, 0, Math.PI * 2)
        ctx.clip()
        
        const size = ball.radius * 2
        ctx.drawImage(
            ballImageRef.current,
            -ball.radius,
            -ball.radius,
            size,
            size
        )
        
        ctx.restore()
    }, [])

    // Draw emoji feedback
    const drawEmojiFeedback = useCallback((ctx: CanvasRenderingContext2D) => {
        const arr = emojiFeedbackRef.current
        for (let i = 0; i < arr.length; i++) {
            const emoji = arr[i]
            ctx.save()
            ctx.globalAlpha = emoji.opacity
            ctx.font = '30px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(emoji.emoji, emoji.x, emoji.y)
            ctx.restore()
        }
    }, [])

    // Game loop
    const gameLoop = useCallback((timestamp: number) => {
        if (!canvasRef.current || !ballRef.current || gameState !== "playing") return

        const ctx = canvasRef.current.getContext("2d")
        if (!ctx) return

        const frameMs = 1000 / 60
        // deltaTime clamped to avoid spiral of death on tab switch or long frames
        let deltaTime = Math.min(200, Math.max(0, timestamp - lastTimeRef.current))
        lastTimeRef.current = timestamp

        // fixed timestep accumulator
        accumulatorRef.current += deltaTime

        const ball = ballRef.current

        while (accumulatorRef.current >= frameMs) {
            // Step physics once using original per-frame logic
            if (gameStarted) {
                ball.vy += GRAVITY
            }
            ball.vx *= FRICTION
            ball.x += ball.vx
            ball.y += ball.vy
            ball.rotation += ball.vx * 0.02

            // Wall bounces
            if (ball.x - ball.radius < 0) {
                ball.x = ball.radius
                ball.vx = Math.abs(ball.vx) * 0.8
            }
            if (ball.x + ball.radius > canvasSize.width) {
                ball.x = canvasSize.width - ball.radius
                ball.vx = -Math.abs(ball.vx) * 0.8
            }

            accumulatorRef.current -= frameMs
        }

        // Check if ball fell off screen (after physics updates)
        if (ball.y - ball.radius > canvasSize.height) {
            playGameOverSound()
            setGameState("gameover")

            // Verify and save score
            endGame().then((result) => {
                if (result?.verified && result.finalScore > highScore) {
                    setHighScore(result.finalScore)
                    localStorage.setItem("footballTap_highScore", result.finalScore.toString())
                }
            })
            return
        }

        // Clear and redraw
        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)
        
        // Draw background
        if (backgroundImageRef.current) {
            ctx.drawImage(backgroundImageRef.current, 0, 0, canvasSize.width, canvasSize.height)
        }
        
        drawBall(ctx, ball)
        updateEmojiFeedback()
        drawEmojiFeedback(ctx)

        animationRef.current = requestAnimationFrame(gameLoop)
    }, [gameState, canvasSize, drawBall, playGameOverSound, endGame, highScore, gameStarted, updateEmojiFeedback, drawEmojiFeedback])

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

    // Initialize ball
    const initBall = useCallback(() => {
        ballRef.current = {
            x: canvasSize.width / 2,
            y: canvasSize.height - BALL_RADIUS - 20, // Bottom center with some padding
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS,
            rotation: 0,
        }
        setGameStarted(false) // Reset game started flag
    }, [canvasSize])

    // Handle tap/click on ball
    const handleTap = useCallback(async (clientX: number, clientY: number) => {
        if (gameState !== "playing" || !ballRef.current || !canvasRef.current) return

        const rect = canvasRef.current.getBoundingClientRect()
        const x = clientX - rect.left
        const y = clientY - rect.top

        const ball = ballRef.current
        const distance = Math.sqrt((x - ball.x) ** 2 + (y - ball.y) ** 2)

        // Check if tap is on the ball
        if (distance <= ball.radius * 1.3) {
            // Good emoji - tapped the ball
            const randomGoodEmoji = goodEmojis[Math.floor(Math.random() * goodEmojis.length)]
            showEmojiFeedback(randomGoodEmoji, ball.x, ball.y - ball.radius - 30)

            // Record action with server
            await recordAction("tap")

            // Start the game on first tap
            if (!gameStarted) {
                setGameStarted(true)
            }

            // Apply bounce physics
            ball.vy = BOUNCE_VELOCITY

            // Calculate horizontal direction based on tap position
            const tapOffsetX = x - ball.x
            ball.vx = -tapOffsetX * 0.15 + (Math.random() - 0.5) * HORIZONTAL_BOUNCE

            playKickSound()
            setScore(prev => prev + 1)
        } else {
            // Bad emoji - missed the ball
            const randomBadEmoji = badEmojis[Math.floor(Math.random() * badEmojis.length)]
            showEmojiFeedback(randomBadEmoji, x, y)
        }
    }, [gameState, recordAction, playKickSound, gameStarted, showEmojiFeedback, goodEmojis, badEmojis])

    // Start new game
    const handleStart = useCallback(async () => {
        await startGame("football-tap")
        initBall()
        setScore(0)
        setGameState("playing")
        setGameStarted(false)
        emojiFeedbackRef.current = [] // Clear emoji feedback
    }, [startGame, initBall])

    // Handle canvas interactions
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        // Ignore synthetic click after touch on mobile
        if (lastInputWasTouchRef.current) return
        handleTap(e.clientX, e.clientY)
    }

    const handleCanvasTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        const touch = e.touches[0]
        lastInputWasTouchRef.current = true
        // reset after short delay to allow click suppression
        setTimeout(() => { lastInputWasTouchRef.current = false }, 500)
        handleTap(touch.clientX, touch.clientY)
    }

    // Draw initial state
    useEffect(() => {
        if (!canvasRef.current || canvasSize.width === 0 || !imagesLoaded) return

        const ctx = canvasRef.current.getContext("2d")
        if (!ctx) return

        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

        // Draw background
        if (backgroundImageRef.current) {
            ctx.drawImage(backgroundImageRef.current, 0, 0, canvasSize.width, canvasSize.height)
        }

        if (gameState === "idle" || gameState === "gameover") {
            // Draw static ball at bottom center
            const staticBall: Ball = {
                x: canvasSize.width / 2,
                y: canvasSize.height - BALL_RADIUS - 20,
                vx: 0,
                vy: 0,
                radius: BALL_RADIUS,
                rotation: 0,
            }
            drawBall(ctx, staticBall)
        }
        
        // Draw emoji feedback
        drawEmojiFeedback(ctx)
    }, [canvasSize, gameState, drawBall, imagesLoaded, drawEmojiFeedback])

    return (
        <div 
            className="min-h-screen flex flex-col"
            style={{
                backgroundImage: `url('/football/images/banner.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            }}
        >
            {/* Header */}
            <header className="flex items-center justify-between p-4">
                <Link href="/">
                    <Button variant="ghost" size="icon" className="text-gray-800 hover:bg-gray-100">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                </Link>

                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="text-gray-800 hover:bg-gray-100"
                    >
                        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </Button>

                    <div className="text-right">
                        <p className="text-sm text-gray-500 font-medium">High Score</p>
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <span className="font-bold text-gray-800">{highScore}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Game Area */}
            <div className="flex-1 flex flex-col items-center justify-center relative">
                {/* Score Display */}
                {gameState === "playing" && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
                        <span className="text-8xl font-bold text-gray-300 select-none">{score}</span>
                    </div>
                )}

                {/* Canvas */}
                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    onClick={handleCanvasClick}
                    onTouchStart={handleCanvasTouch}
                    className="touch-none cursor-pointer"
                />

                {/* Start Screen */}
                {gameState === "idle" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                        <h1 className="text-4xl font-bold text-gray-800 mb-2">Football Tap</h1>
                        <p className="text-gray-500 mb-8">Tap the ball to keep it in the air!</p>
                        <Button
                            onClick={handleStart}
                            size="lg"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 px-8"
                        >
                            <Play className="w-5 h-5" />
                            Start Game
                        </Button>
                    </div>
                )}

                {/* Game Over Screen */}
                {gameState === "gameover" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
                        <h2 className="text-3xl font-bold text-gray-800 mb-2">Game Over!</h2>

                        <p className="text-6xl font-bold text-emerald-500 mb-2">{score}</p>
                        <p className="text-gray-500 mb-8">
                            {score > highScore ? "New High Score!" : `Best: ${highScore}`}
                        </p>

                        <Button
                            onClick={handleStart}
                            size="lg"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 px-8"
                        >
                            <RotateCcw className="w-5 h-5" />
                            Play Again
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
