"use client"

import { useState, useRef } from "react"
import { Check, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const AVATAR_OPTIONS = [
  "🥷", "👑", "🎮", "⚡", "🌟", "🧠", "🐍", "🧊",
  "🔥", "🚀", "💎", "🎯", "🦊", "🐱", "🐶", "🦁",
  "🐼", "🦄", "🐲", "🦅", "🎭", "👾", "🤖", "👽",
  "🧙", "🧛", "🧟", "🦸", "🥇", "🏆", "💀", "🎪",
  "🌈", "⭐", "🍀", "🎲", "🃏", "🕹️", "🛸", "🌊",
]

interface AvatarPickerProps {
  selected: string | null
  onSelect: (avatar: string) => void
  onClose: () => void
}

export function AvatarPicker({ selected, onSelect, onClose }: AvatarPickerProps) {
  const [currentSelection, setCurrentSelection] = useState<string>(selected ?? "🎮")
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type and size
    if (!file.type.startsWith("image/")) return
    if (file.size > 2 * 1024 * 1024) return // 2MB max

    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setUploadPreview(result)
      setCurrentSelection(result)
    }
    reader.readAsDataURL(file)
  }

  const isUrl = (s: string) => s.startsWith("data:") || s.startsWith("http")

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm rounded-2xl glass-strong border border-border/50 p-5 sm:p-6 animate-fade-in-down">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold text-foreground mb-1">Choose Avatar</h3>
        <p className="text-xs text-muted-foreground mb-4">Pick an emoji or upload your own image</p>

        {/* Preview */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/40 flex items-center justify-center text-4xl overflow-hidden">
            {isUrl(currentSelection) ? (
              <img src={currentSelection} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              currentSelection
            )}
          </div>
        </div>

        {/* Upload button */}
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload Image
            <span className="text-xs text-muted-foreground/60">(max 2MB)</span>
          </button>
        </div>

        {/* Emoji grid */}
        <div className="grid grid-cols-8 gap-1.5 mb-5 max-h-48 overflow-y-auto pr-1">
          {AVATAR_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { setCurrentSelection(emoji); setUploadPreview(null) }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl transition-all hover:scale-110 ${
                currentSelection === emoji
                  ? "bg-primary/20 border border-primary/60 ring-1 ring-primary/30"
                  : "bg-white/5 border border-border/30 hover:border-primary/30"
              }`}
            >
              {emoji}
              {currentSelection === emoji && (
                <Check className="w-2.5 h-2.5 text-primary absolute -top-0.5 -right-0.5" />
              )}
            </button>
          ))}
        </div>

        {/* Confirm */}
        <Button
          onClick={() => onSelect(currentSelection)}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-5 rounded-xl font-bold text-sm transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.2)]"
        >
          <Check className="w-4 h-4 mr-2" />
          Save Avatar
        </Button>
      </div>
    </div>
  )
}
