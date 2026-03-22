"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Play, Users, Star, Trophy, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSound } from "@/hooks/use-sound"
import type { GameData } from "@/lib/game-data"

interface GameCardProps {
  game: GameData
  index: number
}

const difficultyColors: Record<string, string> = {
  Extreme: "text-red-400 bg-red-400/10 border-red-400/30",
}

export function GameCard({ game, index }: GameCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { playHover, playClick } = useSound()

  const Icon = game.icon

  return (
    <div
      className="group relative rounded-2xl overflow-hidden bg-card border border-border/50 transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_40px_rgba(0,255,136,0.12)] hover:-translate-y-1"
      style={{
        animationDelay: `${index * 80}ms`,
        animation: "fadeInUp 0.5s ease-out forwards",
        opacity: 0,
      }}
      onMouseEnter={() => {
        setIsHovered(true)
        playHover()
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative h-40 sm:h-44 overflow-hidden">
        <Image
          src={game.image || "/placeholder.svg"}
          alt={game.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${game.color} opacity-30 mix-blend-overlay`} />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />

        {/* Floating Icon */}
        <div
          className={`absolute top-3 right-3 p-2.5 rounded-xl glass transition-all duration-300 ${isHovered ? "scale-110 rotate-6" : ""}`}
        >
          <Icon className="w-5 h-5 text-primary" />
        </div>

        {/* Player Count */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full glass text-xs">
          <Users className="w-3 h-3 text-primary" />
          <span className="text-foreground font-medium">{game.players}</span>
        </div>

        {/* Prize pool badge */}
        {game.prizePool && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-xs">
            <Trophy className="w-3 h-3 text-green-400" />
            <span className="text-green-400 font-bold">{game.prizePool}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0">
            <h3 className="font-bold text-base sm:text-lg text-foreground mb-0.5 group-hover:text-primary transition-colors truncate">
              {game.title}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">{game.description}</p>
          </div>
        </div>

        {/* Difficulty + Qualifying Score row */}
        <div className="flex items-center justify-between mb-2 mt-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${difficultyColors[game.difficulty]}`}>
            {game.difficulty}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Target className="w-3 h-3 text-primary" />
            <span>Qualify: <span className="text-primary font-bold">{game.qualifyingScore.toLocaleString()}</span></span>
          </div>
        </div>

        {/* Earn Amount row */}
        <div className="flex items-center justify-center mb-4">
          <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 px-2.5 py-1 rounded-full">
            Earn ${game.earnAmount.toFixed(2)} per {game.qualifyingScore} {game.scoreUnit}
          </span>
        </div>

        {/* Play Button */}
        <Link href={`/games/${game.slug}`} onClick={playClick}>
          <Button
            className="w-full bg-primary/10 border border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground gap-2 transition-all duration-300 group/btn rounded-xl"
          >
            <Play className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
            View Game
          </Button>
        </Link>
      </div>

      {/* Hover glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${isHovered ? "opacity-100" : "opacity-0"}`}
        style={{
          background: `radial-gradient(circle at 50% 30%, rgba(0, 255, 136, 0.06), transparent 70%)`,
        }}
      />
    </div>
  )
}
