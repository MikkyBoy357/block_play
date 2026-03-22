"use client"

import { Crown, ArrowRight, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CTABanner() {
  return (
    <section className="py-16 md:py-20 px-4">
      <div className="container mx-auto">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-neon-purple/20 to-neon-blue/20" />
          <div className="absolute inset-0 glass-strong" />

          {/* Content */}
          <div className="relative z-10 px-6 sm:px-10 md:px-16 py-12 md:py-16 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground mb-3">
                Ready to Turn Skills Into <span className="text-primary neon-text">Cash</span>?
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base max-w-lg">
                Join 24,500+ players already competing. New prize pools every Monday.
                The games are hard. The rewards are real.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <a href="#pricing">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-bold px-8 py-6 rounded-xl hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] transition-all text-base"
                >
                  <Crown className="w-5 h-5" />
                  Subscribe Now
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary" />
                Starting from $1.99/week
              </span>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-neon-purple/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>
    </section>
  )
}
