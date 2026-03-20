"use client"

import { Crown, Gamepad2, Trophy, DollarSign, ArrowRight } from "lucide-react"

const steps = [
  {
    step: 1,
    icon: Crown,
    title: "Subscribe",
    description: "Choose a weekly, monthly, or yearly plan that fits you. Instant access to all games.",
    color: "from-primary to-neon-blue",
    accent: "text-primary",
  },
  {
    step: 2,
    icon: Gamepad2,
    title: "Play & Compete",
    description: "Jump into any of our 13 classic games. Each game tracks your high score on the global leaderboard.",
    color: "from-neon-purple to-neon-pink",
    accent: "text-neon-purple",
  },
  {
    step: 3,
    icon: Trophy,
    title: "Climb the Ranks",
    description: "Score big, build streaks, and rise through the leaderboard. Top players earn VIP status.",
    color: "from-gold to-neon-orange",
    accent: "text-gold",
  },
  {
    step: 4,
    icon: DollarSign,
    title: "Win Cash Prizes",
    description: "Every week, top leaderboard players win real cash prizes. The harder you play, the more you earn.",
    color: "from-green-400 to-emerald-500",
    accent: "text-green-400",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 md:py-24 px-4 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-0 w-72 h-72 bg-neon-purple/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto relative z-10">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-neon-purple/20 mb-4">
            <Gamepad2 className="w-4 h-4 text-neon-purple" />
            <span className="text-sm text-neon-purple font-medium">How It Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mb-4">
            Four Steps to <span className="text-primary neon-text">Victory</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Getting started is easy. Winning takes skill.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.step}
              className="relative group"
              style={{ animationDelay: `${index * 150}ms`, animation: "fadeInUp 0.6s ease-out forwards", opacity: 0 }}
            >
              {/* Connector line (hidden on last and mobile) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-[2px] bg-gradient-to-r from-border/60 to-border/20 z-0" />
              )}

              <div className="relative z-10 flex flex-col items-center text-center p-6 rounded-2xl glass hover:bg-white/[0.04] transition-all duration-300">
                {/* Step number */}
                <div className="absolute -top-3 -right-1 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center">
                  <span className="text-xs font-bold text-muted-foreground">{step.step}</span>
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} p-[1px] mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center">
                    <step.icon className={`w-7 h-7 ${step.accent}`} />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
