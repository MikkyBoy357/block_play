"use client"

import { Gamepad2, Twitter, MessageCircle, Youtube } from "lucide-react"

const footerLinks = {
  Platform: ["All Games", "Leaderboard", "Pricing", "How It Works"],
  Support: ["Help Center", "Contact Us", "Terms of Service", "Privacy Policy"],
  Community: ["Discord", "Twitter/X", "YouTube", "Blog"],
}

export function Footer() {
  return (
    <footer className="border-t border-border/30 bg-background/80">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-primary" />
              </div>
              <span className="font-bold text-xl">
                block<span className="text-primary">Play</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed max-w-xs">
              Play the games you grew up with. Compete against real players. Win real money.
            </p>
            <div className="flex items-center gap-3">
              {[Twitter, MessageCircle, Youtube].map((Icon, i) => (
                <button
                  key={i}
                  className="w-9 h-9 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-foreground mb-4 text-sm">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="border-t border-border/30 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} blockPlay. All rights reserved. Play responsibly.
          </p>
          <p className="text-xs text-muted-foreground">
            Must be 18+ to participate in cash competitions.
          </p>
        </div>
      </div>
    </footer>
  )
}
