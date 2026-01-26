"use client"

import { Gamepad2, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSound } from "@/hooks/use-sound"

export function Header() {
  const { playHover, playClick } = useSound()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/60 border-b border-primary/20">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer group" onMouseEnter={playHover}>
          <div className="relative">
            <Gamepad2 className="w-8 h-8 text-primary transition-transform group-hover:scale-110" />
            <div className="absolute inset-0 bg-primary/50 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="font-bold text-xl tracking-tight">
            block<span className="text-primary">Play</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          {["Games", "Leaderboard", "Rewards", "About"].map((item) => (
            <a
              key={item}
              href="#"
              className="text-sm text-muted-foreground hover:text-primary transition-colors relative group"
              onMouseEnter={playHover}
            >
              {item}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
            </a>
          ))}
        </nav>

        <Button
          className="bg-primary/10 border border-primary/50 hover:bg-primary/20 hover:border-primary text-primary gap-2 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
          onMouseEnter={playHover}
          onClick={playClick}
        >
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">Connect</span>
        </Button>
      </div>
    </header>
  )
}
