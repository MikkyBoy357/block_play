"use client"

import { useState } from "react"
import { Check, Crown, Zap, Star, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSound } from "@/hooks/use-sound"

const plans = [
  {
    id: "weekly",
    name: "Weekly",
    price: "$1.99",
    period: "/week",
    description: "Try it out, no commitment",
    badge: null,
    color: "from-neon-blue to-primary",
    features: [
      "Access all 13 games",
      "Weekly leaderboard entry",
      "Win cash prizes",
      "Basic player profile",
      "Community chat",
    ],
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "$4.99",
    period: "/month",
    originalPrice: "$7.96",
    savings: "Save 37%",
    description: "Most popular for serious players",
    badge: "MOST POPULAR",
    color: "from-primary to-neon-purple",
    features: [
      "Everything in Weekly",
      "Priority matchmaking",
      "Monthly bonus tournaments",
      "Advanced stats dashboard",
      "Custom avatar & flair",
      "2x leaderboard points",
    ],
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$49.99",
    period: "/year",
    originalPrice: "$103.48",
    savings: "Save 52%",
    description: "Best value for dedicated competitors",
    badge: "BEST VALUE",
    color: "from-gold to-neon-orange",
    features: [
      "Everything in Monthly",
      "Exclusive seasonal tournaments",
      "Early access to new games",
      "VIP badge on leaderboard",
      "5x leaderboard points",
      "Priority cash-out",
      "Invite friends for bonus rewards",
    ],
  },
]

export function PricingSection() {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null)
  const { playHover, playClick } = useSound()

  return (
    <section id="pricing" className="py-16 md:py-24 px-4 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto relative z-10">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/20 mb-4">
            <Crown className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Simple Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mb-4">
            Pick Your Plan. <span className="text-primary neon-text">Start Winning.</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            One subscription unlocks every game. The higher your plan, the more you earn.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const isPopular = plan.badge === "MOST POPULAR"
            const isBest = plan.badge === "BEST VALUE"
            const isHighlighted = isPopular

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-[1px] transition-all duration-500 ${
                  isHighlighted
                    ? "bg-gradient-to-b from-primary via-primary/50 to-primary/20 scale-[1.02] md:scale-105"
                    : "bg-border/30 hover:bg-border/60"
                }`}
                style={{
                  animationDelay: `${index * 150}ms`,
                  animation: "fadeInUp 0.6s ease-out forwards",
                  opacity: 0,
                }}
                onMouseEnter={() => { setHoveredPlan(plan.id); playHover() }}
                onMouseLeave={() => setHoveredPlan(null)}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-1 rounded-full text-xs font-bold tracking-wider ${
                    isPopular ? "bg-primary text-primary-foreground" : "bg-gradient-to-r from-gold to-neon-orange text-black"
                  }`}>
                    {plan.badge}
                  </div>
                )}

                <div className={`rounded-2xl p-6 md:p-8 h-full flex flex-col ${
                  isHighlighted ? "bg-card" : "bg-card/80"
                }`}>
                  {/* Plan name */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-foreground mb-1">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl md:text-5xl font-black text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    </div>
                    {plan.originalPrice && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-muted-foreground line-through">{plan.originalPrice}</span>
                        <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                          {plan.savings}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-grow">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    className={`w-full gap-2 py-6 rounded-xl font-bold text-base transition-all duration-300 ${
                      isHighlighted
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(0,255,136,0.3)]"
                        : "bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20"
                    }`}
                    onClick={playClick}
                    onMouseEnter={playHover}
                  >
                    {isHighlighted ? <Zap className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    {isHighlighted ? "Get Started Now" : "Choose Plan"}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Trust badge */}
        <div className="text-center mt-8 md:mt-12">
          <p className="text-sm text-muted-foreground">
            Cancel anytime &bull; Instant access &bull; Secure payment &bull; No hidden fees
          </p>
        </div>
      </div>
    </section>
  )
}
