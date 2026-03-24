"use client"

import { useState, useEffect } from "react"
import { Trophy, Medal, Crown, TrendingUp, Flame, Star, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSound } from "@/hooks/use-sound"
import { createClient } from "@/utils/supabase/client"
import { useAuth } from "@/hooks/use-auth"

type TimeFilter = "daily" | "weekly" | "alltime"
type GameFilter = "all" | string

interface LeaderboardEntry {
  rank: number
  name: string
  avatar: string
  country: string
  score: number
  streak: number
  game: string
  prize: string
  tier: string
}

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, name: "NinjaGamer_99", avatar: "🥷", country: "🇯🇵", score: 248500, streak: 14, game: "Tetris", prize: "$500", tier: "diamond" },
  { rank: 2, name: "PixelQueen", avatar: "👑", country: "🇰🇷", score: 231200, streak: 11, game: "Pac-Man", prize: "$350", tier: "diamond" },
  { rank: 3, name: "RetroKing_X", avatar: "🎮", country: "🇺🇸", score: 219800, streak: 9, game: "Brick Break", prize: "$200", tier: "platinum" },
  { rank: 4, name: "ArcadeBoss", avatar: "⚡", country: "🇧🇷", score: 198400, streak: 8, game: "Tetris", prize: "$150", tier: "platinum" },
  { rank: 5, name: "SkyDancer", avatar: "🌟", country: "🇬🇧", score: 187600, streak: 7, game: "Flappy Plane", prize: "$100", tier: "gold" },
  { rank: 6, name: "MathWhiz_Pro", avatar: "🧠", country: "🇮🇳", score: 176300, streak: 6, game: "Math Teaser", prize: "$75", tier: "gold" },
  { rank: 7, name: "SnakeCharmer", avatar: "🐍", country: "🇳🇬", score: 165800, streak: 5, game: "Glow Snake", prize: "$50", tier: "gold" },
  { rank: 8, name: "BlockMaster", avatar: "🧊", country: "🇩🇪", score: 154200, streak: 4, game: "Tetris", prize: "$40", tier: "silver" },
  { rank: 9, name: "FlagHunter", avatar: "🏴", country: "🇫🇷", score: 143500, streak: 3, game: "Flag Quiz", prize: "$30", tier: "silver" },
  { rank: 10, name: "GravityPro", avatar: "🚀", country: "🇵🇭", score: 132800, streak: 2, game: "Gravity Run", prize: "$25", tier: "silver" },
]

const gameFilters = [
  { id: "all", label: "All Games" },
  { id: "tetris", label: "Tetris" },
  { id: "pacman", label: "Pac-Man" },
  { id: "flappy-plane", label: "Flappy Plane" },
  { id: "glow-snake", label: "Snake" },
  { id: "brick-break", label: "Brick Break" },
  { id: "math-teaser", label: "Math Teaser" },
]

const tierColors: Record<string, string> = {
  diamond: "from-cyan-400 to-blue-500",
  platinum: "from-slate-300 to-slate-500",
  gold: "from-yellow-400 to-amber-500",
  silver: "from-gray-300 to-gray-500",
}

