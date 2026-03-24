import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json({ message: "Signed out" });
  } catch {
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}
