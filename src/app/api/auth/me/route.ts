import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null });
    }

    // Fetch profile data
    let { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url, bio, subscription_tier, subscription_expires_at")
      .eq("id", user.id)
      .single();

    // Auto-create profile if missing (for users who signed up before trigger existed)
    if (!profile) {
      const newProfile = {
        id: user.id,
        username: user.user_metadata?.username ?? user.email?.split("@")[0] ?? null,
        display_name: user.user_metadata?.display_name ?? user.user_metadata?.username ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      };
      await supabase.from("profiles").upsert(newProfile, { onConflict: "id" });

      const { data: refetched } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url, bio, subscription_tier, subscription_expires_at")
        .eq("id", user.id)
        .single();
      profile = refetched;
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        ...profile,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
