import { MathTeaserPageClient } from "./client"

export const metadata = {
  title: "Math Teaser - blockPlay",
  description: "Solve math problems against the clock. Wrong answer or timeout = game over!",
}

export default function MathTeaserPage() {
  return <MathTeaserPageClient />
}
