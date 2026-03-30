"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useGameEndEmitter } from "@/hooks/use-game-events"

const ASSETS = {
  plane: "/flappy_plane/images/plane.png",
  pipe: "/flappy_plane/images/pipe.png",
  pipeUp: "/flappy_plane/images/pipe-up.png",
  pipeDown: "/flappy_plane/images/pipe-down.png",
  sky: "/flappy_plane/images/sky.png",
  land: "/flappy_plane/images/land.png",
  ceiling: "/flappy_plane/images/ceiling.png",
  splash: "/flappy_plane/images/splash.png",
  scoreboard: "/flappy_plane/images/scoreboard.png",
  replay: "/flappy_plane/images/replay.png",
  explosion: "/flappy_plane/images/explosion.png",
  fontBig0: "/flappy_plane/images/font_big_0.png",
  fontBig2: "/flappy_plane/images/font_big_2.png",
  fontSmall0: "/flappy_plane/images/font_small_0.png",
  fontSmall1: "/flappy_plane/images/font_small_1.png",
  fontSmall7: "/flappy_plane/images/font_small_7.png",
}

// Game constants
const GRAVITY = 0.145
const FLAP_POWER = -3.5
const PIPE_SPEED = 3.2
const PIPE_GAP = 88
const PIPE_WIDTH = 52
const PIPE_TIP_HEIGHT = 26
const PIPE_SPAWN_RATE = 115 // frames between pipe spawns
const LAND_HEIGHT = 80
const GROUND_DEPTH = 150 // extra ground below the land
const CEILING_HEIGHT = 24 // natural height of the ceiling image
const CEILING_POSITION = 1 / 4 // ceiling sits at 1/3 down the screen
const PLANE_WIDTH = 115
const PLANE_HEIGHT = 20

interface Pipe {
  x: number
  topHeight: number
  scored: boolean
}

type GameState = "splash" | "playing" | "gameover"

