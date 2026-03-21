import { SUBSCRIPTION_TIERS, type SubscriptionTier } from "./game-data"

const STORAGE_KEY = "blockplay_weekly_earnings"

interface WeeklyEarnings {
  weekStart: string // ISO date of Monday
  totalEarned: number
  plays: number // total qualifying plays this week
}

function getCurrentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = 0
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split("T")[0]
}

function getWeeklyEarnings(): WeeklyEarnings {
  if (typeof window === "undefined") {
    return { weekStart: getCurrentWeekStart(), totalEarned: 0, plays: 0 }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return { weekStart: getCurrentWeekStart(), totalEarned: 0, plays: 0 }
    }

    const data: WeeklyEarnings = JSON.parse(stored)

    // Reset if it's a new week
    if (data.weekStart !== getCurrentWeekStart()) {
      return { weekStart: getCurrentWeekStart(), totalEarned: 0, plays: 0 }
    }

    return data
  } catch {
    return { weekStart: getCurrentWeekStart(), totalEarned: 0, plays: 0 }
  }
}

function saveWeeklyEarnings(earnings: WeeklyEarnings): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(earnings))
}

/**
 * Calculate how much a player earns based on their score.
 *
 * Earning scales with score:
 *   multiplier = floor(finalScore / qualifyingScore)
 *   earning    = multiplier × earnAmount
 *
 * Example: qualifyingScore=60, earnAmount=$0.10, score=180 → 3×$0.10 = $0.30
 *
 * The result is then capped so the user never earns more than their
 * subscription fee per week.
 */
export function calculateEarning(
  finalScore: number,
  qualifyingScore: number,
  earnAmount: number,
): number {
  if (finalScore < qualifyingScore) return 0
  const multiplier = Math.floor(finalScore / qualifyingScore)
  return Math.round(multiplier * earnAmount * 100) / 100
}

/**
 * Check if a user can still earn this week (haven't hit the cap).
 */
export function canEarn(
  subscriptionTier: SubscriptionTier
): { canEarn: boolean; remaining: number; reason?: string } {
  const earnings = getWeeklyEarnings()
  const tierConfig = SUBSCRIPTION_TIERS[subscriptionTier]
  const remaining = Math.max(0, Math.round((tierConfig.maxWeeklyEarning - earnings.totalEarned) * 100) / 100)

  if (remaining <= 0) {
    return { canEarn: false, remaining: 0, reason: "Weekly earning cap reached" }
  }

  return { canEarn: true, remaining }
}

/**
 * Record an earning from a game play. Called every time the player
 * finishes a game and qualifies. Earning is scaled by score and
 * capped to never exceed the weekly subscription limit.
 */
export function recordGameEarning(
  finalScore: number,
  qualifyingScore: number,
  earnAmount: number,
  subscriptionTier: SubscriptionTier
): { earned: number; totalWeekly: number; capped: boolean; multiplier: number } {
  const earnings = getWeeklyEarnings()
  const tierConfig = SUBSCRIPTION_TIERS[subscriptionTier]

  const rawEarning = calculateEarning(finalScore, qualifyingScore, earnAmount)
  if (rawEarning <= 0) {
    return { earned: 0, totalWeekly: earnings.totalEarned, capped: false, multiplier: 0 }
  }

  const multiplier = Math.floor(finalScore / qualifyingScore)

  // Cap to not exceed weekly limit
  const remainingCap = Math.max(0, tierConfig.maxWeeklyEarning - earnings.totalEarned)
  const actualEarning = Math.round(Math.min(rawEarning, remainingCap) * 100) / 100

  if (actualEarning <= 0) {
    return { earned: 0, totalWeekly: earnings.totalEarned, capped: true, multiplier }
  }

  earnings.totalEarned = Math.round((earnings.totalEarned + actualEarning) * 100) / 100
  earnings.plays += 1

  saveWeeklyEarnings(earnings)

  return {
    earned: actualEarning,
    totalWeekly: earnings.totalEarned,
    capped: actualEarning < rawEarning,
    multiplier,
  }
}

/**
 * Get the user's current weekly earnings summary.
 */
export function getEarningsSummary(subscriptionTier: SubscriptionTier) {
  const earnings = getWeeklyEarnings()
  const tierConfig = SUBSCRIPTION_TIERS[subscriptionTier]

  return {
    totalEarned: earnings.totalEarned,
    maxWeeklyEarning: tierConfig.maxWeeklyEarning,
    remaining: Math.max(0, Math.round((tierConfig.maxWeeklyEarning - earnings.totalEarned) * 100) / 100),
    plays: earnings.plays,
    weekStart: earnings.weekStart,
  }
}
