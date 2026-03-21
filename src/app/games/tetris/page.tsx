import { TetrisPageClient } from "./client"

export const metadata = {
  title: "Tetris - blockPlay",
  description: "Stack blocks, clear lines, chase the high score!",
}

export default function TetrisPage() {
  return <TetrisPageClient />
}