export function FlappyPlaneGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const imagesRef = useRef<Record<string, HTMLImageElement>>({})
  const imagesLoadedRef = useRef(false)

  const gameStateRef = useRef<GameState>("splash")
  const [gameState, setGameState] = useState<GameState>("splash")

  const planeRef = useRef({ x: 0, y: 0, vy: 0, rotation: 0 })
  const pipesRef = useRef<Pipe[]>([])
  const frameCountRef = useRef(0)
  const scoreRef = useRef(0)
  const highScoreRef = useRef(0)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)

  const landOffsetRef = useRef(0)
  const ceilOffsetRef = useRef(0)
  const skyOffsetRef = useRef(0)
  const skyTopColorRef = useRef("#3162B1")
  const explosionRef = useRef({ x: 0, y: 0, opacity: 0, active: false })
  const crashTimeRef = useRef(0)
  const bgFadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bgFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sound refs
  const swooshSoundRef = useRef<HTMLAudioElement | null>(null)
  const explosionSoundRef = useRef<HTMLAudioElement | null>(null)
  const bgMusicRef = useRef<HTMLAudioElement | null>(null)

  const { emitGameEnd, resetEmitter } = useGameEndEmitter()

  // Load all images
  useEffect(() => {
    let loaded = 0
    const total = Object.keys(ASSETS).length
    for (const [key, src] of Object.entries(ASSETS)) {
      const img = new Image()
      img.src = src
      img.onload = () => {
        loaded++
        // Sample top pixel of sky image for gradient blending
        if (key === "sky") {
          try {
            const tmpCanvas = document.createElement("canvas")
            tmpCanvas.width = img.naturalWidth
            tmpCanvas.height = img.naturalHeight
            const tmpCtx = tmpCanvas.getContext("2d")
            if (tmpCtx) {
              tmpCtx.drawImage(img, 0, 0)
              const pixel = tmpCtx.getImageData(Math.floor(img.naturalWidth / 2), 0, 1, 1).data
              skyTopColorRef.current = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`
            }
          } catch (_) { /* cross-origin fallback */ }
        }
        if (loaded === total) {
          imagesLoadedRef.current = true
        }
      }
      imagesRef.current[key] = img
    }

    // Load high score from localStorage
    const saved = localStorage.getItem("flappy-plane-highscore")
    if (saved) {
      highScoreRef.current = parseInt(saved, 10)
      setHighScore(highScoreRef.current)
    }

    // Load sounds
    swooshSoundRef.current = new Audio("/flappy_plane/sounds/swoosh.wav")
    explosionSoundRef.current = new Audio("/flappy_plane/sounds/allahuAkbar.wav")
    bgMusicRef.current = new Audio("/flappy_plane/sounds/saleelul.mp3")
    bgMusicRef.current.loop = true
    bgMusicRef.current.volume = 0.4

    return () => {
      bgMusicRef.current?.pause()
      bgMusicRef.current = null
    }
  }, [])

  const getCanvasSize = useCallback(() => { 
    const w = Math.min(window.innerWidth, 700)
    const h = window.innerHeight
    return { width: w, height: h }
  }, [])

  // Setup canvas and resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const { width, height } = getCanvasSize()
      canvas.width = width
      canvas.height = height
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [getCanvasSize])

  const resetGame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const cx = canvas.width * 0.15
    const ceilTop = Math.floor(canvas.height * CEILING_POSITION)
    const playAreaMid = ceilTop + CEILING_HEIGHT + (canvas.height - ceilTop - CEILING_HEIGHT - LAND_HEIGHT - GROUND_DEPTH) / 2
    const cy = playAreaMid

    planeRef.current = { x: cx, y: cy, vy: 0, rotation: 0 }
    pipesRef.current = []
    frameCountRef.current = 0
    scoreRef.current = 0
    setScore(0)
    landOffsetRef.current = 0
    ceilOffsetRef.current = 0
    skyOffsetRef.current = 0
    explosionRef.current = { x: 0, y: 0, opacity: 0, active: false }
    crashTimeRef.current = 0
  }, [])

  const flap = useCallback(() => {
    if (gameStateRef.current === "gameover") return

    if (gameStateRef.current === "splash") {
      resetGame()
      gameStateRef.current = "playing"
      setGameState("playing")
      resetEmitter()
      // Start background music
      if (bgMusicRef.current) {
        // Clear any ongoing fade-out from previous game
        if (bgFadeTimeoutRef.current) {
          clearTimeout(bgFadeTimeoutRef.current)
          bgFadeTimeoutRef.current = null
        }
        if (bgFadeIntervalRef.current) {
          clearInterval(bgFadeIntervalRef.current)
          bgFadeIntervalRef.current = null
        }
        bgMusicRef.current.volume = 0.4
        bgMusicRef.current.currentTime = 0
        bgMusicRef.current.play().catch(() => {})
      }
    }

    // Play swoosh sound
    if (swooshSoundRef.current) {
      swooshSoundRef.current.currentTime = 0
      swooshSoundRef.current.play().catch(() => {})
    }

    planeRef.current.vy = FLAP_POWER
  }, [resetGame, resetEmitter])

  const restartFromGameOver = useCallback(() => {
    resetGame()
    gameStateRef.current = "splash"
    setGameState("splash")
  }, [resetGame])

  // Input handlers
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handlePointerDown = (e: PointerEvent | TouchEvent) => {
      e.preventDefault()
      if (gameStateRef.current === "gameover") {
        // Block input during 2s crash delay
        if (Date.now() - crashTimeRef.current < 2000) return
        restartFromGameOver()
      } else {
        flap()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault()
        if (gameStateRef.current === "gameover") {
          // Block input during 2s crash delay
          if (Date.now() - crashTimeRef.current < 2000) return
          restartFromGameOver()
        } else {
          flap()
        }
      }
    }

    canvas.addEventListener("pointerdown", handlePointerDown)
    canvas.addEventListener("touchstart", handlePointerDown, { passive: false })
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown)
      canvas.removeEventListener("touchstart", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [flap, restartFromGameOver])

  // Check collision
  const checkCollision = useCallback((canvas: HTMLCanvasElement) => {
    const plane = planeRef.current
    const planeLeft = plane.x - PLANE_WIDTH / 2
    const planeRight = plane.x + PLANE_WIDTH / 2
    const planeTop = plane.y - PLANE_HEIGHT / 2
    const planeBottom = plane.y + PLANE_HEIGHT / 2

    // Ground & ceiling (play boundary is bottom of ceiling at 1/3 + CEILING_HEIGHT)
    const ceilBottom = Math.floor(canvas.height * CEILING_POSITION) + CEILING_HEIGHT
    if (planeBottom >= canvas.height - LAND_HEIGHT - GROUND_DEPTH || planeTop <= ceilBottom) {
      return true
    }

    // Pipes
    for (const pipe of pipesRef.current) {
      const pipeLeft = pipe.x
      const pipeRight = pipe.x + PIPE_WIDTH

      if (planeRight > pipeLeft + 5 && planeLeft < pipeRight - 5) {
        const topPipeBottom = pipe.topHeight
        const bottomPipeTop = pipe.topHeight + PIPE_GAP

        if (planeTop < topPipeBottom + 3 || planeBottom > bottomPipeTop - 3) {
          return true
        }
      }
    }

    return false
  }, [])

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const gameLoop = () => {
      animationRef.current = requestAnimationFrame(gameLoop)

      if (!imagesLoadedRef.current) return

      const { width, height } = canvas
      const imgs = imagesRef.current

      // Clear
      ctx.clearRect(0, 0, width, height)

      // Draw sky (scrolling, bottom-aligned above land/ground)
      const skyImg = imgs.sky
      if (skyImg && skyImg.naturalWidth > 0) {
        const scaledW = width
        const scaledH = skyImg.naturalHeight
        const skyBottom = height - LAND_HEIGHT - GROUND_DEPTH
        const skyY = skyBottom - scaledH
        // Fill area above the sky image with gradient blending into sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, Math.max(skyY, 0))
        skyGrad.addColorStop(0, "#3162B1")
        skyGrad.addColorStop(1, skyTopColorRef.current)
        ctx.fillStyle = skyGrad
        ctx.fillRect(0, 0, width, Math.max(skyY, 0))
        // Fill cyan below sky image if needed (land/ground drawn later)
        const offset = skyOffsetRef.current % scaledW
        for (let sx = -offset; sx < width; sx += scaledW) {
          ctx.drawImage(skyImg, sx, skyY, scaledW, scaledH)
        }
      } else {
        const fallbackGrad = ctx.createLinearGradient(0, 0, 0, height)
        fallbackGrad.addColorStop(0, "#3162B1")
        fallbackGrad.addColorStop(1, "#415D98")
        ctx.fillStyle = fallbackGrad
        ctx.fillRect(0, 0, width, height)
      }

      const state = gameStateRef.current

      if (state === "playing") {
        // Update plane physics
        planeRef.current.vy += GRAVITY
        planeRef.current.y += planeRef.current.vy

        // Rotation based on velocity
        const targetRotation = Math.min(Math.max(planeRef.current.vy * 4, -30), 70)
        planeRef.current.rotation += (targetRotation - planeRef.current.rotation) * 0.15

        // Spawn pipes
        frameCountRef.current++
        const ceilBottom = Math.floor(height * CEILING_POSITION) + CEILING_HEIGHT
        if (frameCountRef.current % PIPE_SPAWN_RATE === 0) {
          const minTop = ceilBottom + 80
          const maxTop = height - LAND_HEIGHT - GROUND_DEPTH - PIPE_GAP - 80
          const topHeight = minTop + Math.random() * (maxTop - minTop)
          pipesRef.current.push({ x: width, topHeight, scored: false })
        }

        // Move pipes
        for (const pipe of pipesRef.current) {
          pipe.x -= PIPE_SPEED

          // Score
          if (!pipe.scored && pipe.x + PIPE_WIDTH < planeRef.current.x) {
            pipe.scored = true
            scoreRef.current++
            setScore(scoreRef.current)
          }
        }

        // Remove off-screen pipes
        pipesRef.current = pipesRef.current.filter((p) => p.x + PIPE_WIDTH > -10)

        // Scroll land + ceiling + sky
        landOffsetRef.current = (landOffsetRef.current + PIPE_SPEED) % width
        ceilOffsetRef.current = (ceilOffsetRef.current + PIPE_SPEED) % width
        skyOffsetRef.current += PIPE_SPEED * 0.3

        // Check collision
        if (checkCollision(canvas)) {
          gameStateRef.current = "gameover"
          setGameState("gameover")
          explosionRef.current = {
            x: planeRef.current.x,
            y: planeRef.current.y,
            opacity: 0,
            active: true,
          }
          crashTimeRef.current = Date.now()
          // Play explosion sound
          if (explosionSoundRef.current) {
            explosionSoundRef.current.currentTime = 0
            explosionSoundRef.current.play().catch(() => {})
          }
          // Fade out background music after a few seconds
          if (bgMusicRef.current) {
            const music = bgMusicRef.current
            bgFadeTimeoutRef.current = setTimeout(() => {
              bgFadeIntervalRef.current = setInterval(() => {
                if (music.volume > 0.05) {
                  music.volume = Math.max(music.volume - 0.05, 0)
                } else {
                  music.pause()
                  music.volume = 0.4
                  if (bgFadeIntervalRef.current) {
                    clearInterval(bgFadeIntervalRef.current)
                    bgFadeIntervalRef.current = null
                  }
                }
              }, 100)
            }, 3000)
          }
          if (scoreRef.current > highScoreRef.current) {
            highScoreRef.current = scoreRef.current
            setHighScore(highScoreRef.current)
            localStorage.setItem("flappy-plane-highscore", String(highScoreRef.current))
          }
          emitGameEnd("flappy-plane", scoreRef.current)
        }
      }

      // Draw pipes
      const pipeBodyImg = imgs.pipe
      const pipeUpTipImg = imgs.pipeUp
      const pipeDownTipImg = imgs.pipeDown
      const pipeCeilBottom = Math.floor(height * CEILING_POSITION) + CEILING_HEIGHT

      for (const pipe of pipesRef.current) {
        // --- Top pipe (hangs down from ceiling bottom) ---
        const topPipeStart = pipeCeilBottom
        const topTipY = pipe.topHeight - PIPE_TIP_HEIGHT
        const topPipeBodyH = topTipY - topPipeStart
        if (pipeBodyImg && pipeBodyImg.naturalWidth > 0 && topPipeBodyH > 0) {
          ctx.drawImage(pipeBodyImg, pipe.x, topPipeStart, PIPE_WIDTH, topPipeBodyH)
        } else if (topPipeBodyH > 0) {
          ctx.fillStyle = "#73bf2e"
          ctx.fillRect(pipe.x, topPipeStart, PIPE_WIDTH, topPipeBodyH)
        }
        // Draw tip (bottom of top pipe)
        if (pipeDownTipImg && pipeDownTipImg.naturalWidth > 0) {
          ctx.drawImage(pipeDownTipImg, pipe.x - 3, pipe.topHeight - PIPE_TIP_HEIGHT, PIPE_WIDTH + 6, PIPE_TIP_HEIGHT)
        }

        // --- Bottom pipe ---
        const bottomY = pipe.topHeight + PIPE_GAP
        const bottomH = height - bottomY - LAND_HEIGHT - GROUND_DEPTH
        // Draw tip (top of bottom pipe)
        if (pipeUpTipImg && pipeUpTipImg.naturalWidth > 0) {
          ctx.drawImage(pipeUpTipImg, pipe.x - 3, bottomY, PIPE_WIDTH + 6, PIPE_TIP_HEIGHT)
        }
        // Draw body below tip
        const bodyStartY = bottomY + PIPE_TIP_HEIGHT
        const bodyH = bottomH - PIPE_TIP_HEIGHT
        if (pipeBodyImg && pipeBodyImg.naturalWidth > 0 && bodyH > 0) {
          ctx.drawImage(pipeBodyImg, pipe.x, bodyStartY, PIPE_WIDTH, bodyH)
        } else if (bodyH > 0) {
          ctx.fillStyle = "#73bf2e"
          ctx.fillRect(pipe.x, bodyStartY, PIPE_WIDTH, bodyH)
        }
      }

      // Draw ground below land
      ctx.fillStyle = "#8B6914"
      ctx.fillRect(0, height - GROUND_DEPTH, width, GROUND_DEPTH)

      // Draw land (scrolling)
      const landImg = imgs.land
      if (landImg && landImg.naturalWidth > 0) {
        const landW = landImg.naturalWidth
        const landScale = LAND_HEIGHT / landImg.naturalHeight
        const scaledLandW = landW * landScale
        for (let lx = -landOffsetRef.current; lx < width; lx += scaledLandW) {
          ctx.drawImage(landImg, lx, height - LAND_HEIGHT - GROUND_DEPTH, scaledLandW, LAND_HEIGHT)
        }
      } else {
        ctx.fillStyle = "#ded895"
        ctx.fillRect(0, height - LAND_HEIGHT - GROUND_DEPTH, width, LAND_HEIGHT)
      }

      // Draw ceiling (scrolling) — positioned at 1/3 of screen
      const ceilY = Math.floor(height * CEILING_POSITION)
      const ceilImg = imgs.ceiling
      if (ceilImg && ceilImg.naturalWidth > 0) {
        const ceilW = ceilImg.naturalWidth
        const ceilScale = CEILING_HEIGHT / ceilImg.naturalHeight
        const scaledCeilW = ceilW * ceilScale
        for (let cx2 = -ceilOffsetRef.current; cx2 < width; cx2 += scaledCeilW) {
          ctx.drawImage(ceilImg, cx2, ceilY, scaledCeilW, CEILING_HEIGHT)
        }
      } else {
        ctx.fillStyle = "#333"
        ctx.fillRect(0, ceilY, width, CEILING_HEIGHT)
      }

      // Draw plane
      const planeImg = imgs.plane
      const plane = planeRef.current
      if (planeImg && planeImg.naturalWidth > 0) {
        ctx.save()
        ctx.translate(plane.x, plane.y)
        ctx.rotate((plane.rotation * Math.PI) / 180)
        ctx.drawImage(planeImg, -PLANE_WIDTH / 2, -PLANE_HEIGHT / 2, PLANE_WIDTH, PLANE_HEIGHT)
        ctx.restore()
      } else {
        ctx.save()
        ctx.translate(plane.x, plane.y)
        ctx.rotate((plane.rotation * Math.PI) / 180)
        ctx.fillStyle = "#e74c3c"
        ctx.fillRect(-PLANE_WIDTH / 2, -PLANE_HEIGHT / 2, PLANE_WIDTH, PLANE_HEIGHT)
        ctx.restore()
      }

      // Draw score (during playing)
      if (state === "playing") {
        drawScore(ctx, scoreRef.current, width)
      }

      // Draw splash screen
      if (state === "splash") {
        // Floating plane animation in the play area
        const splashCeilBottom = Math.floor(height * CEILING_POSITION) + CEILING_HEIGHT
        const playMid = splashCeilBottom + (height - splashCeilBottom - LAND_HEIGHT - GROUND_DEPTH) / 2
        const floatY = Math.sin(Date.now() / 300) * 8
        planeRef.current.y = playMid + floatY
        planeRef.current.rotation = Math.sin(Date.now() / 500) * 5

        // Draw splash image
        const splashImg = imgs.splash
        if (splashImg && splashImg.naturalWidth > 0) {
          const splashScale = Math.min(width * 0.6 / splashImg.naturalWidth, 1)
          const sw = splashImg.naturalWidth * splashScale
          const sh = splashImg.naturalHeight * splashScale
          ctx.drawImage(splashImg, (width - sw) / 2, height * 0.2, sw, sh)
        } else {
          // Fallback text
          ctx.fillStyle = "#fff"
          ctx.strokeStyle = "#543847"
          ctx.lineWidth = 4
          ctx.font = "bold 42px Arial"
          ctx.textAlign = "center"
          const title = "Flappy Plane"
          ctx.strokeText(title, width / 2, height * 0.25)
          ctx.fillText(title, width / 2, height * 0.25)
        }

        // "Tap to start" text
        const alpha = 0.5 + 0.5 * Math.sin(Date.now() / 400)
        ctx.globalAlpha = alpha
        ctx.fillStyle = "#fff"
        ctx.strokeStyle = "#543847"
        ctx.lineWidth = 3
        ctx.font = "bold 22px Arial"
        ctx.textAlign = "center"
        ctx.strokeText("Tap to Start", width / 2, height * 0.65)
        ctx.fillText("Tap to Start", width / 2, height * 0.65)
        ctx.globalAlpha = 1
      }

      // Draw explosion on crash
      if (state === "gameover" && explosionRef.current.active) {
        const exp = explosionRef.current
        // Fade in over time
        exp.opacity = Math.min(exp.opacity + 0.04, 1)
        const explosionImg = imgs.explosion
        ctx.save()
        ctx.globalAlpha = exp.opacity
        if (explosionImg && explosionImg.naturalWidth > 0) {
          const expSize = 120
          ctx.drawImage(explosionImg, exp.x - expSize / 2, exp.y - expSize / 2, expSize, expSize)
        } else {
          // Fallback: orange circle
          ctx.fillStyle = "#ff6600"
          ctx.beginPath()
          ctx.arc(exp.x, exp.y, 50, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      // Draw game over screen (delayed 2 seconds after crash)
      if (state === "gameover" && Date.now() - crashTimeRef.current >= 2000) {
        // Darken overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)"
        ctx.fillRect(0, 0, width, height)

        // Scoreboard
        const sbImg = imgs.scoreboard
        if (sbImg && sbImg.naturalWidth > 0) {
          const sbScale = Math.min(width * 0.75 / sbImg.naturalWidth, 1.2)
          const sbW = sbImg.naturalWidth * sbScale
          const sbH = sbImg.naturalHeight * sbScale
          const sbX = (width - sbW) / 2
          const sbY = height * 0.25
          ctx.drawImage(sbImg, sbX, sbY, sbW, sbH)

          // Score on scoreboard
          ctx.fillStyle = "#fff"
          ctx.strokeStyle = "#000000"
          ctx.lineWidth = 5
          ctx.font = "bold 20px Arial"
          ctx.textAlign = "right"
          const scoreX = sbX + sbW - 34
          ctx.strokeText(String(scoreRef.current), scoreX, sbY + sbH * 0.46 - 12)
          ctx.fillText(String(scoreRef.current), scoreX, sbY + sbH * 0.46 - 12)

          // Best score
          ctx.font = "bold 20px Arial"
          ctx.strokeText(String(highScoreRef.current), scoreX, sbY + sbH * 0.68 - 33)
          ctx.fillText(String(highScoreRef.current), scoreX, sbY + sbH * 0.68 - 33)
        } else {
          // Fallback scoreboard
          ctx.fillStyle = "rgba(222, 216, 149, 0.95)"
          const boardW = width * 0.75
          const boardH = 180
          const boardX = (width - boardW) / 2
          const boardY = height * 0.25
          ctx.beginPath()
          ctx.roundRect(boardX, boardY, boardW, boardH, 12)
          ctx.fill()
          ctx.strokeStyle = "#543847"
          ctx.lineWidth = 3
          ctx.stroke()

          ctx.fillStyle = "#543847"
          ctx.font = "bold 32px Arial"
          ctx.textAlign = "center"
          ctx.fillText("Game Over", width / 2, boardY + 40)

          ctx.font = "bold 20px Arial"
          ctx.textAlign = "left"
          ctx.fillText("Score:", boardX + 20, boardY + 80)
          ctx.fillText("Best:", boardX + 20, boardY + 115)

          ctx.textAlign = "right"
          ctx.fillText(String(scoreRef.current), boardX + boardW - 20, boardY + 80)
          ctx.fillText(String(highScoreRef.current), boardX + boardW - 20, boardY + 115)
        }

        // Replay button
        const replayImg = imgs.replay
        if (replayImg && replayImg.naturalWidth > 0) {
          const rScale = 0.8
          const rW = replayImg.naturalWidth * rScale
          const rH = replayImg.naturalHeight * rScale
          ctx.drawImage(replayImg, (width - rW) / 2, height * 0.58, rW, rH)
        } else {
          // Fallback replay button
          ctx.fillStyle = "#73bf2e"
          const bw = 140
          const bh = 50
          const bx = (width - bw) / 2
          const by = height * 0.58
          ctx.beginPath()
          ctx.roundRect(bx, by, bw, bh, 8)
          ctx.fill()
          ctx.fillStyle = "#fff"
          ctx.font = "bold 22px Arial"
          ctx.textAlign = "center"
          ctx.fillText("Tap to Retry", width / 2, by + 33)
        }
      }
    }

    animationRef.current = requestAnimationFrame(gameLoop)
    return () => cancelAnimationFrame(animationRef.current)
  }, [checkCollision, emitGameEnd])

  return (
    <div className="w-full h-screen flex items-center justify-center bg-black overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="block touch-none"
        style={{ maxWidth: "500px", width: "100%", height: "100vh" }}
      />
    </div>
  )
}

// Draw score with outlined text at top center
function drawScore(ctx: CanvasRenderingContext2D, score: number, canvasWidth: number) {
  ctx.save()
  ctx.fillStyle = "#fff"
  ctx.strokeStyle = "#543847"
  ctx.lineWidth = 4
  ctx.font = "bold 48px Arial"
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  ctx.strokeText(String(score), canvasWidth / 2, 40)
  ctx.fillText(String(score), canvasWidth / 2, 40)
  ctx.restore()
}
