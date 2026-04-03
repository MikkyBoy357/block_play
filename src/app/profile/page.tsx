"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  DollarSign,
  Trophy,
  Gamepad2,
  Clock,
  Target,
  TrendingUp,
  Flame,
  Star,
  Calendar,
  Crown,
  CheckCircle2,
  XCircle,
  Pencil,
  Upload,
  X,
  Save,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/header"
import { games } from "@/lib/game-data"
import { SUBSCRIPTION_TIERS } from "@/lib/game-data"

const AVATAR_EMOJIS = [
  "🥷", "👑", "🎮", "⚡", "🌟", "🧠", "🐍", "🧊",
  "🔥", "🚀", "💎", "🎯", "🦊", "🐱", "🐶", "🦁",
  "🐼", "🦄", "🐲", "🦅", "🎭", "👾", "🤖", "👽",
  "🧙", "🧛", "🧟", "🦸", "🥇", "🏆", "💀", "🎪",
  "🌈", "⭐", "🍀", "🎲", "🃏", "🕹️", "🛸", "🌊",
]

interface GameSession {
  id: string
  game_slug: string
  score: number
  duration_ms: number
  actions: number
  qualified: boolean
  earned: number
  created_at: string
}

interface GameStat {
  plays: number
  bestScore: number
  totalEarned: number
  qualifiedCount: number
}

interface ProfileData {
  profile: {
    id: string
    email: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    subscription_tier: string | null
    subscription_expires_at: string | null
    created_at: string
  }
  earnings: {
    weeklyTotal: number
    weeklyPlays: number
    weekStart: string
    allTimeTotal: number
    allTimePlays: number
  }
  recentSessions: GameSession[]
  gameStats: Record<string, GameStat>
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remainingSecs = secs % 60
  return `${mins}m ${remainingSecs}s`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getGameTitle(slug: string): string {
  return games.find((g) => g.slug === slug)?.title ?? slug
}

function getGameScoreUnit(slug: string): string {
  return games.find((g) => g.slug === slug)?.scoreUnit ?? "pts"
}

export default function ProfilePage() {
  const { user, isLoading: authLoading, updateProfile } = useAuth()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"history" | "stats">("history")

  // Editing state
  const [editing, setEditing] = useState(false)
  const [editUsername, setEditUsername] = useState("")
  const [editDisplayName, setEditDisplayName] = useState("")
  const [editBio, setEditBio] = useState("")
  const [editAvatar, setEditAvatar] = useState("")
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    async function fetchProfile() {
      try {
        const res = await fetch("/api/auth/profile")
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    fetchProfile()
  }, [user])

  const startEdit = () => {
    if (!data?.profile) return
    setEditUsername(data.profile.username ?? "")
    setEditDisplayName(data.profile.display_name ?? "")
    setEditBio(data.profile.bio ?? "")
    setEditAvatar(data.profile.avatar_url ?? "🎮")
    setEditError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setShowAvatarPicker(false)
    setEditError(null)
  }

  const saveProfile = async () => {
    setSaving(true)
    setEditError(null)
    const result = await updateProfile({
      username: editUsername,
      display_name: editDisplayName,
      bio: editBio,
      avatar_url: editAvatar,
    })
    setSaving(false)
    if (result.error) {
      setEditError(result.error)
      return
    }
    setEditing(false)
    setShowAvatarPicker(false)
    // Refresh profile data
    try {
      const res = await fetch("/api/auth/profile")
      if (res.ok) setData(await res.json())
    } catch { /* ignore */ }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return
    if (file.size > 2 * 1024 * 1024) {
      setEditError("Image must be under 2MB")
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setEditAvatar(result)
      setShowAvatarPicker(false)
    }
    reader.readAsDataURL(file)
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 container mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Sign in to view your profile</h1>
          <p className="text-muted-foreground mb-6">You need to be logged in to see your earnings and game history.</p>
          <Link href="/" className="text-primary hover:underline inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </main>
    )
  }

