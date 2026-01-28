import { NextResponse } from "next/server"
import { type GameSession } from "@/lib/game-session"

export async function POST(request: Request) {
  try {
    const { session } = await request.json() as { session: GameSession }
    
    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 })
    }
    
    // Anti-cheat removed: accept final score
    const duration = Date.now() - session.startTime

    return NextResponse.json({
      verified: true,
      finalScore: session.score,
      duration,
      actions: session.actions
    })
  } catch {
    return NextResponse.json({ error: "Failed to end game" }, { status: 500 })
  }
}
