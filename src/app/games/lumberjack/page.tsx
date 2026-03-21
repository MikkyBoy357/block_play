import { LumberjackPageClient } from "./client"

export const metadata = {
  title: "LumberJack - blockPlay",
  description: "Chop trees, dodge branches, beat the clock in this fast-paced lumberjack game!",
}

export default function LumberjackPage() {
  return <LumberjackPageClient />
}
