"use client"

import { useEffect, useState } from "react"
import { Sparkles, Zap, Trophy, DollarSign, Users, Crown, ArrowRight, Gamepad2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const words = ["Play", "Compete", "Win", "Cash Out"]
const liveWinners = [
  { name: "Alex K.", game: "Tetris", prize: "$120", flag: "🇺🇸" },
  { name: "Yuki T.", game: "Pac-Man", prize: "$85", flag: "🇯🇵" },
  { name: "Priya S.", game: "Snake", prize: "$200", flag: "🇮🇳" },
  { name: "Carlos M.", game: "Flappy Plane", prize: "$65", flag: "🇧🇷" },
  { name: "Jin W.", game: "Brick Break", prize: "$150", flag: "🇰🇷" },
  { name: "Emma L.", game: "Basketball", prize: "$95", flag: "🇬🇧" },
]

export function WelcomeHero() {
  const [currentWord, setCurrentWord] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [winnerIndex, setWinnerIndex] = useState(0)

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

  useEffect(() => {
    const interval = setInterval(() => {
      setWinnerIndex((prev) => (prev + 1) % liveWinners.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const currentWinner = liveWinners[winnerIndex]

  return (
    <section className="pt-24 pb-8 md:pt-32 md:pb-16 px-4 relative">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-neon-purple/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-neon-blue/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto text-center relative z-10">
        {/* Live winner ticker */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/20 mb-6 md:mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground">
            <span className="text-primary font-semibold">{currentWinner.flag} {currentWinner.name}</span>
            {" "}just won{" "}
            <span className="text-green-400 font-bold">{currentWinner.prize}</span>
            {" "}playing {currentWinner.game}
          </span>
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black mb-4 md:mb-6 text-balance leading-tight">
          <span className="text-foreground">Your Childhood Games.</span>
          <br />
          <span className="text-foreground">Real </span>
          <span
            className={`inline-block text-primary neon-text transition-all duration-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            }`}
          >
            {words[currentWord]}
          </span>
          <span className="text-foreground">.</span>
        </h1>

        <p className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 md:mb-10 text-pretty leading-relaxed">
          Subscribe, compete in the games you grew up loving, climb the leaderboards,
          and <span className="text-primary font-medium">win real cash prizes</span> every week. It&apos;s that simple.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10 md:mb-14">
          <a href="#pricing">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-base font-bold px-8 py-6 rounded-xl hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] transition-all duration-300 animate-pulse-ring"
            >
              <Crown className="w-5 h-5" />
              Start Winning — $1.99/week
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
          <a href="#games">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-border/60 hover:border-primary/50 hover:bg-primary/5 gap-2 text-base px-8 py-6 rounded-xl transition-all duration-300"
            >
              <Gamepad2 className="w-5 h-5" />
              Browse Games
            </Button>
          </a>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto">
          {[
            { icon: Users, label: "Active Players", value: "24,500+", color: "text-neon-blue" },
            { icon: DollarSign, label: "Paid Out", value: "$185K+", color: "text-green-400" },
            { icon: Trophy, label: "Weekly Winners", value: "500+", color: "text-gold" },
            { icon: Zap, label: "Games Available", value: "13", color: "text-neon-purple" },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl glass hover:bg-white/[0.04] transition-all duration-300 group cursor-default"
              style={{ animationDelay: `${index * 100}ms`, animation: "fadeInUp 0.5s ease-out forwards", opacity: 0 }}
            >
              <stat.icon className={`w-5 h-5 ${stat.color} group-hover:scale-110 transition-transform`} />
              <div className={`text-xl sm:text-2xl font-black ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
