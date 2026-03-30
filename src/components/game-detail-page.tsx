"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  Play,
  Trophy,
  Target,
  Users,
  Flame,
  Gamepad2,
  Info,
  Lightbulb,
  BookOpen,
  Keyboard,
  ChevronDown,
  ChevronUp,
  Star,
  Zap,
  X,
  DollarSign,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GameActivityFeed } from "@/components/game-activity-feed"
import { useSound } from "@/hooks/use-sound"
import { useGameSession } from "@/hooks/use-game-session"
import { useGameEndListener } from "@/hooks/use-game-events"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/utils/supabase/client"
import type { GameData } from "@/lib/game-data"

const difficultyConfig = {
  Extreme: {
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
    stars: 4,
  },
} as const

// Top score entry from DB
interface TopScoreEntry {
  rank: number
  name: string
  score: number
  unit: string
}

// Game results after ending a session
interface GameResults {
  finalScore: number
  qualified: boolean
  earned: number
  totalWeekly: number
  capped: boolean
}

interface GameDetailPageProps {
  game: GameData
  children: React.ReactNode
}

export function GameDetailPage({ game, children }: GameDetailPageProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)
  const [gameResults, setGameResults] = useState<GameResults | null>(null)
  const [topScores, setTopScores] = useState<TopScoreEntry[]>([])
  const { playClick } = useSound()
  const { startGame, endGame } = useGameSession()
  const { user } = useAuth()

  const diff = difficultyConfig[game.difficulty]

  // Fetch real top scores from Supabase
  useEffect(() => {
    async function fetchTopScores() {
      try {
        const supabase = createClient()
        const now = new Date()
        const day = now.getDay()
        const diff = day === 0 ? 6 : day - 1
        const monday = new Date(now)
        monday.setDate(now.getDate() - diff)
        monday.setHours(0, 0, 0, 0)

        const { data } = await supabase
          .from("game_sessions")
          .select("score, user_id, profiles!inner(username, display_name)")
          .eq("game_slug", game.slug)
          .gte("created_at", monday.toISOString())
          .order("score", { ascending: false })
          .limit(20)

        if (data && data.length > 0) {
          // Deduplicate: best score per user
          const bestByUser = new Map<string, typeof data[number]>()
          for (const row of data) {
            const existing = bestByUser.get(row.user_id)
            if (!existing || row.score > existing.score) {
              bestByUser.set(row.user_id, row)
            }
          }

          const sorted = [...bestByUser.values()]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)

          setTopScores(
            sorted.map((row, i) => {
              const profile = row.profiles as unknown as { username: string | null; display_name: string | null }
              return {
                rank: i + 1,
                name: profile?.username ?? profile?.display_name ?? "Anonymous",
                score: row.score,
                unit: game.scoreUnit,
              }
            })
          )
        }
      } catch {
        // silently fail — section just won't show scores
      }
    }
    fetchTopScores()
  }, [game.slug, game.scoreUnit, isPlaying])

  // Listen for game-end events from child game components
  const handleGameEnd = useCallback(
    async (detail: { gameSlug: string; finalScore: number }) => {
      const result = await endGame(detail.finalScore)
      if (result) {
        setGameResults({
          finalScore: result.finalScore,
          qualified: result.earning.qualified,
          earned: result.earning.earned,
          totalWeekly: result.earning.totalWeekly,
          capped: result.earning.capped,
        })
      } else {
        // Still show results even if API failed
        setGameResults({
          finalScore: detail.finalScore,
          qualified: detail.finalScore >= game.qualifyingScore,
          earned: 0,
          totalWeekly: 0,
          capped: false,
        })
      }
    },
    [endGame, game.qualifyingScore]
  )

  useGameEndListener(handleGameEnd)

  const handleStartPlaying = async () => {
    setIsPlaying(true)
    setGameResults(null)
    await startGame(game.slug)
    playClick()
  }

  const handlePlayAgain = async () => {
    setGameResults(null)
    await startGame(game.slug)
  }

  const handleExitGame = () => {
    setIsPlaying(false)
    setGameResults(null)
    playClick()
  }

  if (isPlaying) {
    return (
      <div className="relative min-h-screen bg-background">
        {/* Exit bar */}
        <div className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 px-4 py-2 flex items-center justify-between">
          <button
            onClick={handleExitGame}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Exit Game</span>
          </button>
          <div className="flex items-center gap-2 text-sm">
            <Gamepad2 className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">{game.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${diff.bg} ${diff.border} border`}>
              <Target className="w-3 h-3" />
              <span className={diff.color}>
                Qualify: {game.qualifyingScore} {game.scoreUnit}
              </span>
            </div>
          </div>
        </div>
        <div className="pt-12">{children}</div>

        {/* Game Results Overlay */}
        {gameResults && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl glass border border-border/50 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="text-center">
                {gameResults.qualified ? (
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 border border-primary/40 mb-3">
                    <Trophy className="w-8 h-8 text-primary" />
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/20 border border-orange-500/40 mb-3">
                    <Target className="w-8 h-8 text-orange-400" />
                  </div>
                )}
                <h3 className="text-2xl font-black text-foreground">
                  {gameResults.qualified ? "Qualified!" : "Game Over"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {gameResults.qualified
                    ? "Great job! Your score qualifies for earnings."
                    : `Score ${game.qualifyingScore} ${game.scoreUnit} to qualify.`}
                </p>
              </div>

              {/* Score */}
              <div className="rounded-xl bg-card border border-border/50 p-4 text-center">
                <div className="text-sm text-muted-foreground mb-1">Final Score</div>
                <div className="text-4xl font-black text-foreground tabular-nums">
                  {gameResults.finalScore.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">{game.scoreUnit}</div>
              </div>

              {/* Earnings info */}
              {user && gameResults.qualified && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span className="text-sm text-foreground">Earned</span>
                    </div>
                    <span className="font-bold text-primary">
                      ${gameResults.earned.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm text-foreground">Weekly Total</span>
                    </div>
                    <span className="font-bold text-yellow-400">
                      ${gameResults.totalWeekly.toFixed(2)}
                    </span>
                  </div>
                  {gameResults.capped && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-sm text-orange-400">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>Weekly earning cap reached. Upgrade your plan for higher limits.</span>
                    </div>
                  )}
                </div>
              )}

              {!user && gameResults.qualified && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-primary">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Sign in and subscribe to earn real money from your scores!</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handlePlayAgain}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
                <button
                  onClick={handleExitGame}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass border border-border/50 text-foreground font-bold text-sm hover:bg-white/5 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative">
        {/* Background image */}
        <div className="absolute inset-0 h-72 sm:h-80 md:h-96 overflow-hidden">
          <Image
            src={game.image || "/placeholder.svg"}
            alt={game.title}
            fill
            className="object-cover blur-sm scale-110 opacity-30"
          />
          <div
            className={`absolute inset-0 bg-gradient-to-b from-transparent via-background/70 to-background`}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 pt-6 pb-8">
          {/* Back button */}
          <Link
            href="/#games"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Games
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left: Game info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title + badges */}
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${diff.bg} ${diff.border} ${diff.color}`}
                  >
                    {game.difficulty}
                  </span>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary">
                    {game.category.charAt(0).toUpperCase() + game.category.slice(1)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {game.players} playing
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mb-3">
                  {game.title}
                </h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-2xl leading-relaxed">
                  {game.longDescription}
                </p>
              </div>

              {/* Qualifying Score + Prize + Earn — main CTA area */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Qualifying Score Card */}
                <div className="relative rounded-2xl glass border border-primary/30 p-5 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Qualifying Score
                    </span>
                  </div>
                  <div className="text-3xl font-black text-primary">
                    {game.qualifyingScore.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {game.scoreUnit} to earn
                  </div>
                </div>

                {/* Earn Amount Card */}
                <div className="relative rounded-2xl glass border border-yellow-500/30 p-5 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full -translate-y-8 translate-x-8" />
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-yellow-500/10">
                      <Flame className="w-5 h-5 text-yellow-400" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Earn Per {game.qualifyingScore} {game.scoreUnit}
                    </span>
                  </div>
                  <div className="text-3xl font-black text-yellow-400">
                    ${game.earnAmount.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    score {game.qualifyingScore * 2} = ${(game.earnAmount * 2).toFixed(2)}, score {game.qualifyingScore * 3} = ${(game.earnAmount * 3).toFixed(2)}…
                  </div>
                </div>

                {/* Prize Pool Card */}
                <div className="relative rounded-2xl glass border border-green-500/30 p-5 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -translate-y-8 translate-x-8" />
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-green-500/10">
                      <Trophy className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Weekly Prize Pool
                    </span>
                  </div>
                  <div className="text-3xl font-black text-green-400">
                    {game.prizePool.replace("/wk", "")}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    paid out every Monday
                  </div>
                </div>
              </div>

              {/* Play Now Button */}
              <button
                onClick={handleStartPlaying}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-[0_0_30px_rgba(0,255,136,0.3)] hover:shadow-[0_0_50px_rgba(0,255,136,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <Play className="w-6 h-6" />
                Play Now
              </button>

              {/* Collapsible sections */}
              <div className="space-y-3">
                {/* Rules */}
                <div className="rounded-xl glass border border-border/50 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                    onClick={() => setRulesOpen(!rulesOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-neon-blue" />
                      <span className="font-semibold text-foreground">
                        Rules & How to Play
                      </span>
                    </div>
                    {rulesOpen ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  {rulesOpen && (
                    <div className="px-5 pb-5 space-y-4 border-t border-border/30 pt-4">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Rules
                        </h4>
                        <ul className="space-y-2">
                          {game.rules.map((rule, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-foreground/80"
                            >
                              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              {rule}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Controls
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {game.controls.map((ctrl, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border/50 text-sm"
                            >
                              <Keyboard className="w-3.5 h-3.5 text-muted-foreground" />
                              {ctrl}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tips */}
                <div className="rounded-xl glass border border-border/50 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                    onClick={() => setTipsOpen(!tipsOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <Lightbulb className="w-5 h-5 text-yellow-400" />
                      <span className="font-semibold text-foreground">
                        Tips to Win
                      </span>
                    </div>
                    {tipsOpen ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  {tipsOpen && (
                    <div className="px-5 pb-5 border-t border-border/30 pt-4">
                      <ul className="space-y-2">
                        {game.tips.map((tip, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-foreground/80"
                          >
                            <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Qualifying Score Info Banner */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm text-foreground/80">
                  <span className="font-semibold text-primary">How to earn prizes:</span>{" "}
                  Score at least{" "}
                  <span className="font-bold text-primary">
                    {game.qualifyingScore.toLocaleString()} {game.scoreUnit}
                  </span>{" "}
                  to qualify. Only qualifying scores enter the weekly prize pool. The higher
                  your score, the bigger your share of the{" "}
                  <span className="font-semibold text-green-400">{game.prizePool}</span>{" "}
                  weekly prize.
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              {/* Game preview image */}
              <div className="relative rounded-2xl overflow-hidden border border-border/50 aspect-[4/3]">
                <Image
                  src={game.image || "/placeholder.svg"}
                  alt={game.title}
                  fill
                  className="object-cover"
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${game.color} opacity-20 mix-blend-overlay`}
                />
                {/* Play overlay */}
                <button
                  onClick={handleStartPlaying}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-300 cursor-pointer"
                >
                  <div className="p-4 rounded-full bg-primary/90 shadow-[0_0_30px_rgba(0,255,136,0.5)]">
                    <Play className="w-8 h-8 text-primary-foreground" />
                  </div>
                </button>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl glass border border-border/50 p-3 text-center">
                  <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                  <div className="text-lg font-bold text-foreground">
                    {game.difficulty}
                  </div>
                  <div className="text-xs text-muted-foreground">Difficulty</div>
                </div>
                <div className="rounded-xl glass border border-border/50 p-3 text-center">
                  <Users className="w-5 h-5 text-neon-blue mx-auto mb-1" />
                  <div className="text-lg font-bold text-foreground">
                    {game.players}
                  </div>
                  <div className="text-xs text-muted-foreground">Playing</div>
                </div>
                <div className="rounded-xl glass border border-border/50 p-3 text-center">
                  <Target className="w-5 h-5 text-primary mx-auto mb-1" />
                  <div className="text-lg font-bold text-foreground">
                    {game.qualifyingScore.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">To Qualify</div>
                </div>
                <div className="rounded-xl glass border border-border/50 p-3 text-center">
                  <Trophy className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  <div className="text-lg font-bold text-green-400">
                    {game.prizePool.replace("/wk", "")}
                  </div>
                  <div className="text-xs text-muted-foreground">Weekly</div>
                </div>
              </div>

              {/* Top Scores This Week */}
              <div className="rounded-xl glass border border-border/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <h3 className="font-semibold text-foreground text-sm">
                    Top Scores This Week
                  </h3>
                </div>
                <div className="space-y-2">
                  {topScores.length > 0 ? topScores.map((entry) => (
                    <div
                      key={entry.rank}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          entry.rank === 1
                            ? "bg-yellow-400/20 text-yellow-400"
                            : entry.rank === 2
                              ? "bg-gray-300/20 text-gray-300"
                              : entry.rank === 3
                                ? "bg-orange-400/20 text-orange-400"
                                : "bg-white/5 text-muted-foreground"
                        }`}
                      >
                        {entry.rank}
                      </span>
                      <span className="text-foreground truncate flex-1">
                        {entry.name}
                      </span>
                      <span className="font-bold text-primary tabular-nums">
                        {entry.score.toLocaleString()}
                      </span>
                    </div>
                  )) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No scores yet this week. Be the first!
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-border/30 text-center">
                  <span className="text-xs text-muted-foreground">
                    Qualify with {game.qualifyingScore.toLocaleString()}+ {game.scoreUnit}
                  </span>
                </div>
              </div>

              {/* Live Activity */}
              <div className="rounded-xl glass border border-border/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                  </span>
                  <h3 className="font-semibold text-foreground text-sm">
                    Live Activity
                  </h3>
                </div>
                <GameActivityFeed game={game} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
