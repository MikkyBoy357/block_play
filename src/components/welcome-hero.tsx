"use client"

import { useEffect, useState } from "react"
import { Sparkles, Zap, Trophy } from "lucide-react"

const words = ["Play", "Win", "Earn", "Level Up"]

export function WelcomeHero() {
  const [currentWord, setCurrentWord] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false)
      setTimeout(() => {
        setCurrentWord((prev) => (prev + 1) % words.length)
        setIsVisible(true)
      }, 200)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="pt-32 pb-16 px-4">
      <div className="container mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-8 animate-pulse">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-medium">Web3 Gaming Awaits</span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-balance">
          <span className="text-foreground">Ready to </span>
          <span
            className={`inline-block text-primary transition-all duration-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            }`}
          >
            {words[currentWord]}
          </span>
          <span className="text-foreground">?</span>
        </h1>

        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-12 text-pretty">
          Jump into browser-based games, compete with players worldwide, and earn rewards. Your next high score is just
          a click away.
        </p>

        <div className="flex flex-wrap justify-center gap-8 text-sm">
          {[
            { icon: Zap, label: "Instant Play", value: "No Download" },
            { icon: Trophy, label: "Global Rankings", value: "Live Scores" },
            { icon: Sparkles, label: "Rewards", value: "Coming Soon" },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 px-4 py-2 rounded-lg bg-card/50 border border-border/50"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <stat.icon className="w-5 h-5 text-primary" />
              <div className="text-left">
                <div className="text-foreground font-medium">{stat.label}</div>
                <div className="text-muted-foreground text-xs">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
