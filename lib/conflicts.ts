import type { ReservationWithSpots } from "@/lib/types";

type OverlapResult = {
  overlappingReservations: ReservationWithSpots[];
  conflictingSpotNames: string[];
};

export function hasDateOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA < endB && endA > startB;
}

export function findSpotConflicts(
  candidateStart: string,
  candidateEnd: string,
  candidateSpotIds: string[],
  existingReservations: ReservationWithSpots[],
  excludeReservationId?: string,
): OverlapResult {
  const overlappingReservations = existingReservations.filter((reservation) => {
    if (excludeReservationId && reservation.id === excludeReservationId) {
      return false;
    }
    return hasDateOverlap(
      candidateStart,
      candidateEnd,
      reservation.start_date,
      reservation.end_date,
    );
  });

  const conflictingSpotNames = Array.from(
    new Set(
      overlappingReservations.flatMap((reservation) =>
        reservation.spots
          .filter((spot) => candidateSpotIds.includes(spot.id))
          .map((spot) => spot.name),
      ),
    ),
  );

  return { overlappingReservations, conflictingSpotNames };
}

export function calculateGuestCountForNight(
  targetDate: string,
  reservations: ReservationWithSpots[],
): number {
  return reservations
    .filter((reservation) =>
      hasDateOverlap(
        targetDate,
        addOneDay(targetDate),
        reservation.start_date,
        reservation.end_date,
      ),
    )
    .reduce((sum, reservation) => sum + reservation.guest_count, 0);
}

function addOneDay(dateInput: string): string {
  const date = new Date(`${dateInput}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

