"use client"

import { useEffect, useState } from "react"
import { Trophy, Clock, DollarSign, Flame, TrendingUp, Zap } from "lucide-react"

export function LiveTicker() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 })

  useEffect(() => {
    const calcTimeLeft = () => {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek
      const nextMonday = new Date(now)
      nextMonday.setDate(now.getDate() + daysUntilMonday)
      nextMonday.setHours(0, 0, 0, 0)
      const diff = nextMonday.getTime() - now.getTime()

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
        secs: Math.floor((diff / 1000) % 60),
      }
    }

    setTimeLeft(calcTimeLeft())
    const interval = setInterval(() => setTimeLeft(calcTimeLeft()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="py-8 px-4 border-y border-border/20">
      <div className="container mx-auto">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Prize pool */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">This Week&apos;s Prize Pool</div>
              <div className="text-2xl sm:text-3xl font-black text-green-400">$2,455</div>
            </div>
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-neon-purple" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Payout In</div>
              <div className="flex items-center gap-2 font-mono">
                {[
                  { val: timeLeft.days, label: "d" },
                  { val: timeLeft.hours, label: "h" },
                  { val: timeLeft.mins, label: "m" },
                  { val: timeLeft.secs, label: "s" },
                ].map((unit) => (
                  <div key={unit.label} className="flex items-baseline gap-0.5">
                    <span className="text-xl sm:text-2xl font-black text-foreground">
                      {String(unit.val).padStart(2, "0")}
                    </span>
                    <span className="text-xs text-muted-foreground">{unit.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <div>
                <div className="text-sm font-bold text-foreground">1,847</div>
                <div className="text-xs text-muted-foreground">Playing Now</div>
              </div>
            </div>
            <div className="w-px h-8 bg-border/30" />
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div>
                <div className="text-sm font-bold text-foreground">12,340</div>
                <div className="text-xs text-muted-foreground">Games Today</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
