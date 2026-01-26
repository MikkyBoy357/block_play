import { Header } from "@/components/header"
import { WelcomeHero } from "@/components/welcome-hero"
import { GameGrid } from "@/components/game-grid"
import { FloatingParticles } from "@/components/floating-particles"

export default function Home() {
  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      <FloatingParticles />
      <div className="relative z-10">
        <Header />
        <WelcomeHero />
        <GameGrid />
      </div>
    </main>
  )
}
