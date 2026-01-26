"use client"

import { GameCard } from "./game-card"
import { Joystick, TreePine, Crosshair, Puzzle, Rocket, Dices } from "lucide-react"

const games = [
  {
    id: 1,
    title: "Football Tap",
    slug: "football-tap",
    description: "Tap your way to soccer glory",
    icon: Joystick,
    color: "from-emerald-500 to-cyan-500",
    players: "2.4k",
    image: "/football-soccer-game-neon-style.jpg",
  },
  {
    id: 2,
    title: "LumberJack",
    slug: "lumberjack",
    description: "Chop trees, dodge branches",
    icon: TreePine,
    color: "from-amber-500 to-orange-500",
    players: "1.8k",
    image: "/lumberjack-forest-game-pixel-art.jpg",
  },
  {
    id: 3,
    title: "Neon Shooter",
    slug: "neon-shooter",
    description: "Blast through cyber waves",
    icon: Crosshair,
    color: "from-pink-500 to-rose-500",
    players: "3.2k",
    image: "/neon-shooter-space-game-cyberpunk.jpg",
  },
  {
    id: 4,
    title: "Block Puzzle",
    slug: "block-puzzle",
    description: "Fit the pieces, clear the board",
    icon: Puzzle,
    color: "from-violet-500 to-purple-500",
    players: "4.1k",
    image: "/tetris-block-puzzle-game-colorful.jpg",
  },
  {
    id: 5,
    title: "Rocket Rush",
    slug: "rocket-rush",
    description: "Navigate through asteroid fields",
    icon: Rocket,
    color: "from-blue-500 to-indigo-500",
    players: "1.5k",
    image: "/rocket-space-game-asteroids-neon.jpg",
  },
  {
    id: 6,
    title: "Lucky Roll",
    slug: "lucky-roll",
    description: "Roll the dice, test your luck",
    icon: Dices,
    color: "from-teal-500 to-emerald-500",
    players: "2.9k",
    image: "/dice-casino-game-futuristic-neon.jpg",
  },
]

export function GameGrid() {
  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Featured Games</h2>
            <p className="text-muted-foreground">Choose your adventure</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>6 games available</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game, index) => (
            <GameCard key={game.id} game={game} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
