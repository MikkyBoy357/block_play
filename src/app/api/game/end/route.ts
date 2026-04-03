import { NextResponse } from "next/server"
import { type GameSession } from "@/lib/game-session"
import { createClient } from "@/utils/supabase/server"
import { getGameBySlug, SUBSCRIPTION_TIERS } from "@/lib/game-data"
import { calculateEarning } from "@/lib/earnings"

function getCurrentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split("T")[0]
}

export async function POST(request: Request) {
  try {
    const { session, finalScore: clientScore } = await request.json() as { session: GameSession; finalScore?: number }
    
    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 })
    }
    
    const duration = Date.now() - session.startTime
    // Use client-reported score if provided (games track score locally),
    // otherwise fall back to server-tracked session score
    const finalScore = typeof clientScore === "number" && clientScore >= 0 ? clientScore : session.score
    const game = getGameBySlug(session.gameId)
    const qualified = game ? finalScore >= game.qualifyingScore : false

    // Try to persist for logged-in users
    let earned = 0
    let totalWeekly = 0
    let capped = false

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Ensure profile exists for this user (may be missing for pre-trigger signups)
    if (user) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single()

      if (!existingProfile) {
        await supabase.from("profiles").upsert({
          id: user.id,
          username: user.user_metadata?.username ?? user.email?.split("@")[0] ?? null,
          display_name: user.user_metadata?.display_name ?? user.user_metadata?.username ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        }, { onConflict: "id" })
      }
    }

    if (user && game && qualified) {
      // Get user profile for subscription tier
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single()

      const tier = profile?.subscription_tier as keyof typeof SUBSCRIPTION_TIERS | null
      if (tier && SUBSCRIPTION_TIERS[tier]) {
        const tierConfig = SUBSCRIPTION_TIERS[tier]
        const weekStart = getCurrentWeekStart()

        // Get current weekly earnings
        const { data: weeklyRow } = await supabase
          .from("weekly_earnings")
          .select("total_earned, plays")
          .eq("user_id", user.id)
          .eq("week_start", weekStart)
          .single()

        const currentEarned = weeklyRow ? Number(weeklyRow.total_earned) : 0
        const currentPlays = weeklyRow ? weeklyRow.plays : 0

        const rawEarning = calculateEarning(finalScore, game.qualifyingScore, game.earnAmount)
        const remaining = Math.max(0, tierConfig.maxWeeklyEarning - currentEarned)
        earned = Math.round(Math.min(rawEarning, remaining) * 100) / 100
        capped = earned < rawEarning

        if (earned > 0) {
          totalWeekly = Math.round((currentEarned + earned) * 100) / 100

          // Upsert weekly earnings
          await supabase
            .from("weekly_earnings")
            .upsert({
              user_id: user.id,
              week_start: weekStart,
              total_earned: totalWeekly,
              plays: currentPlays + 1,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id,week_start" })
        } else {
          totalWeekly = currentEarned
        }
      }
    }

    // Save game session to DB for logged-in users
    let saved = false
    if (user) {
      const { error: insertError } = await supabase.from("game_sessions").insert({
        user_id: user.id,
        game_slug: session.gameId,
        score: finalScore,
        duration_ms: duration,
        actions: session.actions,
        verified: true,
        qualified,
        earned,
      })
      saved = !insertError
      if (insertError) {
        console.error("Failed to save game session:", insertError.message)
      }
    }

    return NextResponse.json({
      verified: true,
      finalScore,
      duration,
      actions: session.actions,
      earned,
      totalWeekly,
      qualified,
      capped,
      saved,
    })
  } catch (err) {
    console.error("Game end error:", err)
    return NextResponse.json({ error: "Failed to end game" }, { status: 500 })
  }
}
