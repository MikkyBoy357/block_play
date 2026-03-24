import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { AuthProvider } from "@/hooks/use-auth"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
})

export const metadata: Metadata = {
  title: "blockPlay | Play Childhood Games. Win Real Money.",
  description: "Compete in classic childhood games against players worldwide. Subscribe, play, climb leaderboards, and win real cash prizes every week.",
  keywords: ["gaming", "play to earn", "childhood games", "competitive gaming", "cash prizes", "leaderboard"],
}

export const viewport: Viewport = {
  themeColor: "#00ff88",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
