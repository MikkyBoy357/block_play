import { createHmac, randomBytes } from "crypto"

const SECRET_KEY = process.env.GAME_SECRET_KEY || "blockplay-secret-key-change-in-production"

export interface GameSession {
  sessionId: string
  gameId: string
  startTime: number
  lastActionTime: number
  score: number
  actions: number
  checksum: string
}

export function createGameSession(gameId: string): GameSession {
  const sessionId = randomBytes(16).toString("hex")
  const startTime = Date.now()
  
  const session: GameSession = {
    sessionId,
    gameId,
    startTime,
    lastActionTime: startTime,
    score: 0,
    actions: 0,
    checksum: "",
  }
  
  session.checksum = generateChecksum(session)
  return session
}

export function generateChecksum(session: Omit<GameSession, "checksum">): string {
  const data = `${session.sessionId}:${session.gameId}:${session.startTime}:${session.score}:${session.actions}`
  return createHmac("sha256", SECRET_KEY).update(data).digest("hex")
}

export function verifyChecksum(session: GameSession): boolean {
  const expectedChecksum = generateChecksum({
    sessionId: session.sessionId,
    gameId: session.gameId,
    startTime: session.startTime,
    lastActionTime: session.lastActionTime,
    score: session.score,
    actions: session.actions,
  })
  return session.checksum === expectedChecksum
}

export function validateAction(session: GameSession, currentTime: number): { valid: boolean; reason?: string } {
  // Check if session is valid
  if (!verifyChecksum(session)) {
    return { valid: false, reason: "Invalid session checksum" }
  }
  
  // Check minimum time between actions (prevent impossible tap speeds)
  // Minimum 50ms between taps is humanly impossible to sustain
  const timeSinceLastAction = currentTime - session.lastActionTime
  if (timeSinceLastAction < 50) {
    return { valid: false, reason: "Action too fast" }
  }
  
  // Check if game session is too old (max 30 minutes)
  const sessionDuration = currentTime - session.startTime
  if (sessionDuration > 30 * 60 * 1000) {
    return { valid: false, reason: "Session expired" }
  }
  
  // Check score vs actions ratio (each action should give 1 point max)
  if (session.score > session.actions + 1) {
    return { valid: false, reason: "Invalid score" }
  }
  
  return { valid: true }
}

export function updateSession(session: GameSession, scoreIncrement: number): GameSession {
  const updatedSession: GameSession = {
    ...session,
    lastActionTime: Date.now(),
    score: session.score + scoreIncrement,
    actions: session.actions + 1,
    checksum: "",
  }
  
  updatedSession.checksum = generateChecksum(updatedSession)
  return updatedSession
}
