import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listReservations,
  parseReservationInput,
  validateReservationConflicts,
} from "@/lib/reservations";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const reservations = await listReservations();
    return NextResponse.json({ reservations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list reservations" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const input = parseReservationInput(payload);
    const supabase = getSupabaseServerClient();

    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("max_total_guests")
      .limit(1)
      .single();
    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 });
    }

    await validateReservationConflicts(input, settings.max_total_guests);

    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .insert({
        group_name: input.groupName,
        start_date: input.startDate,
        end_date: input.endDate,
        guest_count: input.guestCount,
        notes: input.notes || null,
      })
      .select("id")
      .single();

    if (reservationError) {
      return NextResponse.json({ error: reservationError.message }, { status: 500 });
    }

    const rows = input.sleepingSpotIds.map((spotId) => ({
      reservation_id: reservation.id,
      sleeping_spot_id: spotId,
    }));
    const { error: spotsError } = await supabase.from("reservation_spots").insert(rows);
    if (spotsError) {
      return NextResponse.json({ error: spotsError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save reservation" },
      { status: 400 },
    );
  }
}

