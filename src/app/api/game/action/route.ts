import { NextResponse } from "next/server"
import { validateAction, updateSession, type GameSession } from "@/lib/game-session"

export async function POST(request: Request) {
  try {
    const { session, action } = await request.json() as { session: GameSession; action: string }
    
    if (!session || !action) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    
    const currentTime = Date.now()
    const validation = validateAction(session, currentTime)
    
    if (!validation.valid) {
      return NextResponse.json({ 
        error: "Action rejected", 
        reason: validation.reason,
        cheatingDetected: true 
      }, { status: 403 })
    }
    
    // Update session with new score
    const scoreIncrement = action === "tap" ? 1 : 0
    const updatedSession = updateSession(session, scoreIncrement)
    
    return NextResponse.json({ session: updatedSession })
  } catch {
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 })
  }
}
