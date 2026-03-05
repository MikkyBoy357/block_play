import { PacmanGame } from "@/components/games/pacman"

export const metadata = {
  title: "Pac-Man - blockPlay",
  description: "Navigate the maze, eat all the dots, and avoid the ghosts in this classic arcade game!",
}

export default function PacmanPage() {
  return <PacmanGame />
}
