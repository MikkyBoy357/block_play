"use client"

import { useCallback, useRef, useEffect } from "react"

export function useSound() {
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    audioContextRef.current = new (
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )()
    return () => {
      audioContextRef.current?.close()
    }
  }, [])

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = "sine") => {
    const ctx = audioContextRef.current
    if (!ctx) return

    if (ctx.state === "suspended") {
      ctx.resume()
    }

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  }, [])

  const playHover = useCallback(() => {
    playTone(800, 0.05, "sine")
  }, [playTone])

  const playClick = useCallback(() => {
    playTone(600, 0.1, "square")
    setTimeout(() => playTone(900, 0.08, "sine"), 50)
  }, [playTone])

  return { playHover, playClick }
}
