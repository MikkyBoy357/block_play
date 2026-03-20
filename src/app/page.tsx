import { Header } from "@/components/header"
import { WelcomeHero } from "@/components/welcome-hero"
import { LiveTicker } from "@/components/live-ticker"
import { GameGrid } from "@/components/game-grid"
import { LeaderboardSection } from "@/components/leaderboard-section"
import { HowItWorksSection } from "@/components/how-it-works-section"
import { PricingSection } from "@/components/pricing-section"
import { TestimonialsSection } from "@/components/testimonials-section"
import { CTABanner } from "@/components/cta-banner"
import { Footer } from "@/components/footer"
import { FloatingParticles } from "@/components/floating-particles"

export default function Home() {
  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      <FloatingParticles />
      <div className="relative z-10">
        <Header />
        <WelcomeHero />
        <LiveTicker />
        <GameGrid />
        <HowItWorksSection />
        <LeaderboardSection />
        <PricingSection />
        <TestimonialsSection />
        <CTABanner />
        <Footer />
      </div>
    </main>
  )
}
