import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listReservations, getSleepingSpots } from "@/lib/reservations";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [reservations, sleepingSpots] = await Promise.all([
      listReservations(),
      getSleepingSpots(),
    ]);

    const supabase = getSupabaseServerClient();
    const { data: settings, error } = await supabase
      .from("app_settings")
      .select("max_total_guests, season_start, season_end")
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      reservations,
      sleepingSpots,
      settings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load app data" },
      { status: 500 },
    );
  }
}

