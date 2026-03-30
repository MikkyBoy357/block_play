"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useGameEndEmitter } from "@/hooks/use-game-events"

// ─── Types ───────────────────────────────────────────────────────────────────
type Op = "+" | "−" | "×" | "÷"
type Phase = "idle" | "playing" | "correct" | "wrong" | "timeout" | "gameover"

interface Question {
  a: number
  b: number
  op: Op
  answer: number
  choices: number[]
}

// ─── Constants ───────────────────────────────────────────────────────────────
const BASE_TIME = 6000     // 6 seconds for first question
const MIN_TIME = 1800      // floor — never less than 1.8s
const TIME_DECAY = 200     // lose 200ms per question answered
const STREAK_BONUS = 50    // extra points per streak level
const BASE_POINTS = 100
const PERFECT_BONUS = 200  // bonus for answering in < 1.5s
const NUM_CHOICES = 4

// ─── Colors ──────────────────────────────────────────────────────────────────
const BG = "#0d0d0d"
const CARD_BG = "#161616"
const ACCENT = "#f1c40f"
const GREEN = "#2ecc71"
const RED = "#e74c3c"
const BLUE = "#3498db"
const MUTED = "#555"
const TEXT = "#ecf0f1"
const OP_COLORS: Record<Op, string> = { "+": "#2ecc71", "−": "#e74c3c", "×": "#3498db", "÷": "#9b59b6" }

// ─── Audio ───────────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null
function ac(): AudioContext { if (!audioCtx) audioCtx = new AudioContext(); return audioCtx }
function tone(f: number, d: number, t: OscillatorType = "square", v = 0.05) {
  try {
    const c = ac(); const o = c.createOscillator(); const g = c.createGain()
    o.type = t; o.frequency.value = f; g.gain.setValueAtTime(v, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d)
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + d)
  } catch { /* */ }
}
const sndCorrect = () => { tone(523, 0.06, "sine", 0.06); setTimeout(() => tone(659, 0.06, "sine", 0.06), 50); setTimeout(() => tone(784, 0.08, "sine", 0.07), 100) }
const sndWrong = () => { tone(200, 0.15, "sawtooth", 0.06); setTimeout(() => tone(150, 0.2, "sawtooth", 0.05), 100) }
const sndTick = () => { tone(800, 0.02, "square", 0.02) }
const sndGameOver = () => { tone(400, 0.15, "square", 0.06); setTimeout(() => tone(300, 0.15, "square", 0.06), 150); setTimeout(() => tone(200, 0.2, "sawtooth", 0.05), 300) }
const sndPerfect = () => { tone(784, 0.05, "sine", 0.06); setTimeout(() => tone(988, 0.05, "sine", 0.06), 40); setTimeout(() => tone(1175, 0.08, "sine", 0.07), 80) }
const sndStart = () => { tone(440, 0.05, "sine", 0.05); setTimeout(() => tone(554, 0.05, "sine", 0.05), 50); setTimeout(() => tone(659, 0.08, "sine", 0.06), 100) }

