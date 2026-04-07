"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReservationWithSpots, SleepingSpot } from "@/lib/types";

type BootstrapResponse = {
  reservations: ReservationWithSpots[];
  sleepingSpots: SleepingSpot[];
  settings: {
    max_total_guests: number;
    season_start: string | null;
    season_end: string | null;
  };
};

type DraftReservation = {
  groupName: string;
  startDate: string;
  endDate: string;
  guestCount: number;
  notes: string;
  sleepingSpotIds: string[];
};

const initialDraft: DraftReservation = {
  groupName: "",
  startDate: "",
  endDate: "",
  guestCount: 2,
  notes: "",
  sleepingSpotIds: [],
};

function formatTripDates(start: string, end: string): string {
  try {
    const s = new Date(`${start}T12:00:00`);
    const e = new Date(`${end}T12:00:00`);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const y = s.getFullYear();
    if (s.getFullYear() === e.getFullYear()) {
      if (s.getMonth() === e.getMonth()) {
        return `${s.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${e.getDate()}, ${y}`;
      }
      return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
    }
    return `${s.toLocaleDateString("en-US", { ...opts, year: "numeric" })} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
  } catch {
    return `${start} → ${end}`;
  }
}

function friendlyError(message: string): string {
  if (message.includes("spots are already booked")) {
    return "Someone else already has one of those rooms for part of those nights. Pick different rooms or dates.";
  }
  if (message.includes("Guest capacity exceeded")) {
    return "That many people would go over the house limit on at least one night. Try fewer guests or different dates.";
  }
  if (message.includes("Checkout date must be after")) {
    return "The last day should be after the first day — that’s the day you head home (no sleep that night).";
  }
  return message;
}

export default function Home() {
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [draft, setDraft] = useState<DraftReservation>(initialDraft);
  const [formError, setFormError] = useState("");
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [showOptionalNote, setShowOptionalNote] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const reservationCount = data?.reservations.length || 0;

  async function loadData() {
    const response = await fetch("/api/bootstrap");
    if (response.status === 401) {
      setAuthed(false);
      setData(null);
      return;
    }
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "Failed to load");
    }
    setData(body);
    setAuthed(true);
  }

  useEffect(() => {
    loadData().catch(() => {
      setAuthed(false);
    });
  }, []);

  const sortedReservations = useMemo(() => {
    return [...(data?.reservations || [])].sort((a, b) =>
      a.start_date.localeCompare(b.start_date),
    );
  }, [data?.reservations]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const body = await response.json();
      if (!response.ok) {
        setAuthError(body.error === "Incorrect passcode" ? "That code doesn’t match. Ask a family member." : body.error || "Something went wrong.");
        return;
      }
      setPasscode("");
      await loadData();
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthed(false);
    setData(null);
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (draft.sleepingSpotIds.length === 0) {
      setFormError("Pick at least one room or sleeping spot so we know where your group stays.");
      return;
    }
    setLoading(true);
    try {
      const endpoint = editingReservationId
        ? `/api/reservations/${editingReservationId}`
        : "/api/reservations";
      const method = editingReservationId ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await response.json();
      if (!response.ok) {
        setFormError(friendlyError(body.error || "Couldn’t save. Try again."));
        return;
      }

      setDraft(initialDraft);
      setEditingReservationId(null);
      setShowOptionalNote(false);
      await loadData();
    } finally {
      setLoading(false);
    }
  }

  function startEdit(reservation: ReservationWithSpots) {
    setEditingReservationId(reservation.id);
    setDraft({
      groupName: reservation.group_name,
      startDate: reservation.start_date,
      endDate: reservation.end_date,
      guestCount: reservation.guest_count,
      notes: reservation.notes || "",
      sleepingSpotIds: reservation.spots.map((spot) => spot.id),
    });
    setShowOptionalNote(!!reservation.notes);
    window.scrollTo({ top: document.getElementById("add-trip")?.offsetTop ?? 0, behavior: "smooth" });
  }

  async function deleteReservation(id: string) {
    if (!window.confirm("Remove this trip from the calendar?")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) {
        setFormError(friendlyError(body.error || "Couldn’t remove."));
        return;
      }
      if (editingReservationId === id) {
        setEditingReservationId(null);
        setDraft(initialDraft);
      }
      await loadData();
    } finally {
      setLoading(false);
    }
  }

  function toggleSpot(spotId: string) {
    setDraft((current) => ({
      ...current,
      sleepingSpotIds: current.sleepingSpotIds.includes(spotId)
        ? current.sleepingSpotIds.filter((id) => id !== spotId)
        : [...current.sleepingSpotIds, spotId],
    }));
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-5 pb-16 pt-6">
        <p className="text-center text-sm font-medium text-teal-800">Ephraim cottage</p>
        <h1 className="mt-2 text-center text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          Who’s there when?
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-base leading-relaxed text-stone-600">
          One place for the family to see trips and avoid double-booking. Enter the code everyone shares.
        </p>
        <form
          onSubmit={handleLogin}
          className="mt-10 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        >
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Family code</span>
            <input
              type="password"
              required
              autoComplete="off"
              placeholder="••••••"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3.5 text-lg outline-none ring-teal-600/20 focus:border-teal-600 focus:ring-4"
            />
          </label>
          {authError ? <p className="text-sm text-red-700">{authError}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal-700 py-3.5 text-lg font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Open calendar"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-20 pt-6 sm:px-6">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-800">Ephraim cottage</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">
            Who’s there when?
          </h1>
          <p className="mt-2 max-w-md text-base text-stone-600">
            {reservationCount === 0
              ? "No trips yet — add yours below."
              : `${reservationCount} trip${reservationCount === 1 ? "" : "s"} on the calendar.`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="self-start rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Sign out
        </button>
      </header>

      <section aria-label="Upcoming trips" className="mb-10">
        <h2 className="sr-only">Upcoming trips</h2>
        <ul className="space-y-3">
          {sortedReservations.map((reservation) => (
            <li
              key={reservation.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-stone-900">{reservation.group_name}</p>
                  <p className="mt-1 text-base text-stone-700">
                    {formatTripDates(reservation.start_date, reservation.end_date)}
                  </p>
                  <p className="mt-2 text-sm text-stone-600">
                    {reservation.guest_count} {reservation.guest_count === 1 ? "person" : "people"}{" "}
                    · {reservation.spots.map((s) => s.name).join(", ")}
                  </p>
                  {reservation.notes ? (
                    <p className="mt-2 text-sm italic text-stone-500">{reservation.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col">
                  <button
                    type="button"
                    onClick={() => startEdit(reservation)}
                    className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteReservation(reservation.id)}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 hover:bg-red-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {sortedReservations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/80 p-8 text-center text-stone-600">
            When someone adds a trip, it’ll show up here so everyone can see.
          </div>
        ) : null}
      </section>

      <section id="add-trip" className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-stone-900">
          {editingReservationId ? "Update this trip" : "Add your trip"}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          First night you sleep there → last night you sleep there. The day after is when you leave (not counted as a sleep night).
        </p>

        <form className="mt-6 space-y-5" onSubmit={submitReservation}>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Your name or family</span>
            <input
              required
              placeholder="e.g. Mom & Dad, Sarah’s crew"
              value={draft.groupName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, groupName: event.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3.5 text-lg outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">First night</span>
              <input
                type="date"
                required
                value={draft.startDate}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, startDate: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3.5 text-lg outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Day you leave</span>
              <input
                type="date"
                required
                value={draft.endDate}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, endDate: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3.5 text-lg outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">How many people?</span>
            <input
              type="number"
              min={1}
              max={30}
              required
              value={draft.guestCount}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  guestCount: Number(event.target.value || 1),
                }))
              }
              className="mt-2 w-full max-w-[8rem] rounded-xl border border-stone-300 bg-stone-50 px-4 py-3.5 text-lg outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15"
            />
          </label>

          <div>
            <p className="text-sm font-medium text-stone-700">Which beds / rooms?</p>
            <p className="mt-0.5 text-xs text-stone-500">Tap all that apply for your group.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(data?.sleepingSpots || []).map((spot) => {
                const on = draft.sleepingSpotIds.includes(spot.id);
                return (
                  <button
                    key={spot.id}
                    type="button"
                    onClick={() => toggleSpot(spot.id)}
                    className={`min-h-[44px] rounded-xl border px-4 py-3 text-left text-sm font-medium transition sm:min-h-0 ${
                      on
                        ? "border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-600/30"
                        : "border-stone-300 bg-white text-stone-800 hover:bg-stone-50"
                    }`}
                  >
                    {spot.name}
                  </button>
                );
              })}
            </div>
          </div>

          {!showOptionalNote && !draft.notes ? (
            <button
              type="button"
              onClick={() => setShowOptionalNote(true)}
              className="text-sm font-medium text-teal-800 underline hover:text-teal-900"
            >
              Add a short note (optional)
            </button>
          ) : null}
          {(showOptionalNote || draft.notes) ? (
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Note (optional)</span>
              <textarea
                rows={2}
                placeholder="e.g. bringing the dog, kids only weekend…"
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-base outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15"
              />
            </label>
          ) : null}

          {formError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {formError}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-700 py-3.5 text-lg font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
            >
              {loading ? "Saving…" : editingReservationId ? "Save changes" : "Add to calendar"}
            </button>
            {editingReservationId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingReservationId(null);
                  setDraft(initialDraft);
                  setShowOptionalNote(false);
                }}
                className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-left text-sm font-medium text-stone-800 shadow-sm"
        >
          <span>How this works</span>
          <span className="text-stone-500">{showHowItWorks ? "−" : "+"}</span>
        </button>
        {showHowItWorks ? (
          <div className="mt-2 rounded-xl border border-stone-200 bg-white px-4 py-4 text-sm leading-relaxed text-stone-600">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                The calendar helps everyone see who’s at the cottage and avoid booking the same room twice.
              </li>
              <li>
                “Day you leave” is the morning you drive home — you don’t sleep there that night.
              </li>
              <li>
                If the house is full for a night, we’ll ask you to adjust dates or guest count.
              </li>
            </ul>
            <p className="mt-3 text-xs text-stone-500">
              House limit: {data?.settings.max_total_guests ?? "—"} people · Typical season{" "}
              {data?.settings.season_start ?? "?"}–{data?.settings.season_end ?? "?"}
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
