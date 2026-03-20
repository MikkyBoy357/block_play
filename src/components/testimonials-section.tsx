"use client"

import { Star, Quote } from "lucide-react"

const testimonials = [
  {
    name: "Alex Kim",
    age: "23",
    country: "🇺🇸",
    avatar: "🎮",
    quote: "I've been playing Tetris since I was 8. Never thought I'd be making money from it. Won $500 my first month!",
    game: "Tetris",
    winnings: "$2,100",
  },
  {
    name: "Priya Sharma",
    age: "19",
    country: "🇮🇳",
    avatar: "⚡",
    quote: "The games are genuinely hard — that's what makes winning feel so good. The Math Teaser tournaments are intense.",
    game: "Math Teaser",
    winnings: "$890",
  },
  {
    name: "Kenji Tanaka",
    age: "28",
    country: "🇯🇵",
    avatar: "🥷",
    quote: "Pac-Man on blockPlay is the hardest version I've ever played. The leaderboard competition is addictive.",
    game: "Pac-Man",
    winnings: "$3,200",
  },
  {
    name: "Sarah Chen",
    age: "16",
    country: "🇨🇦",
    avatar: "🌟",
    quote: "My friends and I compete every weekend. The weekly prize pool keeps us coming back. Best $1.99 I spend.",
    game: "Flappy Plane",
    winnings: "$450",
  },
  {
    name: "Emeka Obi",
    age: "21",
    country: "🇳🇬",
    avatar: "🔥",
    quote: "Brick Break with power-ups is next level. This is how gaming should be — skill-based, real rewards.",
    game: "Brick Break",
    winnings: "$1,650",
  },
  {
    name: "Luna García",
    age: "25",
    country: "🇲🇽",
    avatar: "👑",
    quote: "I play during my lunch breaks. The Snake and Crossy Road games give me that nostalgic rush every time.",
    game: "Glow Snake",
    winnings: "$780",
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-16 md:py-24 px-4 relative overflow-hidden">
      <div className="container mx-auto relative z-10">
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-neon-pink/20 mb-4">
            <Star className="w-4 h-4 text-neon-pink" />
            <span className="text-sm text-neon-pink font-medium">Player Stories</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mb-4">
            Real Players. <span className="text-neon-pink">Real Winnings.</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Join thousands who are turning their gaming skills into real cash.
          </p>
        </div>

        {/* Testimonial grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className="rounded-2xl glass p-5 md:p-6 hover:bg-white/[0.04] transition-all duration-300 group"
              style={{ animationDelay: `${i * 100}ms`, animation: "fadeInUp 0.5s ease-out forwards", opacity: 0 }}
            >
              <Quote className="w-5 h-5 text-primary/30 mb-3" />
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full glass flex items-center justify-center text-lg">{t.avatar}</div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{t.country} {t.name}</div>
                    <div className="text-xs text-muted-foreground">Age {t.age} &bull; {t.game}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-400">{t.winnings}</div>
                  <div className="text-xs text-muted-foreground">won</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
