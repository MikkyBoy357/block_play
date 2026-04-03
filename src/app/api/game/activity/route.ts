import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch recent winners for live ticker / hero
    const { data: recentWinners } = await supabase
      .from("recent_winners")
      .select("*")
      .limit(20)

    // Fetch recent game sessions (all users, for activity feed)
    const { data: recentActivity } = await supabase
      .from("game_sessions")
      .select("id, game_slug, score, qualified, earned, created_at, profiles!inner(username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(30)

    return NextResponse.json({
      recentWinners: recentWinners ?? [],
      recentActivity: (recentActivity ?? []).map((row) => {
        const profile = row.profiles as unknown as { username: string | null; display_name: string | null; avatar_url: string | null }
        return {
          id: row.id,
          gameSlug: row.game_slug,
          score: row.score,
          qualified: row.qualified,
          earned: Number(row.earned),
          createdAt: row.created_at,
          username: profile?.username ?? profile?.display_name ?? "Anonymous",
          avatarUrl: profile?.avatar_url,
        }
      }),
    })
  } catch {
    return NextResponse.json({ recentWinners: [], recentActivity: [] })
  }
}
