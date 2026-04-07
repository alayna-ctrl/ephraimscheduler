import { describe, expect, it } from "vitest";
import {
  calculateGuestCountForNight,
  findSpotConflicts,
  hasDateOverlap,
} from "./conflicts";
import type { ReservationWithSpots } from "./types";

const sampleReservations: ReservationWithSpots[] = [
  {
    id: "a",
    group_name: "Smith",
    start_date: "2026-06-10",
    end_date: "2026-06-14",
    guest_count: 4,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    spots: [
      { id: "11111111-1111-1111-1111-111111111111", name: "Bedroom 1", capacity: 2, sort_order: 1, active: true },
      { id: "22222222-2222-2222-2222-222222222222", name: "Bedroom 2", capacity: 2, sort_order: 2, active: true },
    ],
  },
];

describe("conflict helpers", () => {
  it("detects overlapping date ranges", () => {
    expect(hasDateOverlap("2026-06-10", "2026-06-12", "2026-06-11", "2026-06-14")).toBe(
      true,
    );
    expect(hasDateOverlap("2026-06-10", "2026-06-12", "2026-06-12", "2026-06-14")).toBe(
      false,
    );
  });

  it("returns spot conflict names", () => {
    const result = findSpotConflicts(
      "2026-06-11",
      "2026-06-13",
      ["11111111-1111-1111-1111-111111111111"],
      sampleReservations,
    );
    expect(result.conflictingSpotNames).toEqual(["Bedroom 1"]);
  });

  it("calculates guest count for a night", () => {
    expect(calculateGuestCountForNight("2026-06-11", sampleReservations)).toBe(4);
    expect(calculateGuestCountForNight("2026-06-16", sampleReservations)).toBe(0);
  });
});

