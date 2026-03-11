"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useGameSession } from "@/hooks/use-game-session"

// ─── Types ───────────────────────────────────────────────────────────────────
type Phase = "idle" | "playing" | "correct" | "wrong" | "timeout" | "gameover"

interface FlagQuestion {
  code: string
  country: string
  choices: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────
const BASE_TIME = 10000
const MIN_TIME = 3000
const TIME_DECAY = 200
const STREAK_BONUS = 50
const BASE_POINTS = 100
const PERFECT_BONUS = 200
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

// ─── Country Data (code → name) ─────────────────────────────────────────────
const COUNTRIES: [string, string][] = [
  ["US", "United States"], ["GB", "United Kingdom"], ["FR", "France"], ["DE", "Germany"],
  ["IT", "Italy"], ["ES", "Spain"], ["PT", "Portugal"], ["NL", "Netherlands"],
  ["BE", "Belgium"], ["CH", "Switzerland"], ["AT", "Austria"], ["SE", "Sweden"],
  ["NO", "Norway"], ["DK", "Denmark"], ["FI", "Finland"], ["PL", "Poland"],
  ["CZ", "Czech Republic"], ["RO", "Romania"], ["GR", "Greece"], ["IE", "Ireland"],
  ["RU", "Russia"], ["UA", "Ukraine"], ["TR", "Turkey"], ["JP", "Japan"],
  ["CN", "China"], ["KR", "South Korea"], ["IN", "India"], ["TH", "Thailand"],
  ["VN", "Vietnam"], ["PH", "Philippines"], ["ID", "Indonesia"], ["MY", "Malaysia"],
  ["SG", "Singapore"], ["AU", "Australia"], ["NZ", "New Zealand"], ["CA", "Canada"],
  ["MX", "Mexico"], ["BR", "Brazil"], ["AR", "Argentina"], ["CL", "Chile"],
  ["CO", "Colombia"], ["PE", "Peru"], ["EG", "Egypt"], ["ZA", "South Africa"],
  ["NG", "Nigeria"], ["KE", "Kenya"], ["GH", "Ghana"], ["MA", "Morocco"],
  ["SA", "Saudi Arabia"], ["AE", "United Arab Emirates"], ["IL", "Israel"],
  ["PK", "Pakistan"], ["BD", "Bangladesh"], ["LK", "Sri Lanka"], ["NP", "Nepal"],
  ["MM", "Myanmar"], ["KH", "Cambodia"], ["TW", "Taiwan"], ["HK", "Hong Kong"],
  ["CU", "Cuba"], ["JM", "Jamaica"], ["PA", "Panama"], ["CR", "Costa Rica"],
  ["EC", "Ecuador"], ["VE", "Venezuela"], ["UY", "Uruguay"], ["PY", "Paraguay"],
  ["BO", "Bolivia"], ["DO", "Dominican Republic"], ["GT", "Guatemala"],
  ["HN", "Honduras"], ["SV", "El Salvador"], ["NI", "Nicaragua"],
  ["IS", "Iceland"], ["HR", "Croatia"], ["RS", "Serbia"], ["BG", "Bulgaria"],
  ["HU", "Hungary"], ["SK", "Slovakia"], ["SI", "Slovenia"], ["LT", "Lithuania"],
  ["LV", "Latvia"], ["EE", "Estonia"], ["GE", "Georgia"], ["AM", "Armenia"],
  ["AZ", "Azerbaijan"], ["KZ", "Kazakhstan"], ["UZ", "Uzbekistan"],
  ["QA", "Qatar"], ["KW", "Kuwait"], ["BH", "Bahrain"], ["OM", "Oman"],
  ["JO", "Jordan"], ["LB", "Lebanon"], ["IQ", "Iraq"], ["IR", "Iran"],
  ["AF", "Afghanistan"], ["ET", "Ethiopia"], ["TZ", "Tanzania"], ["UG", "Uganda"],
  ["SN", "Senegal"], ["CI", "Ivory Coast"], ["CM", "Cameroon"], ["CD", "DR Congo"],
  ["MG", "Madagascar"], ["MZ", "Mozambique"], ["ZW", "Zimbabwe"], ["ZM", "Zambia"],
  ["AO", "Angola"], ["TN", "Tunisia"], ["LY", "Libya"], ["SD", "Sudan"],
  ["FJ", "Fiji"], ["PG", "Papua New Guinea"], ["MN", "Mongolia"],
  ["LA", "Laos"], ["BN", "Brunei"], ["TL", "Timor-Leste"],
  ["MT", "Malta"], ["CY", "Cyprus"], ["LU", "Luxembourg"],
  ["AL", "Albania"], ["MK", "North Macedonia"], ["BA", "Bosnia & Herzegovina"],
  ["ME", "Montenegro"], ["XK", "Kosovo"], ["MD", "Moldova"], ["BY", "Belarus"],
]

function flagUrl(code: string): string {
  return `https://flagcdn.com/w320/${code.toLowerCase()}.png`
}

// ─── Difficulty tiers ────────────────────────────────────────────────────────
// Easy: well-known countries. Medium: adds less common. Hard: all countries.
const EASY_COUNT = 40
const MEDIUM_COUNT = 80

function getPool(qNum: number): [string, string][] {
  if (qNum < 5) return COUNTRIES.slice(0, EASY_COUNT)
  if (qNum < 15) return COUNTRIES.slice(0, MEDIUM_COUNT)
  return COUNTRIES
}

// ─── Question Generator ──────────────────────────────────────────────────────
function generateQuestion(qNum: number, recent: string[]): FlagQuestion {
  const pool = getPool(qNum)
  // Pick answer, avoiding recently shown
  let answer: [string, string]
  let attempts = 0
  do {
    answer = pool[Math.floor(Math.random() * pool.length)]
    attempts++
  } while (recent.includes(answer[0]) && attempts < 50)

  const [code, country] = answer
  const choices = new Set<string>([country])

  // Pick distractors from the same pool
  let safety = 0
  while (choices.size < NUM_CHOICES && safety < 200) {
    safety++
    const rand = pool[Math.floor(Math.random() * pool.length)]
    if (rand[1] !== country) choices.add(rand[1])
  }

  const shuffled = [...choices].sort(() => Math.random() - 0.5)
  return { code, country, choices: shuffled }
}

// ─── Component ───────────────────────────────────────────────────────────────
export function FlagQuizGame() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [question, setQuestion] = useState<FlagQuestion | null>(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [questionNum, setQuestionNum] = useState(0)
  const [timeLeft, setTimeLeft] = useState(1)
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
  const recentRef = useRef<string[]>([])

  const { startGame, recordAction, endGame } = useGameSession()

  // ─── High Score ──────────────────────────────────────────────────────────
  useEffect(() => {
    const hs = localStorage.getItem("flagquiz_hs")
    if (hs) setHighScore(+hs)
    const bs = localStorage.getItem("flagquiz_bs")
    if (bs) setBestStreak(+bs)
  }, [])

  // ─── Preload next flag image ─────────────────────────────────────────────
  const preloadFlag = useCallback((code: string) => {
    const img = new Image()
    img.src = flagUrl(code)
  }, [])

  // ─── Timer Loop ──────────────────────────────────────────────────────────
  const timerLoop = useCallback((ts: number) => {
    if (phaseRef.current !== "playing") return

    const elapsed = ts - timerStart.current
    const ratio = 1 - elapsed / timerDuration.current
    setTimeLeft(Math.max(0, ratio))

    if (ratio < 0.3 && ratio > 0) {
      if (ts - lastTickRef.current > 400) { sndTick(); lastTickRef.current = ts }
    }

    if (ratio <= 0) {
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
    recentRef.current = []
    setScore(0); setStreak(0); setQuestionNum(0); setSelectedIdx(null); setLastPoints(0); setIsPerfect(false)
    sndStart()
    await startGame("flag-quiz")
    nextQuestion(0)
  }, [startGame])

  function nextQuestion(qNum: number) {
    const q = generateQuestion(qNum, recentRef.current)
    // Track recent to avoid repeats
    recentRef.current = [...recentRef.current.slice(-10), q.code]
    preloadFlag(q.code)
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

    if (chosen === question.country) {
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
      recordAction("correct")

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
      localStorage.setItem("flagquiz_hs", scoreRef.current.toString())
    }
    if (streakRef.current > bestStreak) {
      setBestStreak(streakRef.current)
      localStorage.setItem("flagquiz_bs", streakRef.current.toString())
    }
    endGame()
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
        <h1 className="text-xl font-bold tracking-[0.25em]" style={{ color: TEXT }}>FLAG QUIZ</h1>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-sm rounded-lg overflow-hidden" style={{ background: CARD_BG, border: "1px solid #222" }}>

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
              <div className="text-5xl">🏳️</div>
              <div>
                <p className="text-lg font-bold" style={{ color: TEXT }}>Name That Flag!</p>
                <p className="text-xs mt-2" style={{ color: MUTED }}>
                  Identify the country from its flag before time runs out.<br />
                  Wrong answer or timeout = game over.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-2xl">
                {["🇺🇸", "🇯🇵", "🇧🇷", "🇫🇷"].map(flag => (
                  <div key={flag} className="rounded py-2 text-center" style={{ background: "#1a1a1a" }}>{flag}</div>
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
            <div className="space-y-5">
              {/* Difficulty Badge */}
              <div className="flex justify-center">
                <span className="px-3 py-1 rounded text-xs font-bold tracking-wider"
                      style={{
                        background: (questionNum < 5 ? GREEN : questionNum < 15 ? ACCENT : RED) + "22",
                        color: questionNum < 5 ? GREEN : questionNum < 15 ? ACCENT : RED,
                      }}>
                  {questionNum < 5 ? "EASY" : questionNum < 15 ? "MEDIUM" : "HARD"}
                </span>
              </div>

              {/* Flag Display */}
              <div className="flex justify-center">
                <div className="rounded-lg overflow-hidden border-2" style={{ borderColor: "#333" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={flagUrl(question.code)}
                    alt="Country flag"
                    className="w-48 h-32 object-cover"
                    style={{ imageRendering: "auto" }}
                  />
                </div>
              </div>

              {/* Feedback */}
              {phase === "correct" && (
                <div className="text-center">
                  <span className="text-sm font-bold" style={{ color: GREEN }}>
                    ✓ {question.country} +{lastPoints} {isPerfect && <span style={{ color: ACCENT }}>⚡ PERFECT!</span>}
                  </span>
                </div>
              )}
              {phase === "wrong" && (
                <div className="text-center">
                  <span className="text-sm font-bold" style={{ color: RED }}>✗ It was {question.country}</span>
                </div>
              )}
              {phase === "timeout" && (
                <div className="text-center">
                  <span className="text-sm font-bold" style={{ color: RED }}>TIME&apos;S UP! It was {question.country}</span>
                </div>
              )}

              {/* Choices */}
              <div className="grid grid-cols-1 gap-2">
                {question.choices.map((choice, idx) => {
                  let bg = "#222"
                  let border = "#333"
                  let textColor = TEXT

                  if (selectedIdx !== null) {
                    if (choice === question.country) { bg = GREEN + "33"; border = GREEN; textColor = GREEN }
                    else if (idx === selectedIdx) { bg = RED + "33"; border = RED; textColor = RED }
                    else { textColor = MUTED }
                  }

                  return (
                    <button key={idx}
                      onClick={() => handleAnswer(idx)}
                      disabled={phase !== "playing"}
                      className="relative py-3 px-4 rounded-lg font-bold text-sm text-left transition-all active:scale-[0.97]"
                      style={{ background: bg, border: `1.5px solid ${border}`, color: textColor }}>
                      <span className="mr-3 inline-block w-5 text-center text-[10px] font-normal" style={{ color: MUTED }}>{idx + 1}</span>
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
              <div className="text-4xl">🌍</div>
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
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Identified</p>
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

      {/* Bottom stats */}
      <div className="flex items-center gap-6 text-xs" style={{ color: MUTED, fontFamily: "'Courier New', monospace" }}>
        {highScore > 0 && <span>Best: <span style={{ color: ACCENT }}>{highScore}</span></span>}
        {bestStreak > 0 && <span>Best Streak: <span style={{ color: "#e67e22" }}>{bestStreak}</span></span>}
      </div>
    </div>
  )
}
