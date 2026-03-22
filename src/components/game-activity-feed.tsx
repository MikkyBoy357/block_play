"use client"

import { useState, useEffect } from "react"
import type { GameData } from "@/lib/game-data"

const firstNames = [
  "Alex", "Mia", "Kai", "Luna", "Oscar", "Zara", "Leo", "Nia",
  "Jay", "Ava", "Ryu", "Emi", "Sam", "Ivy", "Max", "Rio",
  "Dev", "Lia", "Tom", "Ada", "Jin", "Eve", "Dan", "Zoe",
]

const flags = ["🇺🇸", "🇬🇧", "🇳🇬", "🇧🇷", "🇯🇵", "🇩🇪", "🇫🇷", "🇮🇳", "🇰🇷", "🇦🇺", "🇨🇦", "🇲🇽", "🇿🇦", "🇪🇸", "🇮🇹", "🇵🇭"]

type ActivityType = "scored" | "qualified" | "playing" | "streak"

interface Activity {
  id: number
  name: string
  flag: string
  type: ActivityType
  value: string
  time: string
}

function generateActivity(id: number, game: GameData): Activity {
  const name = firstNames[Math.floor(Math.random() * firstNames.length)]
  const flag = flags[Math.floor(Math.random() * flags.length)]
  const types: ActivityType[] = ["scored", "qualified", "playing", "streak"]
  const type = types[Math.floor(Math.random() * types.length)]

  const baseScore = game.qualifyingScore
  let value = ""

  switch (type) {
    case "scored":
      value = `${Math.floor(baseScore * (0.4 + Math.random() * 1.2))} ${game.scoreUnit}`
      break
    case "qualified":
      value = `${Math.floor(baseScore * (1 + Math.random() * 0.5))} ${game.scoreUnit}`
      break
    case "playing":
      value = "started a game"
      break
    case "streak":
      value = `${Math.floor(2 + Math.random() * 8)} game win streak`
      break
  }

  const mins = Math.floor(Math.random() * 30) + 1
  const time = mins === 1 ? "just now" : `${mins}m ago`

  return { id, name, flag, type, value, time }
}

const typeLabels: Record<ActivityType, { label: string; color: string; icon: string }> = {
  scored: { label: "scored", color: "text-blue-400", icon: "🎯" },
  qualified: { label: "qualified with", color: "text-green-400", icon: "✅" },
  playing: { label: "", color: "text-yellow-400", icon: "🎮" },
  streak: { label: "is on a", color: "text-orange-400", icon: "🔥" },
}

export function GameActivityFeed({ game }: { game: GameData }) {
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    const initial = Array.from({ length: 8 }, (_, i) => generateActivity(i, game))
    setActivities(initial)

    const interval = setInterval(() => {
      setActivities((prev) => {
        const next = generateActivity(Date.now(), game)
        return [next, ...prev.slice(0, 7)]
      })
    }, 4000)

    return () => clearInterval(interval)
  }, [game])

  return (
    <div className="space-y-2">
      {activities.map((activity, index) => {
        const meta = typeLabels[activity.type]
        return (
          <div
            key={activity.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg glass border border-border/30 text-sm transition-all duration-300"
            style={{
              opacity: 1 - index * 0.08,
              animation: index === 0 ? "fadeInUp 0.3s ease-out" : undefined,
            }}
          >
            <span className="text-base shrink-0">{meta.icon}</span>
            <span className="truncate">
              <span className="font-semibold text-foreground">
                {activity.flag} {activity.name}
              </span>{" "}
              <span className="text-muted-foreground">
                {meta.label}{" "}
              </span>
              <span className={`font-medium ${meta.color}`}>
                {activity.value}
              </span>
            </span>
            <span className="text-xs text-muted-foreground/60 ml-auto shrink-0">
              {activity.time}
            </span>
          </div>
        )
      })}
    </div>
  )
}
