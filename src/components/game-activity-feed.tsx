"use client"

import { useState, useEffect, useRef } from "react"
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
  isReal?: boolean
}

interface RealActivity {
  id: string
  gameSlug: string
  score: number
  qualified: boolean
  earned: number
  createdAt: string
  username: string
}

function generateFakeActivity(id: number, game: GameData): Activity {
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

  return { id, name, flag, type, value, time, isReal: false }
}

function realToActivity(real: RealActivity): Activity {
  const diffMs = Date.now() - new Date(real.createdAt).getTime()
  const mins = Math.floor(diffMs / 60000)
  const time = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
  const flag = flags[Math.floor(Math.random() * flags.length)]

  return {
    id: Math.random() * 1e9,
    name: real.username,
    flag,
    type: real.qualified ? "qualified" : "scored",
    value: `${real.score} pts`,
    time,
    isReal: true,
  }
}

const typeLabels: Record<ActivityType, { label: string; color: string; icon: string }> = {
  scored: { label: "scored", color: "text-blue-400", icon: "🎯" },
  qualified: { label: "qualified with", color: "text-green-400", icon: "✅" },
  playing: { label: "", color: "text-yellow-400", icon: "🎮" },
  streak: { label: "is on a", color: "text-orange-400", icon: "🔥" },
}

export function GameActivityFeed({ game }: { game: GameData }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const realQueueRef = useRef<Activity[]>([])

  // Fetch real activity and mix into the feed
  useEffect(() => {
    async function fetchReal() {
      try {
        const res = await fetch("/api/game/activity")
        if (!res.ok) return
        const data = await res.json()
        const realActivities: RealActivity[] = data.recentActivity ?? []
        // Filter to this game if possible, fall back to any game
        const forThisGame = realActivities.filter((a) => a.gameSlug === game.slug)
        const source = forThisGame.length > 0 ? forThisGame : realActivities.slice(0, 5)
        realQueueRef.current = source.map(realToActivity)
      } catch { /* ignore */ }
    }
    fetchReal()
  }, [game.slug])

  useEffect(() => {
    // Seed with a mix: if we have real data, interleave
    const initial: Activity[] = []
    const realItems = realQueueRef.current.slice(0, 3)
    for (let i = 0; i < 8; i++) {
      if (i < realItems.length && realItems[i]) {
        initial.push(realItems[i])
      } else {
        initial.push(generateFakeActivity(i, game))
      }
    }
    setActivities(initial)

    let tickCount = 0
    const interval = setInterval(() => {
      tickCount++
      setActivities((prev) => {
        // Every 3rd tick, try to inject a real activity
        const realQueue = realQueueRef.current
        let next: Activity
        if (tickCount % 3 === 0 && realQueue.length > 0) {
          const idx = tickCount % realQueue.length
          next = { ...realQueue[idx], id: Date.now() }
        } else {
          next = generateFakeActivity(Date.now(), game)
        }
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
