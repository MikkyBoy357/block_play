import { NextResponse } from "next/server"
import { createGameSession } from "@/lib/game-session"

export async function POST(request: Request) {
  try {
    const { gameId } = await request.json()
    
    if (!gameId || typeof gameId !== "string") {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 })
    }
    
    const session = createGameSession(gameId)
    
    return NextResponse.json({ session })
  } catch {
    return NextResponse.json({ error: "Failed to start game" }, { status: 500 })
  }
}
