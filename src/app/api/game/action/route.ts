import { NextResponse } from "next/server"
import { updateSession, type GameSession } from "@/lib/game-session"

export async function POST(request: Request) {
  try {
    const { session, action, scoreIncrement: clientIncrement } = await request.json() as { session: GameSession; action: string; scoreIncrement?: number }
    
    if (!session || !action) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    
    // Use client-provided increment if valid, otherwise default to 1 for "tap"
    const scoreIncrement = typeof clientIncrement === "number" && clientIncrement >= 0 ? clientIncrement : (action === "tap" ? 1 : 0)
    const updatedSession = updateSession(session, scoreIncrement)

    return NextResponse.json({ session: updatedSession })
  } catch {
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 })
  }
}
