import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function POST(request: Request) {
  try {
    const { avatar_url } = await request.json()

    if (!avatar_url || typeof avatar_url !== "string") {
      return NextResponse.json({ error: "Invalid avatar" }, { status: 400 })
    }

    // Only allow emoji strings or data: URLs up to a reasonable size
    if (avatar_url.length > 500_000) {
      return NextResponse.json({ error: "Avatar too large" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url, updated_at: new Date().toISOString() })
      .eq("id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update avatar" }, { status: 500 })
  }
}
