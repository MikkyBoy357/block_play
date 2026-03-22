"use client"

import { useState } from "react"
import { GameCard } from "./game-card"
import { useSound } from "@/hooks/use-sound"
import { games } from "@/lib/game-data"

import { Gamepad2, Flame, Zap, Brain, Grid3X3 } from "lucide-react"

type CategoryFilter = "all" | "arcade" | "skill" | "brain" | "classic"

const categories = [
  { id: "all" as CategoryFilter, label: "All Games", icon: Gamepad2 },
  { id: "arcade" as CategoryFilter, label: "Arcade", icon: Zap },
  { id: "skill" as CategoryFilter, label: "Skill", icon: Flame },
  { id: "brain" as CategoryFilter, label: "Brain", icon: Brain },
  { id: "classic" as CategoryFilter, label: "Classic", icon: Grid3X3 },
]

export function GameGrid() {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all")
  const { playHover, playClick } = useSound()

  const filteredGames = activeCategory === "all"
    ? games
    : games.filter((g) => g.category === activeCategory)

  return (
    <section id="games" className="py-16 md:py-24 px-4">
      <div className="container mx-auto">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-neon-blue/20 mb-4">
            <Gamepad2 className="w-4 h-4 text-neon-blue" />
            <span className="text-sm text-neon-blue font-medium">Game Arena</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mb-4">
            Choose Your <span className="text-primary neon-text">Battle</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            13 childhood classics, rebuilt with brutal difficulty. Only the best players win prizes.
          </p>
        </div>

        {/* Category filters */}
        <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto no-scrollbar pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,255,136,0.2)]"
                  : "glass text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
              onClick={() => { setActiveCategory(cat.id); playClick() }}
              onMouseEnter={playHover}
            >
              <cat.icon className="w-4 h-4" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Games count */}
        <div className="flex items-center justify-between mb-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>{filteredGames.length} games available</span>
          </div>
          <div className="text-sm text-muted-foreground hidden sm:flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <span>Total weekly prizes: <span className="text-green-400 font-bold">$2,455</span></span>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {filteredGames.map((game, index) => (
            <GameCard key={game.id} game={game} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
