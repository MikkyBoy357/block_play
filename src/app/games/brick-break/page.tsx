import { BrickBreakGame } from "@/components/games/brick-break"

export const metadata = {
  title: "Brick Break - blockPlay",
  description: "Smash bricks, dodge power-ups, survive the chaos. How long can you last?",
}

export default function BrickBreakPage() {
  return <BrickBreakGame />
}
