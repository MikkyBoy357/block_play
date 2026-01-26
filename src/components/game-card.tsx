"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Play, Users, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSound } from "@/hooks/use-sound"
import type { LucideIcon } from "lucide-react"

interface Game {
  id: number
  title: string
  slug: string
  description: string
  icon: LucideIcon
  color: string
  players: string
  image: string
}

interface GameCardProps {
  game: Game
  index: number
}

export function GameCard({ game, index }: GameCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { playHover, playClick } = useSound()

  const Icon = game.icon

  return (
    <div
      className="group relative rounded-2xl overflow-hidden bg-card border border-border/50 transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_40px_rgba(0,255,136,0.15)]"
      style={{
        animationDelay: `${index * 100}ms`,
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
      <div className="relative h-44 overflow-hidden">
        <Image
          src={game.image || "/placeholder.svg"}
          alt={game.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${game.color} opacity-40 mix-blend-overlay`} />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />

        {/* Floating Icon */}
        <div
          className={`absolute top-4 right-4 p-3 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 transition-all duration-300 ${isHovered ? "scale-110 rotate-12" : ""}`}
        >
          <Icon className="w-5 h-5 text-primary" />
        </div>

        {/* Player Count */}
        <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs">
          <Users className="w-3 h-3 text-primary" />
          <span className="text-foreground font-medium">{game.players}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
              {game.title}
            </h3>
            <p className="text-sm text-muted-foreground">{game.description}</p>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`w-3.5 h-3.5 ${i < 4 ? "text-primary fill-primary" : "text-muted-foreground"}`} />
          ))}
          <span className="text-xs text-muted-foreground ml-1">4.0</span>
        </div>

        {/* Play Button */}
        <Link href={`/games/${game.slug}`} onClick={playClick}>
          <Button
            className="w-full bg-primary/10 border border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground gap-2 transition-all duration-300 group/btn"
          >
            <Play className="w-4 h-4 transition-transform group-hover/btn:scale-125" />
            Play Now
          </Button>
        </Link>
      </div>

      {/* Glow Effect */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${isHovered ? "opacity-100" : "opacity-0"}`}
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(0, 255, 136, 0.1), transparent 70%)`,
        }}
      />
    </div>
  )
}
