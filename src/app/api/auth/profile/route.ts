import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

function getCurrentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split("T")[0]
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.username === "string") {
      const username = body.username.trim().toLowerCase()
      if (username.length < 3 || username.length > 30) {
        return NextResponse.json({ error: "Username must be 3-30 characters" }, { status: 400 })
      }
      if (!/^[a-z0-9_-]+$/.test(username)) {
        return NextResponse.json({ error: "Username can only contain letters, numbers, _ and -" }, { status: 400 })
      }
      // Check uniqueness
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", user.id)
        .single()
      if (existing) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 })
      }
      updates.username = username
    }

    if (typeof body.display_name === "string") {
      const display_name = body.display_name.trim()
      if (display_name.length > 50) {
        return NextResponse.json({ error: "Display name must be 50 characters or less" }, { status: 400 })
      }
      updates.display_name = display_name || null
    }

    if (typeof body.bio === "string") {
      const bio = body.bio.trim()
      if (bio.length > 200) {
        return NextResponse.json({ error: "Bio must be 200 characters or less" }, { status: 400 })
      }
      updates.bio = bio
    }

    if (typeof body.avatar_url === "string") {
      if (body.avatar_url.length > 500_000) {
        return NextResponse.json({ error: "Avatar too large" }, { status: 400 })
      }
      updates.avatar_url = body.avatar_url
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url, bio, subscription_tier, subscription_expires_at, created_at")
      .eq("id", user.id)
      .single()

    // Fetch current week earnings
    const weekStart = getCurrentWeekStart()
    const { data: weeklyEarnings } = await supabase
      .from("weekly_earnings")
      .select("total_earned, plays, week_start")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .single()

    // Fetch all-time earnings
    const { data: allTimeEarnings } = await supabase
      .from("weekly_earnings")
      .select("total_earned, plays")
      .eq("user_id", user.id)

    const totalEarned = allTimeEarnings
      ? allTimeEarnings.reduce((sum, row) => sum + Number(row.total_earned), 0)
      : 0
    const totalPlays = allTimeEarnings
      ? allTimeEarnings.reduce((sum, row) => sum + (row.plays ?? 0), 0)
      : 0

    // Fetch recent game sessions (last 50)
    const { data: recentSessions, error: sessionsError } = await supabase
      .from("game_sessions")
      .select("id, game_slug, score, duration_ms, actions, qualified, earned, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (sessionsError) {
      console.error("Failed to fetch game sessions:", sessionsError.message)
    }

    // Fetch per-game stats
    const { data: allSessions, error: allSessionsError } = await supabase
      .from("game_sessions")
      .select("game_slug, score, qualified, earned")
      .eq("user_id", user.id)

    if (allSessionsError) {
      console.error("Failed to fetch all sessions:", allSessionsError.message)
    }

    const gameStats: Record<string, { plays: number; bestScore: number; totalEarned: number; qualifiedCount: number }> = {}
    if (allSessions) {
      for (const s of allSessions) {
        if (!gameStats[s.game_slug]) {
          gameStats[s.game_slug] = { plays: 0, bestScore: 0, totalEarned: 0, qualifiedCount: 0 }
        }
        const g = gameStats[s.game_slug]
        g.plays++
        g.bestScore = Math.max(g.bestScore, s.score)
        g.totalEarned += Number(s.earned ?? 0)
        if (s.qualified) g.qualifiedCount++
      }
    }

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email,
        ...profile,
      },
      earnings: {
        weeklyTotal: weeklyEarnings ? Number(weeklyEarnings.total_earned) : 0,
        weeklyPlays: weeklyEarnings?.plays ?? 0,
        weekStart,
        allTimeTotal: Math.round(totalEarned * 100) / 100,
        allTimePlays: totalPlays,
      },
      recentSessions: recentSessions ?? [],
      gameStats,
    })
  } catch (err) {
    console.error("Profile route error:", err)
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
  }
}
