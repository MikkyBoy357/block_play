"use client"

import { useState } from "react"
import Link from "next/link"
import { Gamepad2, Trophy, Crown, Menu, X, User, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSound } from "@/hooks/use-sound"

const navItems = [
  { label: "Games", href: "#games", icon: Gamepad2 },
  { label: "Leaderboard", href: "#leaderboard", icon: Trophy },
  { label: "Pricing", href: "#pricing", icon: Crown },
  { label: "How It Works", href: "#how-it-works", icon: Zap },
]

export function Header() {
  const { playHover, playClick } = useSound()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer group" onMouseEnter={playHover}>
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center group-hover:bg-primary/30 transition-all duration-300">
              <Gamepad2 className="w-5 h-5 text-primary transition-transform group-hover:scale-110" />
            </div>
            <div className="absolute inset-0 bg-primary/30 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
          </div>
          <span className="font-bold text-xl tracking-tight">
            block<span className="text-primary neon-text">Play</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-all duration-200 relative group"
              onMouseEnter={playHover}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary group-hover:w-3/4 transition-all duration-300 rounded-full" />
            </a>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Button
            className="hidden sm:inline-flex bg-primary/10 border border-primary/40 hover:bg-primary/20 hover:border-primary text-primary gap-2 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,136,0.2)] text-sm"
            onMouseEnter={playHover}
            onClick={playClick}
          >
            <User className="w-4 h-4" />
            Sign In
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,136,0.3)] text-sm font-semibold"
            onMouseEnter={playHover}
            onClick={playClick}
          >
            <Crown className="w-4 h-4" />
            <span className="hidden sm:inline">Subscribe</span>
            <span className="sm:hidden">Join</span>
          </Button>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-primary transition-colors"
            onClick={() => { setMobileMenuOpen(!mobileMenuOpen); playClick() }}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-strong border-t border-border/50 animate-fade-in-down">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-all"
                onClick={() => { setMobileMenuOpen(false); playClick() }}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </a>
            ))}
            <div className="border-t border-border/50 mt-2 pt-3">
              <Button
                className="w-full bg-primary/10 border border-primary/40 text-primary gap-2 mb-2"
                onClick={playClick}
              >
                <User className="w-4 h-4" />
                Sign In
              </Button>
              <Button
                className="w-full bg-primary text-primary-foreground gap-2 font-semibold"
                onClick={playClick}
              >
                <Crown className="w-4 h-4" />
                Subscribe & Play
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
