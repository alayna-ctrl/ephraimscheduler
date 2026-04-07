import { z } from "zod";
import { calculateGuestCountForNight, findSpotConflicts } from "@/lib/conflicts";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { ReservationWithSpots, SleepingSpot } from "@/lib/types";

type ReservationQueryRow = {
  id: string;
  group_name: string;
  start_date: string;
  end_date: string;
  guest_count: number;
  notes: string | null;
  created_at: string;
  reservation_spots: Array<{
    sleeping_spots: SleepingSpot | SleepingSpot[];
  }>;
};

const reservationInputSchema = z.object({
  groupName: z.string().trim().min(1).max(80),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestCount: z.number().int().positive().max(30),
  notes: z.string().trim().max(250).optional(),
  sleepingSpotIds: z.array(z.string().uuid()).min(1),
});

export type ReservationInput = z.infer<typeof reservationInputSchema>;

export function parseReservationInput(payload: unknown): ReservationInput {
  const parsed = reservationInputSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid reservation");
  }
  if (parsed.data.startDate >= parsed.data.endDate) {
    throw new Error("Checkout date must be after arrival date");
  }
  return parsed.data;
}

export async function getSleepingSpots(): Promise<SleepingSpot[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sleeping_spots")
    .select("id, name, capacity, sort_order, active")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}

export async function listReservations(): Promise<ReservationWithSpots[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, group_name, start_date, end_date, guest_count, notes, created_at, reservation_spots(sleeping_spots(id, name, capacity, sort_order, active))",
    )
    .order("start_date", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as unknown as ReservationQueryRow[]).map((row) => ({
    id: row.id,
    group_name: row.group_name,
    start_date: row.start_date,
    end_date: row.end_date,
    guest_count: row.guest_count,
    notes: row.notes,
    created_at: row.created_at,
    spots: (row.reservation_spots || []).flatMap((relation) =>
      Array.isArray(relation.sleeping_spots)
        ? relation.sleeping_spots
        : [relation.sleeping_spots],
    ),
  }));
}

export async function validateReservationConflicts(
  input: ReservationInput,
  maxTotalGuests: number,
  excludeReservationId?: string,
) {
  const reservations = await listReservations();
  const { conflictingSpotNames } = findSpotConflicts(
    input.startDate,
    input.endDate,
    input.sleepingSpotIds,
    reservations,
    excludeReservationId,
  );

  if (conflictingSpotNames.length > 0) {
    throw new Error(`These spots are already booked: ${conflictingSpotNames.join(", ")}`);
  }

  const existingForCapacity = reservations.filter(
    (reservation) => reservation.id !== excludeReservationId,
  );
  const nights = enumerateNights(input.startDate, input.endDate);
  for (const night of nights) {
    const currentGuests = calculateGuestCountForNight(night, existingForCapacity);
    if (currentGuests + input.guestCount > maxTotalGuests) {
      throw new Error(
        `Guest capacity exceeded on ${night}. Max allowed is ${maxTotalGuests}.`,
      );
    }
  }
}

function enumerateNights(startDate: string, endDate: string): string[] {
  const nights: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

