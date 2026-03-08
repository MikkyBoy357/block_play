import { FlappyPlaneGame } from "@/components/games/flappy-plane"

export const metadata = {
  title: "Flappy Plane - blockPlay",
  description: "Tap to fly through the pipes! A classic flappy bird style game with a plane.",
}

export default function FlappyPlanePage() {
  return <FlappyPlaneGame />
}