  const profile = data?.profile
  const earnings = data?.earnings
  const sessions = data?.recentSessions ?? []
  const gameStats = data?.gameStats ?? {}

  const tierConfig = profile?.subscription_tier
    ? SUBSCRIPTION_TIERS[profile.subscription_tier as keyof typeof SUBSCRIPTION_TIERS]
    : null

  const weeklyMax = tierConfig?.maxWeeklyEarning ?? 0
  const weeklyProgress = weeklyMax > 0 ? Math.min(((earnings?.weeklyTotal ?? 0) / weeklyMax) * 100, 100) : 0

  const isAvatarUrl = (s: string | null) => s && (s.startsWith("data:") || s.startsWith("http"))

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-20 pb-12 container mx-auto px-4">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </Link>

        {/* Profile Header */}
        <div className="rounded-2xl glass border border-border/50 p-6 mb-8">
          {editing ? (
            /* Edit Mode */
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Edit Profile</h2>
                <button onClick={cancelEdit} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {editError}
                </div>
              )}

              {/* Avatar Edit */}
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="relative group"
                >
                  <div className="w-20 h-20 rounded-full border-2 border-primary/40 flex items-center justify-center text-4xl overflow-hidden bg-primary/10">
                    {editAvatar && (editAvatar.startsWith("data:") || editAvatar.startsWith("http")) ? (
                      <img src={editAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      editAvatar || "🎮"
                    )}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="w-5 h-5 text-white" />
                  </div>
                </button>
                <span className="text-xs text-muted-foreground">Click to change avatar</span>
              </div>

              {/* Avatar Picker */}
              {showAvatarPicker && (
                <div className="rounded-xl bg-white/5 border border-border/50 p-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all mb-3"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Image
                    <span className="text-xs text-muted-foreground/60">(max 2MB)</span>
                  </button>
                  <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto">
                    {AVATAR_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => { setEditAvatar(emoji); setShowAvatarPicker(false) }}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl transition-all hover:scale-110 ${
                          editAvatar === emoji
                            ? "bg-primary/20 border border-primary/60"
                            : "bg-white/5 border border-border/30 hover:border-primary/30"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="username"
                    maxLength={30}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Display Name"
                    maxLength={50}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Bio <span className="text-muted-foreground/50">({editBio.length}/200)</span>
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    maxLength={200}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border/50 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex items-center gap-3">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Avatar */}
              <div className="shrink-0">
                {profile?.avatar_url && isAvatarUrl(profile.avatar_url) ? (
                  <div className="w-16 h-16 rounded-full border-2 border-primary/40 overflow-hidden">
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : profile?.avatar_url ? (
                  <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-3xl">
                    {profile.avatar_url}
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-2xl font-bold text-primary">
                    {(profile?.username ?? profile?.email)?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <h1 className="text-2xl font-black text-foreground">
                  {profile?.display_name ?? profile?.username ?? "Player"}
                </h1>
                {profile?.username && (
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                )}
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.bio && (
                  <p className="text-sm text-foreground/70 mt-1">{profile.bio}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {profile?.subscription_tier && (
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      {profile.subscription_tier}
                    </span>
                  )}
                  {profile?.created_at && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Joined {new Date(profile.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Edit Button */}
              <button
                onClick={startEdit}
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-white/5 transition-all"
              >
                <Pencil className="w-4 h-4" />
                Edit Profile
              </button>
            </div>
          )}
        </div>

        {/* Earnings Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl glass border border-green-500/30 p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="text-sm text-muted-foreground">This Week</span>
            </div>
            <div className="text-3xl font-black text-green-400">
              ${(earnings?.weeklyTotal ?? 0).toFixed(2)}
            </div>
            {weeklyMax > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{earnings?.weeklyPlays ?? 0} plays</span>
                  <span>${weeklyMax.toFixed(2)} cap</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-green-400 transition-all duration-500"
                    style={{ width: `${weeklyProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl glass border border-yellow-500/30 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-muted-foreground">All-Time Earned</span>
            </div>
            <div className="text-3xl font-black text-yellow-400">
              ${(earnings?.allTimeTotal ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Across {earnings?.allTimePlays ?? 0} qualifying plays
            </div>
          </div>

          <div className="rounded-xl glass border border-primary/30 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Games</span>
            </div>
            <div className="text-3xl font-black text-primary">
              {sessions.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {Object.keys(gameStats).length} different games played
            </div>
          </div>

          <div className="rounded-xl glass border border-neon-purple/30 p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-neon-purple" />
              <span className="text-sm text-muted-foreground">Win Rate</span>
            </div>
            <div className="text-3xl font-black text-neon-purple">
              {sessions.length > 0
                ? `${Math.round((sessions.filter((s) => s.qualified).length / sessions.length) * 100)}%`
                : "0%"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {sessions.filter((s) => s.qualified).length} qualified out of {sessions.length}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl glass mb-6 w-fit">
          <button
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "history"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
            onClick={() => setActiveTab("history")}
          >
            <Clock className="w-4 h-4 inline mr-1.5" />
            Game History
          </button>
          <button
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "stats"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
            onClick={() => setActiveTab("stats")}
          >
            <Star className="w-4 h-4 inline mr-1.5" />
            Game Stats
          </button>
        </div>

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <div className="rounded-xl glass border border-border/50 p-8 text-center">
                <Gamepad2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No games played yet. Go play some games!</p>
                <Link
                  href="/#games"
                  className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:underline"
                >
                  Browse Games <ArrowLeft className="w-3 h-3 rotate-180" />
                </Link>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl glass border border-border/50 p-4 flex items-center gap-4"
                >
                  {/* Game icon */}
                  <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    session.qualified ? "bg-primary/20 border border-primary/30" : "bg-white/5 border border-border/30"
                  }`}>
                    {session.qualified ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : (
                      <XCircle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm truncate">
                        {getGameTitle(session.game_slug)}
                      </span>
                      {session.qualified && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          QUALIFIED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {session.score.toLocaleString()} {getGameScoreUnit(session.game_slug)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(session.duration_ms)}
                      </span>
                      <span>{timeAgo(session.created_at)}</span>
                    </div>
                  </div>

                  {/* Earned */}
                  {session.earned > 0 ? (
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-green-400">
                        +${Number(session.earned).toFixed(2)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      <div className="text-sm text-muted-foreground/50">$0.00</div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(gameStats).length === 0 ? (
              <div className="col-span-full rounded-xl glass border border-border/50 p-8 text-center">
                <Star className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No game stats yet. Start playing to see your stats here!</p>
              </div>
            ) : (
              Object.entries(gameStats)
                .sort(([, a], [, b]) => b.plays - a.plays)
                .map(([slug, stat]) => {
                  const gameInfo = games.find((g) => g.slug === slug)
                  return (
                    <Link
                      key={slug}
                      href={`/games/${slug}`}
                      className="rounded-xl glass border border-border/50 p-5 hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {gameInfo && (
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${gameInfo.color} bg-opacity-20`}>
                            <gameInfo.icon className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                            {getGameTitle(slug)}
                          </h3>
                          <p className="text-xs text-muted-foreground">{stat.plays} games played</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-lg font-bold text-primary tabular-nums">
                            {stat.bestScore.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Best Score</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-green-400 tabular-nums">
                            ${stat.totalEarned.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Earned</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-yellow-400 tabular-nums">
                            {stat.plays > 0 ? Math.round((stat.qualifiedCount / stat.plays) * 100) : 0}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">Win Rate</div>
                        </div>
                      </div>
                    </Link>
                  )
                })
            )}
          </div>
        )}
      </div>
    </main>
  )
}
