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
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url, subscription_tier, subscription_expires_at")
      .eq("id", user.id)
      .single();

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
