import {
  Joystick,
  TreePine,
  Circle,
  ArrowUpDown,
  Plane,
  Disc,
  Ghost,
  Zap,
  Brain,
  Grid3X3,
  Flag,
  Worm,
  Footprints,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface GameData {
  id: number
  title: string
  slug: string
  description: string
  icon: LucideIcon
  color: string
  players: string
  image: string
  difficulty: "Extreme"
  prizePool: string
  category: "arcade" | "skill" | "brain" | "classic"
  qualifyingScore: number
  scoreUnit: string
  earnAmount: number
  rules: string[]
  tips: string[]
  controls: string[]
  longDescription: string
}

// Subscription tiers with weekly earning caps
// Users can never earn more than what they pay in subscription fees
export const SUBSCRIPTION_TIERS = {
  weekly: {
    id: "weekly" as const,
    price: 1.99,
    period: "week" as const,
    maxWeeklyEarning: 1.99,
  },
  monthly: {
    id: "monthly" as const,
    price: 4.99,
    period: "month" as const,
    maxWeeklyEarning: 1.15, // $4.99 / 4.33 weeks
  },
  yearly: {
    id: "yearly" as const,
    price: 49.99,
    period: "year" as const,
    maxWeeklyEarning: 0.96, // $49.99 / 52 weeks
  },
} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS

export const games: GameData[] = [
  {
    id: 1,
    title: "Football Tap",
    slug: "football-tap",
    description: "Tap your way to soccer glory",
    icon: Joystick,
    color: "from-emerald-500 to-cyan-500",
    players: "2.4k",
    image: "/football/images/preview.svg",
    difficulty: "Extreme",
    prizePool: "$150/wk",
    category: "skill",
    qualifyingScore: 35,
    scoreUnit: "juggles",
    earnAmount: 0.15,
    longDescription:
      "Keep the ball in the air by tapping at the right moment. Each tap must be precisely timed — too early or too late and the ball drops. Wind and gravity increase as your score rises.",
    rules: [
      "Tap anywhere on screen to kick the ball upward",
      "The ball must not touch the ground",
      "Score increases with each successful juggle",
      "Wind speed increases every 10 juggles",
      "Horizontal drift gets more aggressive over time",
    ],
    tips: [
      "Watch the ball shadow for timing cues",
      "Tap slightly before the ball reaches its lowest point",
      "Stay calm during wind shifts — rhythm matters more than reaction",
    ],
    controls: ["Tap / Click — Kick the ball"],
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
    difficulty: "Extreme",
    prizePool: "$120/wk",
    category: "skill",
    qualifyingScore: 60,
    scoreUnit: "chops",
    earnAmount: 0.15,
    longDescription:
      "Chop the tree as fast as you can while dodging deadly branches. The timer drains constantly — each chop adds a tiny bit of time back. Miss a branch and it's instant death.",
    rules: [
      "Tap left or right to chop from that side",
      "Avoid branches on your side — instant death",
      "Timer drains faster as your score increases",
      "Each chop adds a small time bonus",
      "Game ends when the timer runs out or you hit a branch",
    ],
    tips: [
      "Build a rhythm — speed is more important than caution",
      "Glance one branch ahead to plan your next move",
      "The time bonus shrinks, so never slow down",
    ],
    controls: [
      "Left Arrow / Tap Left — Chop from left side",
      "Right Arrow / Tap Right — Chop from right side",
    ],
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
    difficulty: "Extreme",
    prizePool: "$100/wk",
    category: "skill",
    qualifyingScore: 25,
    scoreUnit: "baskets",
    earnAmount: 0.15,
    longDescription:
      "Swipe to launch the basketball toward the hoop. The hoop is narrow, gravity is unforgiving, and you only get 2 lives. Perfect your arc to sink every shot.",
    rules: [
      "Swipe or click to launch the ball toward the hoop",
      "You have 2 lives — miss 2 shots and it's over",
      "Hoop position shifts after each basket",
      "Gravity pulls the ball down hard — arc your shots high",
      "Consecutive baskets earn streak bonuses",
    ],
    tips: [
      "Aim for a high arc — flat shots rarely go in",
      "Watch the hoop position before shooting",
      "Don't rush — you have time to line up each shot",
    ],
    controls: ["Swipe / Click & Drag — Aim and shoot"],
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
    difficulty: "Extreme",
    prizePool: "$500/wk",
    category: "arcade",
    qualifyingScore: 3000,
    scoreUnit: "points",
    earnAmount: 0.30,
    longDescription:
      "Navigate the maze eating every dot while four ghosts hunt you down. Power pellets give brief moments of revenge, but the ghosts get faster and smarter with every level.",
    rules: [
      "Eat all dots to clear the maze and advance",
      "Four ghosts chase you with different AI personalities",
      "Power pellets let you eat ghosts temporarily",
      "Fright mode gets shorter each level — gone after maze 2",
      "Ghosts speed up dramatically as levels progress",
    ],
    tips: [
      "Learn each ghost's personality — they all chase differently",
      "Save power pellets for emergencies, don't waste them",
      "Clear corridors systematically instead of randomly roaming",
    ],
    controls: [
      "Arrow Keys / WASD — Move Pac-Man",
      "Swipe (mobile) — Change direction",
    ],
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
    difficulty: "Extreme",
    prizePool: "$200/wk",
    category: "arcade",
    qualifyingScore: 3500,
    scoreUnit: "points",
    earnAmount: 0.20,
    longDescription:
      "Bounce the ball to destroy bricks and rack up points. The paddle is tiny, the ball is fast, and power-ups can help or hurt. Don't let the ball drop.",
    rules: [
      "Move the paddle to bounce the ball into bricks",
      "Each brick destroyed earns points",
      "Ball speed increases as you clear more bricks",
      "Losing the ball costs a life",
      "Clear all bricks to advance to the next level",
    ],
    tips: [
      "Position yourself where the ball will land, not where it is now",
      "Hit the ball with the paddle edge for sharper angles",
      "Focus on clearing one section at a time",
    ],
    controls: [
      "Mouse / Touch — Move paddle left and right",
    ],
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
    difficulty: "Extreme",
    prizePool: "$250/wk",
    category: "brain",
    qualifyingScore: 25,
    scoreUnit: "correct answers",
    earnAmount: 0.25,
    longDescription:
      "Rapid-fire math problems with a brutal timer. Each question gives you less time than the last. One wrong answer or timeout and the game is over.",
    rules: [
      "Solve the math problem before the timer runs out",
      "Each correct answer gives you the next question",
      "The timer starts at 6 seconds and shrinks each round",
      "Wrong answer = game over instantly",
      "Timer reaches minimum of 1.8 seconds",
    ],
    tips: [
      "Mental math speed is everything — practice multiplication tables",
      "Read the full equation before answering, especially with negatives",
      "Stay calm as the timer shrinks — panic causes mistakes",
    ],
    controls: ["Number Buttons / Keyboard — Enter your answer"],
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
    difficulty: "Extreme",
    prizePool: "$400/wk",
    category: "classic",
    qualifyingScore: 5000,
    scoreUnit: "points",
    earnAmount: 0.25,
    longDescription:
      "The classic block-stacking game, rebuilt with punishing speed. Pieces drop 20% faster than standard, garbage rows appear from level 3, and the board fills up fast.",
    rules: [
      "Rotate and place falling pieces to complete full rows",
      "Completed rows are cleared for points",
      "Pieces speed up every 4 lines cleared",
      "Garbage rows push up from the bottom starting at level 3",
      "Game ends when pieces stack to the top",
    ],
    tips: [
      "Keep the board flat — avoid creating deep holes",
      "Save the I-piece for Tetris clears (4 lines at once)",
      "Play on the side you're weakest at — practice both directions",
    ],
    controls: [
      "← → — Move piece left/right",
      "↑ — Rotate piece",
      "↓ — Soft drop",
      "Space — Hard drop",
    ],
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
    difficulty: "Extreme",
    prizePool: "$80/wk",
    category: "brain",
    qualifyingScore: 20,
    scoreUnit: "correct flags",
    earnAmount: 0.10,
    longDescription:
      "You'll be shown a country's flag and must pick the correct country name from four options. The timer starts generous but shrinks rapidly. How many can you get right?",
    rules: [
      "Identify the country by its flag from 4 options",
      "Timer starts at 7 seconds and decreases each round",
      "Wrong answer = game over",
      "Timer running out = game over",
      "Flags get progressively more obscure",
    ],
    tips: [
      "Study African and Asian flags — they appear in later rounds",
      "Look for unique features: stars, crescents, stripes, colors",
      "Eliminate obvious wrong answers first",
    ],
    controls: ["Click / Tap — Select an answer"],
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
    difficulty: "Extreme",
    prizePool: "$300/wk",
    category: "arcade",
    qualifyingScore: 25,
    scoreUnit: "pipes",
    earnAmount: 0.20,
    longDescription:
      "Tap to keep your plane airborne while navigating through brutally narrow pipe gaps. Gravity is heavy, the gaps are tight, and pipes come fast. One touch and you crash.",
    rules: [
      "Tap or click to flap and gain altitude",
      "Navigate through gaps between pipes",
      "Touching a pipe or the ground = game over",
      "Pipe gaps are set to 88px — extremely tight",
      "Pipes spawn faster as your score increases",
    ],
    tips: [
      "Small, frequent taps give better control than big flaps",
      "Focus on the next gap, not your current position",
      "Stay near the center of each gap — don't cut it close",
    ],
    controls: ["Tap / Click / Space — Flap"],
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
    difficulty: "Extreme",
    prizePool: "$100/wk",
    category: "arcade",
    qualifyingScore: 800,
    scoreUnit: "distance",
    earnAmount: 0.15,
    longDescription:
      "Run endlessly while flipping gravity to avoid obstacles. The scroll speed starts fast and never stops accelerating. Time your flips perfectly or get crushed.",
    rules: [
      "Your character runs automatically — you control gravity",
      "Tap or click to flip between floor and ceiling",
      "Avoid spikes, pits, and moving obstacles",
      "Speed increases constantly — no breaks, no mercy",
      "One hit = game over",
    ],
    tips: [
      "Flip early — there's a brief transition time",
      "Watch for patterns in obstacle placement",
      "Don't panic flip — wait for the right moment",
    ],
    controls: ["Tap / Click / Space — Flip gravity"],
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
    difficulty: "Extreme",
    prizePool: "$75/wk",
    category: "skill",
    qualifyingScore: 7,
    scoreUnit: "wins",
    earnAmount: 0.10,
    longDescription:
      "Neon air hockey against the most brutal AI opponent. The CPU reads your moves, intercepts shots, and barely makes mistakes. Score 7 to win a match.",
    rules: [
      "Move your paddle to hit the puck into the opponent's goal",
      "First to 7 goals wins the match",
      "You play on the hardest difficulty — CPU is brutal",
      "CPU reads your moves and barely makes mistakes",
    ],
    tips: [
      "Use bank shots off the walls for unpredictable angles",
      "Don't chase the puck — position yourself defensively",
      "Quick counter-attacks after blocking work best",
    ],
    controls: ["Mouse / Touch — Move your paddle"],
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
    difficulty: "Extreme",
    prizePool: "$150/wk",
    category: "classic",
    qualifyingScore: 60,
    scoreUnit: "food eaten",
    earnAmount: 0.15,
    longDescription:
      "The classic snake game with a glowing neon twist. Eat food to grow, but the board is small and the snake gets long fast. Hit a wall or yourself and it's game over.",
    rules: [
      "Direct the snake to eat glowing food pellets",
      "The snake grows longer with each food eaten",
      "Hitting the wall or your own body = game over",
      "Speed is locked at maximum — no mercy",
      "You need 75 food to reach the winning score",
    ],
    tips: [
      "Stick to the edges early to maximize open space",
      "Plan your path 3-4 moves ahead",
      "Never trap yourself in a corner — always leave an exit",
    ],
    controls: [
      "Arrow Keys / WASD — Change direction",
      "Swipe (mobile) — Change direction",
    ],
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
    difficulty: "Extreme",
    prizePool: "$130/wk",
    category: "arcade",
    qualifyingScore: 80,
    scoreUnit: "hops",
    earnAmount: 0.15,
    longDescription:
      "Hop your way through lanes of neon traffic and glowing rivers at maximum speed. A timer counts down — each hop adds a tiny bonus. Safe zones appear rarely. One wrong step and you're roadkill.",
    rules: [
      "Tap or press to hop forward through lanes",
      "Avoid getting hit by cars and falling in water",
      "A countdown timer keeps you moving forward",
      "Each hop adds a small time bonus",
      "Safe zones appear every 7 lanes",
    ],
    tips: [
      "Time your hops with traffic patterns — don't just rush",
      "Use safe zones to catch your breath and plan ahead",
      "Look at oncoming lane speeds before committing to a hop",
    ],
    controls: [
      "↑ — Hop forward",
      "← → — Move sideways",
      "Tap (mobile) — Hop forward",
    ],
  },
]

export function getGameBySlug(slug: string): GameData | undefined {
  return games.find((g) => g.slug === slug)
}
