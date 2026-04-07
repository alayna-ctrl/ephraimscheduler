export type SleepingSpot = {
  id: string;
  name: string;
  capacity: number;
  sort_order: number;
  active: boolean;
};

export type Reservation = {
  id: string;
  group_name: string;
  start_date: string;
  end_date: string;
  guest_count: number;
  notes: string | null;
  created_at: string;
};

export type ReservationWithSpots = Reservation & {
  spots: SleepingSpot[];
};

export type AppSettings = {
  family_passcode_hash: string;
  max_total_guests: number;
  season_start: string | null;
  season_end: string | null;
};

