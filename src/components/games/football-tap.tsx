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

type GameState = "idle" | "playing" | "gameover"

export function FootballTapGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ballRef = useRef<Ball | null>(null)
    const animationRef = useRef<number>(0)
    const lastTimeRef = useRef<number>(0)

    const [gameState, setGameState] = useState<GameState>("idle")
    const [score, setScore] = useState(0)
    const [highScore, setHighScore] = useState(0)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

    const { session, cheatingDetected, startGame, recordAction, endGame } = useGameSession()

    const audioContextRef = useRef<AudioContext | null>(null)

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

    // Handle canvas resize
    useEffect(() => {
        const updateSize = () => {
            const width = Math.min(window.innerWidth, 500)
            const height = Math.min(window.innerHeight - 100, 700)
            setCanvasSize({ width, height })
        }

        updateSize()
        window.addEventListener("resize", updateSize)
        return () => window.removeEventListener("resize", updateSize)
    }, [])

    // Load high score from localStorage (this is just for display, actual scores are server-validated)
    useEffect(() => {
        const saved = localStorage.getItem("footballTap_highScore")
        if (saved) setHighScore(parseInt(saved, 10))
    }, [])

    // Draw the soccer ball
    const drawBall = useCallback((ctx: CanvasRenderingContext2D, ball: Ball) => {
        ctx.save()
        ctx.translate(ball.x, ball.y)
        ctx.rotate(ball.rotation)

        // Ball base (white)
        ctx.beginPath()
        ctx.arc(0, 0, ball.radius, 0, Math.PI * 2)
        ctx.fillStyle = "#ffffff"
        ctx.fill()
        ctx.strokeStyle = "#333333"
        ctx.lineWidth = 2
        ctx.stroke()

        // Pentagon pattern
        const pentagonAngles = [0, 72, 144, 216, 288].map(a => (a * Math.PI) / 180)

        // Center pentagon
        ctx.beginPath()
        const centerSize = ball.radius * 0.35
        pentagonAngles.forEach((angle, i) => {
            const x = Math.cos(angle - Math.PI / 2) * centerSize
            const y = Math.sin(angle - Math.PI / 2) * centerSize
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.fillStyle = "#1a1a1a"
        ctx.fill()

        // Outer pentagons
        pentagonAngles.forEach((angle) => {
            const px = Math.cos(angle - Math.PI / 2) * ball.radius * 0.7
            const py = Math.sin(angle - Math.PI / 2) * ball.radius * 0.7

            ctx.beginPath()
            const outerSize = ball.radius * 0.25
            for (let i = 0; i < 5; i++) {
                const a = angle + (i * 72 * Math.PI) / 180
                const x = px + Math.cos(a - Math.PI / 2) * outerSize
                const y = py + Math.sin(a - Math.PI / 2) * outerSize
                if (i === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
            }
            ctx.closePath()
            ctx.fillStyle = "#1a1a1a"
            ctx.fill()
        })

        // Highlight for 3D effect
        ctx.beginPath()
        ctx.arc(-ball.radius * 0.3, -ball.radius * 0.3, ball.radius * 0.2, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
        ctx.fill()

        ctx.restore()
    }, [])

    // Game loop
    const gameLoop = useCallback((timestamp: number) => {
        if (!canvasRef.current || !ballRef.current || gameState !== "playing") return

        const ctx = canvasRef.current.getContext("2d")
        if (!ctx) return

        const deltaTime = timestamp - lastTimeRef.current
        lastTimeRef.current = timestamp

        const ball = ballRef.current

        // Apply physics
        ball.vy += GRAVITY
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

        // Check if ball fell off screen
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
        drawBall(ctx, ball)

        animationRef.current = requestAnimationFrame(gameLoop)
    }, [gameState, canvasSize, drawBall, playGameOverSound, endGame, highScore])

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
            y: canvasSize.height / 2,
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS,
            rotation: 0,
        }
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
            // Record action with server
            const success = await recordAction("tap")

            if (!success && cheatingDetected) {
                setGameState("gameover")
                return
            }

            // Apply bounce physics
            ball.vy = BOUNCE_VELOCITY

            // Calculate horizontal direction based on tap position
            const tapOffsetX = x - ball.x
            ball.vx = -tapOffsetX * 0.15 + (Math.random() - 0.5) * HORIZONTAL_BOUNCE

            playKickSound()
            setScore(prev => prev + 1)
        }
    }, [gameState, recordAction, cheatingDetected, playKickSound])

    // Start new game
    const handleStart = useCallback(async () => {
        await startGame("football-tap")
        initBall()
        setScore(0)
        setGameState("playing")
    }, [startGame, initBall])

    // Handle canvas interactions
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        handleTap(e.clientX, e.clientY)
    }

    const handleCanvasTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        const touch = e.touches[0]
        handleTap(touch.clientX, touch.clientY)
    }

    // Draw initial state
    useEffect(() => {
        if (!canvasRef.current || canvasSize.width === 0) return

        const ctx = canvasRef.current.getContext("2d")
        if (!ctx) return

        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

        if (gameState === "idle" || gameState === "gameover") {
            // Draw static ball in center
            const staticBall: Ball = {
                x: canvasSize.width / 2,
                y: canvasSize.height / 2,
                vx: 0,
                vy: 0,
                radius: BALL_RADIUS,
                rotation: 0,
            }
            drawBall(ctx, staticBall)
        }
    }, [canvasSize, gameState, drawBall])

    return (
        <div className="min-h-screen bg-white flex flex-col">
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

                        {cheatingDetected ? (
                            <p className="text-red-500 mb-4">Suspicious activity detected. Score not saved.</p>
                        ) : (
                            <>
                                <p className="text-6xl font-bold text-emerald-500 mb-2">{score}</p>
                                <p className="text-gray-500 mb-8">
                                    {score > highScore ? "New High Score!" : `Best: ${highScore}`}
                                </p>
                            </>
                        )}

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
