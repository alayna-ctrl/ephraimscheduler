import { NextResponse } from "next/server";
import { hashPasscode, setAuthCookie } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { passcode } = await request.json();
    if (!passcode || typeof passcode !== "string") {
      return NextResponse.json({ error: "Passcode is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("family_passcode_hash")
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (hashPasscode(passcode) !== data.family_passcode_hash) {
      return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
    }

    await setAuthCookie();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
}