// ─── Question Generator ──────────────────────────────────────────────────────
function generateQuestion(qNum: number): Question {
  const difficulty = Math.min(Math.floor(qNum / 3), 15)
  const ops: Op[] = qNum < 3 ? ["+", "−"] : qNum < 8 ? ["+", "−", "×"] : ["+", "−", "×", "÷"]
  const op = ops[Math.floor(Math.random() * ops.length)]

  let a: number, b: number, answer: number

  const maxN = Math.min(12 + difficulty * 8, 150)
  const minN = Math.max(2, 1 + Math.floor(difficulty / 3))

  switch (op) {
    case "+": {
      a = randInt(minN, maxN); b = randInt(minN, maxN)
      answer = a + b; break
    }
    case "−": {
      a = randInt(minN + 5, maxN + 10); b = randInt(minN, Math.min(a, maxN))
      answer = a - b; break
    }
    case "×": {
      const mMax = Math.min(6 + difficulty * 2, 25)
      a = randInt(2, mMax); b = randInt(2, mMax)
      answer = a * b; break
    }
    case "÷": {
      b = randInt(2, Math.min(6 + difficulty, 20))
      answer = randInt(2, Math.min(10 + difficulty * 2, 30))
      a = b * answer; break
    }
    default: a = 1; b = 1; answer = 2
  }

  // Generate wrong choices close to the real answer
  const choices = new Set<number>([answer])
  let attempts = 0
  while (choices.size < NUM_CHOICES && attempts < 100) {
    attempts++
    const offset = randInt(1, Math.max(5, Math.floor(Math.abs(answer) * 0.4) + 3))
    const wrong = answer + (Math.random() < 0.5 ? offset : -offset)
    if (wrong !== answer && wrong >= 0 && !choices.has(wrong)) choices.add(wrong)
  }
  // Fill remaining with random if needed
  while (choices.size < NUM_CHOICES) {
    choices.add(answer + (choices.size * 3) + randInt(1, 10))
  }

  // Shuffle
  const shuffled = [...choices].sort(() => Math.random() - 0.5)

  return { a, b, op, answer, choices: shuffled }
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ─── Component ───────────────────────────────────────────────────────────────
export function MathTeaserGame() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [question, setQuestion] = useState<Question | null>(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [questionNum, setQuestionNum] = useState(0)
  const [timeLeft, setTimeLeft] = useState(1)   // 0..1 ratio
  const [totalTime, setTotalTime] = useState(BASE_TIME)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [lastPoints, setLastPoints] = useState(0)
  const [isPerfect, setIsPerfect] = useState(false)

  const phaseRef = useRef<Phase>("idle")
  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const qNumRef = useRef(0)
  const timerStart = useRef(0)
  const timerDuration = useRef(BASE_TIME)
  const animRef = useRef(0)
  const lastTickRef = useRef(0)

  const { emitGameEnd, resetEmitter } = useGameEndEmitter()

  // ─── High Score ──────────────────────────────────────────────────────────
  useEffect(() => {
    const hs = localStorage.getItem("mathteaser_hs")
    if (hs) setHighScore(+hs)
    const bs = localStorage.getItem("mathteaser_bs")
    if (bs) setBestStreak(+bs)
  }, [])

  // ─── Timer Loop ──────────────────────────────────────────────────────────
  const timerLoop = useCallback((ts: number) => {
    if (phaseRef.current !== "playing") return

    const elapsed = ts - timerStart.current
    const ratio = 1 - elapsed / timerDuration.current
    setTimeLeft(Math.max(0, ratio))

    // Tick sound at low time
    if (ratio < 0.3 && ratio > 0) {
      if (ts - lastTickRef.current > 400) { sndTick(); lastTickRef.current = ts }
    }

    if (ratio <= 0) {
      // Time's up
      phaseRef.current = "timeout"; setPhase("timeout")
      sndWrong()
      setTimeout(() => gameOver(), 1200)
      return
    }

    animRef.current = requestAnimationFrame(timerLoop)
  }, [])

  // ─── Start Game ──────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    scoreRef.current = 0; streakRef.current = 0; qNumRef.current = 0
    setScore(0); setStreak(0); setQuestionNum(0); setSelectedIdx(null); setLastPoints(0); setIsPerfect(false)
    sndStart()
    resetEmitter()
    nextQuestion(0)
  }, [resetEmitter])

  function nextQuestion(qNum: number) {
    const q = generateQuestion(qNum)
    const dur = Math.max(MIN_TIME, BASE_TIME - qNum * TIME_DECAY)
    setQuestion(q); setQuestionNum(qNum); setTotalTime(dur); setTimeLeft(1); setSelectedIdx(null); setIsPerfect(false)
    timerStart.current = performance.now(); timerDuration.current = dur; lastTickRef.current = 0
    phaseRef.current = "playing"; setPhase("playing")
    cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(timerLoop)
  }

  // ─── Answer ──────────────────────────────────────────────────────────────
  function handleAnswer(choiceIdx: number) {
    if (phaseRef.current !== "playing" || !question) return
    cancelAnimationFrame(animRef.current)

    setSelectedIdx(choiceIdx)
    const chosen = question.choices[choiceIdx]

    if (chosen === question.answer) {
      const elapsed = performance.now() - timerStart.current
      const timeRatio = 1 - elapsed / timerDuration.current
      const speedBonus = Math.round(timeRatio * BASE_POINTS)
      const streakBonus = streakRef.current * STREAK_BONUS
      const perfect = elapsed < 1500
      const perfBonus = perfect ? PERFECT_BONUS : 0
      const pts = BASE_POINTS + speedBonus + streakBonus + perfBonus

      scoreRef.current += pts; streakRef.current++
      setScore(scoreRef.current); setStreak(streakRef.current); setLastPoints(pts); setIsPerfect(perfect)
      phaseRef.current = "correct"; setPhase("correct")

      if (perfect) sndPerfect(); else sndCorrect()

      setTimeout(() => {
        qNumRef.current++
        nextQuestion(qNumRef.current)
      }, perfect ? 600 : 400)
    } else {
      phaseRef.current = "wrong"; setPhase("wrong")
      sndWrong()
      setTimeout(() => gameOver(), 1200)
    }
  }

  function gameOver() {
    phaseRef.current = "gameover"; setPhase("gameover")
    sndGameOver()
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current)
      localStorage.setItem("mathteaser_hs", scoreRef.current.toString())
    }
    if (streakRef.current > bestStreak) {
      setBestStreak(streakRef.current)
      localStorage.setItem("mathteaser_bs", streakRef.current.toString())
    }
    emitGameEnd("math-teaser", scoreRef.current)
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => () => cancelAnimationFrame(animRef.current), [])

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        if (phaseRef.current === "idle" || phaseRef.current === "gameover") handleStart()
      }
      if (phaseRef.current === "playing") {
        const n = +e.key
        if (n >= 1 && n <= NUM_CHOICES) { e.preventDefault(); handleAnswer(n - 1) }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleStart, question])

  // ─── Render ────────────────────────────────────────────────────────────────
  const timerColor = timeLeft > 0.5 ? GREEN : timeLeft > 0.2 ? ACCENT : RED
  const isActive = phase === "playing" || phase === "correct" || phase === "wrong" || phase === "timeout"

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4 select-none"
         style={{ background: BG, fontFamily: "'Courier New', monospace" }}>

      {/* Header */}
      <div className="flex items-center gap-4">
        <a href="/" className="text-sm hover:text-gray-300 transition-colors" style={{ color: MUTED }}>← Back</a>
        <h1 className="text-xl font-bold tracking-[0.25em]" style={{ color: TEXT }}>MATH TEASER</h1>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-sm rounded-lg overflow-hidden" style={{ background: CARD_BG, border: `1px solid #222` }}>

        {/* Timer Bar */}
        {isActive && (
          <div className="h-2 w-full" style={{ background: "#1a1a1a" }}>
            <div className="h-full transition-all duration-100 ease-linear"
                 style={{ width: `${timeLeft * 100}%`, background: timerColor }} />
          </div>
        )}

        {/* Score Row */}
        {isActive && (
          <div className="flex items-center justify-between px-4 py-2 text-xs" style={{ background: "#111", borderBottom: "1px solid #222" }}>
            <span style={{ color: MUTED }}>Score <span style={{ color: TEXT, fontWeight: "bold" }}>{score}</span></span>
            <span style={{ color: MUTED }}>Q<span style={{ color: TEXT }}>{questionNum + 1}</span></span>
            {streak > 0 && (
              <span style={{ color: ACCENT }}>🔥 {streak}</span>
            )}
            <span style={{ color: MUTED }}>Time <span style={{ color: timerColor, fontWeight: "bold" }}>
              {Math.max(0, Math.ceil(timeLeft * totalTime / 1000))}s
            </span></span>
          </div>
        )}

        {/* Content Area */}
        <div className="px-6 py-8">

          {/* ── IDLE SCREEN ── */}
          {phase === "idle" && (
            <div className="text-center space-y-6">
              <div className="text-5xl">🧠</div>
              <div>
                <p className="text-lg font-bold" style={{ color: TEXT }}>How fast is your brain?</p>
                <p className="text-xs mt-2" style={{ color: MUTED }}>Solve math problems before time runs out.<br/>Wrong answer or timeout = game over.</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-lg">
                {(["+", "−", "×", "÷"] as Op[]).map(op => (
                  <div key={op} className="rounded py-2 text-center font-bold" style={{ background: "#1a1a1a", color: OP_COLORS[op] }}>{op}</div>
                ))}
              </div>
              {highScore > 0 && (
                <p className="text-xs" style={{ color: ACCENT }}>Best: {highScore} pts • {bestStreak} streak</p>
              )}
              <button onClick={handleStart}
                className="w-full py-3 rounded font-bold text-sm tracking-widest transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ background: GREEN, color: BG }}>
                START
              </button>
              <p className="text-[10px]" style={{ color: "#333" }}>Press SPACE or tap to start • Keys 1-4 to answer</p>
            </div>
          )}

          {/* ── QUESTION ── */}
          {isActive && question && (
            <div className="space-y-6">
              {/* Operation Badge */}
              <div className="flex justify-center">
                <span className="px-3 py-1 rounded text-xs font-bold tracking-wider"
                      style={{ background: OP_COLORS[question.op] + "22", color: OP_COLORS[question.op] }}>
                  {question.op === "+" ? "ADDITION" : question.op === "−" ? "SUBTRACTION" : question.op === "×" ? "MULTIPLICATION" : "DIVISION"}
                </span>
              </div>

              {/* Question Display */}
              <div className="text-center">
                <p className="text-4xl font-bold tracking-wide" style={{ color: TEXT }}>
                  <span>{question.a}</span>
                  <span className="mx-3" style={{ color: OP_COLORS[question.op] }}>{question.op}</span>
                  <span>{question.b}</span>
                </p>
                <p className="text-lg mt-1" style={{ color: MUTED }}>=  ?</p>
              </div>

              {/* Feedback */}
              {phase === "correct" && (
                <div className="text-center -mt-2">
                  <span className="text-sm font-bold" style={{ color: GREEN }}>
                    +{lastPoints} {isPerfect && <span style={{ color: ACCENT }}>⚡ PERFECT!</span>}
                  </span>
                </div>
              )}
              {phase === "wrong" && (
                <div className="text-center -mt-2">
                  <span className="text-sm font-bold" style={{ color: RED }}>WRONG! Answer: {question.answer}</span>
                </div>
              )}
              {phase === "timeout" && (
                <div className="text-center -mt-2">
                  <span className="text-sm font-bold" style={{ color: RED }}>TIME&apos;S UP! Answer: {question.answer}</span>
                </div>
              )}

              {/* Choices */}
              <div className="grid grid-cols-2 gap-3">
                {question.choices.map((choice, idx) => {
                  let bg = "#222"
                  let border = "#333"
                  let textColor = TEXT

                  if (selectedIdx !== null) {
                    if (choice === question.answer) { bg = GREEN + "33"; border = GREEN; textColor = GREEN }
                    else if (idx === selectedIdx) { bg = RED + "33"; border = RED; textColor = RED }
                    else { textColor = MUTED }
                  }

                  return (
                    <button key={idx}
                      onClick={() => handleAnswer(idx)}
                      disabled={phase !== "playing"}
                      className="relative py-4 rounded-lg font-bold text-xl transition-all active:scale-95"
                      style={{ background: bg, border: `1.5px solid ${border}`, color: textColor }}>
                      <span className="absolute top-1 left-2 text-[9px] font-normal" style={{ color: MUTED }}>{idx + 1}</span>
                      {choice}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── GAME OVER ── */}
          {phase === "gameover" && (
            <div className="text-center space-y-5">
              <div className="text-4xl">💀</div>
              <div>
                <p className="text-2xl font-bold" style={{ color: TEXT }}>GAME OVER</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="py-3 rounded" style={{ background: "#1a1a1a" }}>
                  <p className="text-2xl font-bold" style={{ color: ACCENT }}>{score}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Score</p>
                </div>
                <div className="py-3 rounded" style={{ background: "#1a1a1a" }}>
                  <p className="text-2xl font-bold" style={{ color: "#e67e22" }}>{streak}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Streak</p>
                </div>
                <div className="py-3 rounded" style={{ background: "#1a1a1a" }}>
                  <p className="text-2xl font-bold" style={{ color: BLUE }}>{questionNum}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Answered</p>
                </div>
                <div className="py-3 rounded" style={{ background: "#1a1a1a" }}>
                  <p className="text-2xl font-bold" style={{ color: GREEN }}>{highScore}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Best</p>
                </div>
              </div>

              {score >= highScore && score > 0 && (
                <p className="text-xs font-bold" style={{ color: ACCENT }}>🏆 NEW HIGH SCORE!</p>
              )}

              <button onClick={handleStart}
                className="w-full py-3 rounded font-bold text-sm tracking-widest transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ background: GREEN, color: BG }}>
                PLAY AGAIN
              </button>
              <p className="text-[10px]" style={{ color: "#333" }}>Press SPACE to restart</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom stats — always visible */}
      <div className="flex items-center gap-6 text-xs" style={{ color: MUTED, fontFamily: "'Courier New', monospace" }}>
        {highScore > 0 && <span>Best: <span style={{ color: ACCENT }}>{highScore}</span></span>}
        {bestStreak > 0 && <span>Best Streak: <span style={{ color: "#e67e22" }}>{bestStreak}</span></span>}
      </div>
    </div>
  )
}
