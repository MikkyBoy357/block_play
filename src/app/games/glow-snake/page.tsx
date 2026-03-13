import { GlowSnakeGame } from "@/components/games/glow-snake"

export const metadata = {
  title: "Glow Snake - blockPlay",
  description: "Neon snake with glow effects, particles, and SFX. Eat to grow, avoid walls and yourself!",
}

export default function GlowSnakePage() {
  return <GlowSnakeGame />
}