function getRankDisplay(rank: number) {
  if (rank === 1) return { icon: Crown, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30" }
  if (rank === 2) return { icon: Medal, color: "text-slate-300", bg: "bg-slate-300/10 border-slate-300/30" }
  if (rank === 3) return { icon: Medal, color: "text-amber-600", bg: "bg-amber-600/10 border-amber-600/30" }
  return { icon: null, color: "text-muted-foreground", bg: "bg-muted/30 border-border/30" }
}

export function LeaderboardSection() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("weekly")
  const [gameFilter, setGameFilter] = useState<GameFilter>("all")
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(mockLeaderboard)
  const { playHover, playClick } = useSound()
  const { user } = useAuth()

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const supabase = createClient()

        // Build query for game_sessions with profile join
        let query = supabase
          .from("game_sessions")
          .select("game_slug, score, earned, created_at, user_id, profiles!inner(username, display_name, avatar_url)")
          .order("score", { ascending: false })
          .limit(50)

        // Time filter
        const now = new Date()
        if (timeFilter === "daily") {
          const today = new Date(now)
          today.setHours(0, 0, 0, 0)
          query = query.gte("created_at", today.toISOString())
        } else if (timeFilter === "weekly") {
          const day = now.getDay()
          const diff = day === 0 ? 6 : day - 1
          const monday = new Date(now)
          monday.setDate(now.getDate() - diff)
          monday.setHours(0, 0, 0, 0)
          query = query.gte("created_at", monday.toISOString())
        }

        // Game filter
        if (gameFilter !== "all") {
          query = query.eq("game_slug", gameFilter)
        }

        const { data } = await query

        if (data && data.length > 0) {
          // Deduplicate: keep only each user's best score per game
          const bestByUser = new Map<string, typeof data[number]>()
          for (const row of data) {
            const key = `${row.user_id}-${row.game_slug}`
            const existing = bestByUser.get(key)
            if (!existing || row.score > existing.score) {
              bestByUser.set(key, row)
            }
          }

          const sorted = [...bestByUser.values()].sort((a, b) => b.score - a.score).slice(0, 10)

          const tierForRank = (r: number) => r <= 2 ? "diamond" : r <= 4 ? "platinum" : r <= 7 ? "gold" : "silver"
          const avatars = ["🥷", "👑", "🎮", "⚡", "🌟", "🧠", "🐍", "🧊", "🏴", "🚀"]

          const entries: LeaderboardEntry[] = sorted.map((row, i) => {
            const profile = row.profiles as unknown as { username: string | null; display_name: string | null }
            return {
              rank: i + 1,
              name: profile?.username ?? profile?.display_name ?? "Anonymous",
              avatar: avatars[i % avatars.length],
              country: "",
              score: row.score,
              streak: 0,
              game: row.game_slug,
              prize: row.earned > 0 ? `$${Number(row.earned).toFixed(2)}` : "-",
              tier: tierForRank(i + 1),
            }
          })
          setLeaderboard(entries)
        } else {
          setLeaderboard(mockLeaderboard)
        }
      } catch {
        // Fallback to mock on any error
        setLeaderboard(mockLeaderboard)
      }
    }

    fetchLeaderboard()
  }, [timeFilter, gameFilter])

  return (
    <section id="leaderboard" className="py-16 md:py-24 px-4 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-neon-purple/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto relative z-10">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-gold/20 mb-4">
            <Trophy className="w-4 h-4 text-gold" />
            <span className="text-sm text-gold font-medium">Live Leaderboard</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mb-4">
            Top Players <span className="neon-text-gold text-gold">Win Big</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Compete for the top spots. Weekly prizes paid out every Monday.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 max-w-4xl mx-auto">
          {/* Time filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl glass">
            {(["daily", "weekly", "alltime"] as TimeFilter[]).map((filter) => (
              <button
                key={filter}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  timeFilter === filter
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                onClick={() => { setTimeFilter(filter); playClick() }}
                onMouseEnter={playHover}
              >
                {filter === "alltime" ? "All Time" : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Game filter - horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1">
            {gameFilters.map((gf) => (
              <button
                key={gf.id}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  gameFilter === gf.id
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "text-muted-foreground bg-muted/30 border border-border/30 hover:border-primary/30 hover:text-primary"
                }`}
                onClick={() => { setGameFilter(gf.id); playClick() }}
                onMouseEnter={playHover}
              >
                {gf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard table */}
        <div className="max-w-4xl mx-auto rounded-2xl glass overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[3rem_1fr_5rem_5rem_4.5rem] sm:grid-cols-[4rem_1fr_6rem_6rem_5rem_5rem] gap-2 px-4 sm:px-6 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right hidden sm:block">Game</span>
            <span className="text-right">Score</span>
            <span className="text-right">Streak</span>
            <span className="text-right">Prize</span>
          </div>

          {/* Rows */}
          {leaderboard.map((player, i) => {
            const rankInfo = getRankDisplay(player.rank)
            return (
              <div
                key={player.rank}
                className={`grid grid-cols-[3rem_1fr_5rem_5rem_4.5rem] sm:grid-cols-[4rem_1fr_6rem_6rem_5rem_5rem] gap-2 px-4 sm:px-6 py-3 sm:py-4 items-center border-b border-border/10 hover:bg-white/[0.02] transition-all duration-200 cursor-default group ${
                  player.rank <= 3 ? "bg-white/[0.01]" : ""
                }`}
                style={{ animationDelay: `${i * 60}ms`, animation: "fadeInUp 0.4s ease-out forwards", opacity: 0 }}
              >
                {/* Rank */}
                <div className="flex items-center justify-center">
                  {rankInfo.icon ? (
                    <div className={`w-8 h-8 rounded-lg ${rankInfo.bg} border flex items-center justify-center`}>
                      <rankInfo.icon className={`w-4 h-4 ${rankInfo.color}`} />
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground w-8 text-center">#{player.rank}</span>
                  )}
                </div>

                {/* Player */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full glass flex items-center justify-center text-base sm:text-lg shrink-0">
                    {player.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {player.country} {player.name}
                    </div>
                    <div className="text-xs text-muted-foreground sm:hidden">{player.game}</div>
                  </div>
                </div>

                {/* Game */}
                <div className="text-right text-sm text-muted-foreground hidden sm:block">{player.game}</div>

                {/* Score */}
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground font-mono">
                    {player.score.toLocaleString()}
                  </span>
                </div>

                {/* Streak */}
                <div className="text-right flex items-center justify-end gap-1">
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span className="text-sm font-semibold text-orange-400">{player.streak}</span>
                </div>

                {/* Prize */}
                <div className="text-right">
                  <span className="text-sm font-bold text-green-400">{player.prize}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Your position preview */}
        <div className="max-w-4xl mx-auto mt-4 p-4 rounded-xl glass border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-lg">
                🎯
              </div>
              <div>
                {user ? (
                  <>
                    <div className="text-sm font-semibold text-foreground">
                      {user.username ?? user.email} — <span className="text-primary">Playing</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Keep competing to climb the ranks</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-foreground">Your Position: <span className="text-primary">#--</span></div>
                    <div className="text-xs text-muted-foreground">Subscribe to start competing</div>
                  </>
                )}
              </div>
            </div>
            {!user && (
            <a href="#pricing">
              <Button size="sm" className="bg-primary text-primary-foreground gap-1 text-xs">
                Join Now <ChevronRight className="w-3 h-3" />
              </Button>
            </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
