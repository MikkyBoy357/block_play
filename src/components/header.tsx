"use client"

import { useState } from "react"
import Link from "next/link"
import { Gamepad2, Trophy, Crown, Menu, X, User, Zap, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSound } from "@/hooks/use-sound"
import { useAuth } from "@/hooks/use-auth"
import { AuthModal } from "@/components/auth-modal"
import { AvatarPicker } from "@/components/avatar-picker"

const navItems = [
  { label: "Games", href: "#games", icon: Gamepad2 },
  { label: "Leaderboard", href: "#leaderboard", icon: Trophy },
  { label: "Pricing", href: "#pricing", icon: Crown },
  { label: "How It Works", href: "#how-it-works", icon: Zap },
]

export function Header() {
  const { playHover, playClick } = useSound()
  const { user, isLoading, signOut, updateAvatar } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin")
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)

  const openSignIn = () => { setAuthMode("signin"); setAuthModalOpen(true); playClick() }
  const openSignUp = () => { setAuthMode("signup"); setAuthModalOpen(true); playClick() }

  const isAvatarUrl = (s: string | null) => s && (s.startsWith("data:") || s.startsWith("http"))

  const renderAvatar = (size: string, textSize: string) => {
    if (user?.avatar_url && isAvatarUrl(user.avatar_url)) {
      return (
        <div className={`${size} rounded-full border border-primary/40 overflow-hidden`}>
          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
        </div>
      )
    }
    if (user?.avatar_url) {
      return (
        <div className={`${size} rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center ${textSize}`}>
          {user.avatar_url}
        </div>
      )
    }
    return (
      <div className={`${size} rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center ${textSize} font-bold text-primary`}>
        {(user?.username ?? user?.email)?.[0]?.toUpperCase() ?? "?"}
      </div>
    )
  }

  return (
    <>
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
          {isLoading ? (
            <div className="w-20 h-9 rounded-lg bg-white/5 animate-pulse" />
          ) : user ? (
            <>
              <div
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg glass border border-border/40 cursor-pointer hover:border-primary/30 transition-all"
                onClick={() => { setAvatarPickerOpen(true); playClick() }}
              >
                {renderAvatar("w-7 h-7", "text-sm")}
                <span className="text-sm font-medium text-foreground max-w-[100px] truncate">
                  {user.username ?? user.email}
                </span>
                {user.subscription_tier && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full uppercase">
                    {user.subscription_tier}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                className="bg-primary/10 border border-primary/40 hover:bg-primary/20 text-primary gap-1.5 text-sm"
                onMouseEnter={playHover}
                onClick={() => { signOut(); playClick() }}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                className="hidden sm:inline-flex bg-primary/10 border border-primary/40 hover:bg-primary/20 hover:border-primary text-primary gap-2 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,136,0.2)] text-sm"
                onMouseEnter={playHover}
                onClick={openSignIn}
              >
                <User className="w-4 h-4" />
                Sign In
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,136,0.3)] text-sm font-semibold"
                onMouseEnter={playHover}
                onClick={openSignUp}
              >
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Subscribe</span>
                <span className="sm:hidden">Join</span>
              </Button>
            </>
          )}

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
              {user ? (
                <>
                  <div
                    className="flex items-center gap-2 px-4 py-2 mb-2 cursor-pointer"
                    onClick={() => { setAvatarPickerOpen(true); setMobileMenuOpen(false); playClick() }}
                  >
                    {renderAvatar("w-7 h-7", "text-sm")}
                    <span className="text-sm font-medium text-foreground">{user.username ?? user.email}</span>
                  </div>
                  <Button
                    className="w-full bg-primary/10 border border-primary/40 text-primary gap-2"
                    onClick={() => { signOut(); setMobileMenuOpen(false); playClick() }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="w-full bg-primary/10 border border-primary/40 text-primary gap-2 mb-2"
                    onClick={() => { setMobileMenuOpen(false); openSignIn() }}
                  >
                    <User className="w-4 h-4" />
                    Sign In
                  </Button>
                  <Button
                    className="w-full bg-primary text-primary-foreground gap-2 font-semibold"
                    onClick={() => { setMobileMenuOpen(false); openSignUp() }}
                  >
                    <Crown className="w-4 h-4" />
                    Subscribe & Play
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
    <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialMode={authMode} />
    {avatarPickerOpen && (
      <AvatarPicker
        selected={user?.avatar_url ?? null}
        onSelect={async (avatar) => {
          await updateAvatar(avatar)
          setAvatarPickerOpen(false)
        }}
        onClose={() => setAvatarPickerOpen(false)}
      />
    )}
    </>
  )
}
