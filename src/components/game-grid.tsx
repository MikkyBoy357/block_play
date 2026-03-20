"use client"

import { useState } from "react"
import { GameCard } from "./game-card"
import { useSound } from "@/hooks/use-sound"

import { Joystick, TreePine, Circle, ArrowUpDown, Plane, Disc, Ghost, Zap, Brain, Grid3X3, Flag, Worm, Footprints, Gamepad2, Flame, SlidersHorizontal } from "lucide-react"

type CategoryFilter = "all" | "arcade" | "skill" | "brain" | "classic"

const categories = [
  { id: "all" as CategoryFilter, label: "All Games", icon: Gamepad2 },
  { id: "arcade" as CategoryFilter, label: "Arcade", icon: Zap },
  { id: "skill" as CategoryFilter, label: "Skill", icon: Flame },
  { id: "brain" as CategoryFilter, label: "Brain", icon: Brain },
  { id: "classic" as CategoryFilter, label: "Classic", icon: Grid3X3 },
]

const games = [
  {
    id: 1,
    title: "Football Tap",
    slug: "football-tap",
    description: "Tap your way to soccer glory",
    icon: Joystick,
    color: "from-emerald-500 to-cyan-500",
    players: "2.4k",
    image: "/football/images/preview.svg",
    difficulty: "Hard" as const,
    prizePool: "$150/wk",
    category: "skill",
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
    difficulty: "Hard" as const,
    prizePool: "$120/wk",
    category: "skill",
  },
  {
    id: 3,
    title: "Basketball Tap",
    slug: "basketball-tap",
    description: "Swipe to shoot hoops",
    icon: Circle,
    color: "from-orange-500 to-red-500",
    players: "1.2k",
    image: "/basketball-court-game-neon.svg",
    difficulty: "Hard" as const,
    prizePool: "$100/wk",
    category: "skill",
  },
  {
    id: 8,
    title: "Pac-Man",
    slug: "pacman",
    description: "Eat dots, dodge ghosts, clear the maze",
    icon: Ghost,
    color: "from-yellow-400 to-amber-500",
    players: "5.1k",
    image: "/pacman-arcade-neon.svg",
    difficulty: "Extreme" as const,
    prizePool: "$500/wk",
    category: "arcade",
  },
  {
    id: 9,
    title: "Brick Break",
    slug: "brick-break",
    description: "Smash bricks, survive the chaos",
    icon: Zap,
    color: "from-green-400 to-cyan-500",
    players: "3.7k",
    image: "/brick-break-neon.svg",
    difficulty: "Hard" as const,
    prizePool: "$200/wk",
    category: "arcade",
  },
  {
    id: 10,
    title: "Math Teaser",
    slug: "math-teaser",
    description: "Solve fast or fail. Beat the clock!",
    icon: Brain,
    color: "from-yellow-400 to-green-500",
    players: "2.1k",
    image: "/math-teaser.svg",
    difficulty: "Extreme" as const,
    prizePool: "$250/wk",
    category: "brain",
  },
  {
    id: 11,
    title: "Tetris",
    slug: "tetris",
    description: "Stack blocks, clear lines, chase the high score",
    icon: Grid3X3,
    color: "from-cyan-400 to-blue-500",
    players: "4.5k",
    image: "/tetris-neon.svg",
    difficulty: "Extreme" as const,
    prizePool: "$400/wk",
    category: "classic",
  },
  {
    id: 12,
    title: "Flag Quiz",
    slug: "flag-quiz",
    description: "Name the country from its flag!",
    icon: Flag,
    color: "from-red-400 to-blue-500",
    players: "1.9k",
    image: "/flag-quiz-world.svg",
    difficulty: "Medium" as const,
    prizePool: "$80/wk",
    category: "brain",
  },
  {
    id: 13,
    title: "Flappy Plane",
    slug: "flappy-plane",
    description: "Tap to fly through the pipes",
    icon: Plane,
    color: "from-sky-500 to-blue-500",
    players: "3.6k",
    image: "/flappy-plane-card.svg",
    difficulty: "Extreme" as const,
    prizePool: "$300/wk",
    category: "arcade",
  },
  {
    id: 14,
    title: "Gravity Run",
    slug: "gravity-run",
    description: "Flip gravity, dodge pits & spikes",
    icon: ArrowUpDown,
    color: "from-lime-500 to-green-500",
    players: "1.0k",
    image: "/gravity-run-card.svg",
    difficulty: "Hard" as const,
    prizePool: "$100/wk",
    category: "arcade",
  },
  {
    id: 15,
    title: "Air Hockey",
    slug: "air-hockey",
    description: "Glow puck, neon arena, 3 CPU levels",
    icon: Disc,
    color: "from-cyan-500 to-teal-500",
    players: "0.8k",
    image: "/air-hockey-glow-neon.svg",
    difficulty: "Medium" as const,
    prizePool: "$75/wk",
    category: "skill",
  },
  {
    id: 16,
    title: "Glow Snake",
    slug: "glow-snake",
    description: "Neon snake with glow & particle FX",
    icon: Worm,
    color: "from-cyan-400 to-purple-500",
    players: "1.2k",
    image: "/glow-snake-neon.svg",
    difficulty: "Hard" as const,
    prizePool: "$150/wk",
    category: "classic",
  },
  {
    id: 17,
    title: "Crossy Road",
    slug: "crossy-road",
    description: "Hop through neon traffic & rivers",
    icon: Footprints,
    color: "from-cyan-400 to-green-500",
    players: "2.0k",
    image: "/crossy-road-neon.svg",
    difficulty: "Hard" as const,
    prizePool: "$130/wk",
    category: "arcade",
  },
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
