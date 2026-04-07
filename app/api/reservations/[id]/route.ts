import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  parseReservationInput,
  validateReservationConflicts,
} from "@/lib/reservations";
import { getSupabaseServerClient } from "@/lib/supabase";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: Context) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const input = parseReservationInput(payload);
    const { id } = await context.params;
    const supabase = getSupabaseServerClient();

    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("max_total_guests")
      .limit(1)
      .single();
    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 });
    }

    await validateReservationConflicts(input, settings.max_total_guests, id);

    const { error: reservationError } = await supabase
      .from("reservations")
      .update({
        group_name: input.groupName,
        start_date: input.startDate,
        end_date: input.endDate,
        guest_count: input.guestCount,
        notes: input.notes || null,
      })
      .eq("id", id);

    if (reservationError) {
      return NextResponse.json({ error: reservationError.message }, { status: 500 });
    }

    await supabase.from("reservation_spots").delete().eq("reservation_id", id);

    const rows = input.sleepingSpotIds.map((spotId) => ({
      reservation_id: id,
      sleeping_spot_id: spotId,
    }));
    const { error: spotsError } = await supabase.from("reservation_spots").insert(rows);
    if (spotsError) {
      return NextResponse.json({ error: spotsError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update reservation" },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, context: Context) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const supabase = getSupabaseServerClient();

    await supabase.from("reservation_spots").delete().eq("reservation_id", id);
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete reservation" },
      { status: 500 },
    );
  }
}

