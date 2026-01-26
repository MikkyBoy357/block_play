import { NextResponse } from "next/server"
import { verifyChecksum, type GameSession } from "@/lib/game-session"

export async function POST(request: Request) {
  try {
    const { session } = await request.json() as { session: GameSession }
    
    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 })
    }
    
    // Verify final score
    if (!verifyChecksum(session)) {
      return NextResponse.json({ 
        error: "Score verification failed",
        cheatingDetected: true 
      }, { status: 403 })
    }
    
    // Calculate game duration
    const duration = Date.now() - session.startTime
    
    // Additional validation: average time per action should be reasonable
    // A human can tap roughly 8-12 times per second max
    const avgTimePerAction = duration / Math.max(session.actions, 1)
    if (avgTimePerAction < 80) { // Less than 80ms average = likely bot
      return NextResponse.json({ 
        error: "Suspicious gameplay detected",
        cheatingDetected: true 
      }, { status: 403 })
    }
    
    // Score is valid - in production you would save to database here
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
