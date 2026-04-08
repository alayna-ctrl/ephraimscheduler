"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MonthPlanner } from "@/components/MonthPlanner";
import type { ReservationWithSpots } from "@/lib/types";

const QS_KEY = "family-cottage-dismissedQuickStart";

/* ─── Types ──────────────────────────────────────────────────── */
type BootstrapResponse = {
  authenticated: boolean;
  reservations: ReservationWithSpots[];
  sleepingSpots: { id: string; name: string; capacity: number; sort_order: number; active: boolean }[];
  settings: { max_total_guests: number; season_start: string | null; season_end: string | null } | null;
};

type Draft = {
  groupName: string; startDate: string; endDate: string;
  guestCount: number; notes: string; sleepingSpotIds: string[];
};

const BLANK: Draft = { groupName: "", startDate: "", endDate: "", guestCount: 2, notes: "", sleepingSpotIds: [] };

/* ─── Pure helpers ───────────────────────────────────────────── */
function fmtDates(start: string, end: string): string {
  try {
    const s = new Date(`${start}T12:00:00`);
    const e = new Date(`${end}T12:00:00`);
    const y = s.getFullYear();
    const mo: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    if (s.getFullYear() === e.getFullYear()) {
      if (s.getMonth() === e.getMonth())
        return `${s.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${e.getDate()}, ${y}`;
      return `${s.toLocaleDateString("en-US", mo)} – ${e.toLocaleDateString("en-US", { ...mo, year: "numeric" })}`;
    }
    return `${s.toLocaleDateString("en-US", { ...mo, year: "numeric" })} – ${e.toLocaleDateString("en-US", { ...mo, year: "numeric" })}`;
  } catch { return `${start} → ${end}`; }
}

function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function niceError(msg: string): string {
  if (msg.includes("spots are already booked"))
    return "Someone already has those rooms for part of those dates. Try different rooms or dates.";
  if (msg.includes("Guest capacity exceeded"))
    return "That would exceed the house limit for at least one night. Reduce the guest count or shift your dates.";
  if (msg.includes("Checkout date must be after"))
    return "Your departure date must be after your first night.";
  return msg;
}

/* ─── Small shared components ────────────────────────────────── */
function Banner({ variant, children }: { variant: "forest" | "amber" | "rose"; children: React.ReactNode }) {
  return <div className={`banner-${variant}`}>{children}</div>;
}

/* ─── Trip card ──────────────────────────────────────────────── */
function TripCard({
  r, authed, isEditing, onEdit, onDelete,
}: {
  r: ReservationWithSpots; authed: boolean; isEditing: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rooms = r.spots.map((s) => s.name).join(", ");
  const today = todayIso();
  const isPast = r.end_date < today;

  return (
    <li style={{
      background: "var(--bg-card)",
      border: `1px solid ${isEditing ? "var(--accent)" : "var(--border-light)"}`,
      borderRadius: "var(--radius-lg)",
      boxShadow: isEditing ? `0 0 0 2px var(--accent-faint), var(--shadow-card)` : "var(--shadow-card)",
      padding: "16px 18px",
      listStyle: "none",
      opacity: isPast ? .65 : 1,
      transition: "box-shadow .2s, border-color .2s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <p style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 16, color: "var(--text-primary)", margin: 0 }}>
              {r.group_name}
            </p>
            {isPast && (
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-muted)", background: "var(--bg-subtle)", border: "1px solid var(--border-light)", borderRadius: 4, padding: "1px 6px" }}>
                Past
              </span>
            )}
            {isEditing && (
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--accent)", background: "var(--accent-faint)", border: "1px solid var(--accent-mid)", borderRadius: 4, padding: "1px 6px" }}>
                Editing
              </span>
            )}
          </div>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--text-secondary)", margin: "0 0 3px" }}>
            {fmtDates(r.start_date, r.end_date)}
          </p>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            {r.guest_count} {r.guest_count === 1 ? "person" : "people"}{rooms ? ` · ${rooms}` : ""}
          </p>
          {r.notes ? (
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", margin: "6px 0 0" }}>
              "{r.notes}"
            </p>
          ) : null}
        </div>

        {authed && !confirmDelete && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" onClick={onEdit} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }}>
              {isEditing ? "Editing…" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="btn-secondary"
              style={{ padding: "6px 12px", fontSize: 12, color: "var(--rose-700)", borderColor: "var(--rose-border)" }}
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Inline delete confirmation — no native confirm() dialog */}
      {confirmDelete && (
        <div className="delete-confirm">
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--rose-700)", margin: 0, flex: 1 }}>
            Remove this trip?
          </p>
          <button
            type="button"
            onClick={() => { setConfirmDelete(false); onDelete(); }}
            className="btn-danger"
            style={{ padding: "6px 16px", fontSize: 13 }}
          >
            Yes, remove
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="btn-secondary"
            style={{ padding: "6px 14px", fontSize: 13 }}
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function Home() {
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [formError, setFormError] = useState("");
  const [bedroomErr, setBedroomErr] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showQS, setShowQS] = useState(false);
  const bedroomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLElement>(null);

  const reservationCount = data?.reservations.length ?? 0;

  useEffect(() => {
    if (!toast) return;
    const id = globalThis.setTimeout(() => setToast(null), 5000);
    return () => globalThis.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!authed) return;
    try { setShowQS(!localStorage.getItem(QS_KEY)); } catch { setShowQS(true); }
  }, [authed]);

  async function loadData() {
    setLoadError(null);
    try {
      const res = await fetch("/api/bootstrap");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load");
      setData({
        authenticated: Boolean(body.authenticated),
        reservations:  body.reservations  ?? [],
        sleepingSpots: body.sleepingSpots ?? [],
        settings:      body.settings      ?? null,
      });
      setAuthed(Boolean(body.authenticated));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
      setData(null); setAuthed(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const sorted = useMemo(
    () => [...(data?.reservations ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [data?.reservations],
  );

  const nextTrip = useMemo(() => {
    const t = todayIso();
    return sorted.find((r) => r.end_date >= t) ?? null;
  }, [sorted]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setAuthError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const body = await res.json();
      if (!res.ok) {
        setAuthError(body.error === "Incorrect passcode"
          ? "That code doesn't match — ask a family member."
          : body.error || "Something went wrong.");
        return;
      }
      setPasscode(""); await loadData();
    } finally { setLoading(false); }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthed(false); setEditingId(null); setDraft(BLANK);
    await loadData();
  }

  async function submitReservation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFormError(""); setBedroomErr(false);

    if (!draft.startDate || !draft.endDate) {
      setFormError("Drag on the calendar to choose your nights, or type dates below the calendar.");
      return;
    }
    if (draft.startDate >= draft.endDate) {
      setFormError("Your departure date must come after your first night.");
      return;
    }
    if (draft.sleepingSpotIds.length === 0) {
      setBedroomErr(true);
      setFormError("Select at least one bedroom before saving.");
      setTimeout(() => bedroomRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return;
    }

    setLoading(true);
    try {
      const url = editingId ? `/api/reservations/${editingId}` : "/api/reservations";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json();
      if (!res.ok) { setFormError(niceError(body.error ?? "Couldn't save. Try again.")); return; }
      const { startDate, endDate } = draft;
      setToast(editingId
        ? `Updated — ${fmtDates(startDate, endDate)}`
        : `Saved! You're on the calendar for ${fmtDates(startDate, endDate)}`
      );
      setDraft(BLANK); setEditingId(null); setShowNote(false); setFormError(""); setBedroomErr(false);
      await loadData();
    } finally { setLoading(false); }
  }

  function startEdit(r: ReservationWithSpots) {
    setEditingId(r.id);
    setDraft({
      groupName: r.group_name, startDate: r.start_date, endDate: r.end_date,
      guestCount: r.guest_count, notes: r.notes ?? "", sleepingSpotIds: r.spots.map((s) => s.id),
    });
    setShowNote(!!r.notes); setFormError(""); setBedroomErr(false);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function deleteReservation(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) { setFormError(niceError(body.error ?? "Couldn't remove.")); return; }
      setToast("Trip removed from the calendar.");
      if (editingId === id) { setEditingId(null); setDraft(BLANK); }
      await loadData();
    } finally { setLoading(false); }
  }

  function toggleSpot(id: string) {
    setBedroomErr(false); setFormError("");
    setDraft((c) => ({
      ...c,
      sleepingSpotIds: c.sleepingSpotIds.includes(id)
        ? c.sleepingSpotIds.filter((x) => x !== id)
        : [...c.sleepingSpotIds, id],
    }));
  }

  function handleOverviewEdit(id: string) {
    const r = data?.reservations.find((x) => x.id === id);
    if (r) startEdit(r);
  }

  function handleFormRangeSelect(range: { startDate: string; endDate: string }) {
    setFormError(""); setBedroomErr(false);
    setDraft((c) => ({ ...c, startDate: range.startDate, endDate: range.endDate }));
  }

  function clearDates() {
    setDraft((c) => ({ ...c, startDate: "", endDate: "" }));
    setFormError("");
  }

  /* ─── Top bar (always rendered once authed/unauthed settled) */
  const topBar = (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: "var(--forest-700)", zIndex: 60 }} aria-hidden />
  );

  /* ─── Loading skeleton ─────────────────────────────────────── */
  if (data === null && loadError === null) {
    return (
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "40px 20px" }} className="app-main-pad">
        {[{ h: 60, w: "40%" }, { h: 220, w: "100%" }, { h: 180, w: "100%" }].map(({ h, w }, i) => (
          <div key={i} className="skeleton" style={{ height: h, width: w, borderRadius: 12, background: "var(--sand-200)", marginBottom: 16 }} />
        ))}
        <p className="sr-only">Loading calendar…</p>
      </main>
    );
  }

  /* ─── Load error ───────────────────────────────────────────── */
  if (data === null && loadError) {
    return (
      <main style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px", textAlign: "center" }} className="app-main-pad">
        <p style={{ color: "var(--rose-700)", fontFamily: "var(--font-ui)", marginBottom: 20 }}>{loadError}</p>
        <button type="button" onClick={() => void loadData()} className="btn-primary">Try again</button>
      </main>
    );
  }

  /* ─── PUBLIC VIEW ──────────────────────────────────────────── */
  if (!authed && data) {
    return (
      <>
        {topBar}
        <main
          className="app-main-pad"
          style={{ maxWidth: 920, margin: "0 auto", paddingTop: 28, paddingBottom: "max(60px, env(safe-area-inset-bottom))", paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}
        >
          {/* Page header */}
          <header style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>
              Ephraim Cottage
            </p>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "clamp(26px,5vw,38px)", color: "var(--text-primary)", margin: "0 0 8px", letterSpacing: "-.01em" }}>
              Who's there when?
            </h1>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--text-secondary)", maxWidth: 440, margin: 0, lineHeight: 1.6 }}>
              See upcoming stays below. Sign in with the family code to add or change trips.
            </p>
            {nextTrip && (
              <div style={{ marginTop: 14, maxWidth: 480 }}>
                <Banner variant="forest">
                  <strong>Next up:</strong> {nextTrip.group_name} · {fmtDates(nextTrip.start_date, nextTrip.end_date)}
                </Banner>
              </div>
            )}
          </header>

          {/* Jump nav — visible on all screen sizes */}
          <nav className="jump-nav" aria-label="Page sections" style={{ marginLeft: "calc(-1 * max(1rem, env(safe-area-inset-left)))", marginRight: "calc(-1 * max(1rem, env(safe-area-inset-right)))", paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}>
            <a href="#overview-cal" className="nav-pill">Calendar</a>
            <a href="#public-trips" className="nav-pill">Upcoming trips</a>
            <a href="#sign-in" className="nav-pill">Sign in</a>
          </nav>

          {/* 3-month read-only overview */}
          <div style={{ marginTop: 20 }}>
            <MonthPlanner
              sectionId="overview-cal"
              reservations={sorted}
              readOnly
              monthCount={3}
            />
          </div>

          {/* Upcoming trips */}
          <section id="public-trips" className="jump-target" style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 20, color: "var(--text-primary)", margin: 0 }}>
                Upcoming trips
              </h2>
              {sorted.length > 0 && (
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--text-muted)" }}>
                  {sorted.length} {sorted.length === 1 ? "booking" : "bookings"}
                </span>
              )}
            </div>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              Read-only view — sign in below to add or change trips.
            </p>
            {sorted.length === 0 ? (
              <div style={{ border: "1.5px dashed var(--border)", borderRadius: "var(--radius-lg)", padding: "32px 24px", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-ui)", fontSize: 14 }}>
                No trips yet. Sign in to add the first one.
              </div>
            ) : (
              <ul style={{ padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {sorted.map((r) => (
                  <TripCard key={r.id} r={r} authed={false} isEditing={false} onEdit={() => {}} onDelete={() => {}} />
                ))}
              </ul>
            )}
          </section>

          {/* Sign-in form */}
          <div id="sign-in" className="jump-target" style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "28px 24px", maxWidth: 400, marginBottom: 40 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 20, color: "var(--text-primary)", margin: "0 0 4px" }}>
              Family sign-in
            </h2>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>
              Enter the shared family code to manage trips.
            </p>
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label" htmlFor="passcode-pub">Family code</label>
                <input
                  id="passcode-pub" type="password" required autoComplete="off"
                  placeholder="••••••" value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="input"
                />
              </div>
              {authError && <Banner variant="rose">{authError}</Banner>}
              <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", fontSize: 15, padding: "13px 24px" }}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </main>
      </>
    );
  }

  if (!data) return null;

  /* ─── AUTHENTICATED VIEW ───────────────────────────────────── */
  return (
    <>
      {topBar}
      <main
        className="app-main-pad"
        style={{ maxWidth: 920, margin: "0 auto", paddingTop: 24, paddingBottom: "max(60px, env(safe-area-inset-bottom))", paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}
      >
        {/* Screen-reader live region for date selection feedback */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {draft.startDate && draft.endDate
            ? `Dates selected: ${fmtDates(draft.startDate, draft.endDate)}`
            : draft.startDate ? "First night selected, drag to your last night." : ""}
        </div>

        {/* Page header */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 6 }}>
              Ephraim Cottage
            </p>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: "clamp(22px,4vw,32px)", color: "var(--text-primary)", margin: "0 0 4px", letterSpacing: "-.01em" }}>
              Who's there when?
            </h1>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              {reservationCount === 0 ? "No trips yet — add yours below." : `${reservationCount} trip${reservationCount === 1 ? "" : "s"} on the calendar.`}
            </p>
            {nextTrip && (
              <div style={{ marginTop: 12, maxWidth: 480 }}>
                <Banner variant="forest">
                  <strong>Next up:</strong> {nextTrip.group_name} · {fmtDates(nextTrip.start_date, nextTrip.end_date)}
                </Banner>
              </div>
            )}
          </div>
          <button type="button" onClick={() => void handleLogout()} className="btn-secondary" style={{ flexShrink: 0 }}>
            Sign out
          </button>
        </header>

        {/* Jump nav — shown on all screens */}
        <nav
          className="jump-nav"
          aria-label="Page sections"
          style={{ marginLeft: "calc(-1 * max(1rem, env(safe-area-inset-left)))", marginRight: "calc(-1 * max(1rem, env(safe-area-inset-right)))", paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}
        >
          <a href="#overview-cal" className="nav-pill">Calendar</a>
          <a href="#add-trip" className="nav-pill">
            {editingId ? "Editing trip" : "Add trip"}
          </a>
          <a href="#all-trips" className="nav-pill">All trips</a>
        </nav>

        {/* 3-month interactive overview */}
        <div style={{ marginTop: 20 }}>
          <MonthPlanner
            sectionId="overview-cal"
            reservations={sorted}
            readOnly
            monthCount={3}
            onSelectReservation={handleOverviewEdit}
          />
        </div>

        {/* Quick start hint (first login only) */}
        {showQS && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderLeft: "3px solid var(--accent)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
              <div>
                <p style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 13, color: "var(--forest-800)", margin: "0 0 6px" }}>Quick start</p>
                <ul style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--text-secondary)", paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
                  <li>Use the <strong>Book a stay</strong> form below to add your trip.</li>
                  <li>Drag across nights in the form's calendar to pick your dates.</li>
                  <li>Pick at least one bedroom — required before saving.</li>
                  <li>Tap a name on the overview calendar to edit that booking.</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => { try { localStorage.setItem(QS_KEY, "1"); } catch { /* */ } setShowQS(false); }}
                className="btn-secondary"
                style={{ flexShrink: 0, fontSize: 12, padding: "6px 12px" }}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* ── BOOKING FORM ─────────────────────────────────────── */}
        <section
          ref={formRef}
          id="add-trip"
          className="jump-target"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "22px 22px", marginBottom: 28 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 20, color: "var(--text-primary)", margin: 0 }}>
              {editingId ? "Edit trip" : "Book a stay"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={() => { setEditingId(null); setDraft(BLANK); setShowNote(false); setFormError(""); setBedroomErr(false); }}
                className="btn-secondary"
                style={{ fontSize: 12, padding: "6px 12px" }}
              >
                ✕ Cancel edit
              </button>
            )}
          </div>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--text-muted)", margin: "0 0 22px" }}>
            {editingId ? "Update the details below and save." : "Fill in the details, then hit Add to calendar."}
          </p>

          <form onSubmit={submitReservation} noValidate style={{ display: "flex", flexDirection: "column", gap: 22 }}>

            {/* 1. Group name */}
            <div>
              <label className="label" htmlFor="grp-name">Your name or group</label>
              <input
                id="grp-name" required
                placeholder="e.g. Mom & Dad, Sarah's crew"
                value={draft.groupName}
                onChange={(e) => setDraft((c) => ({ ...c, groupName: e.target.value }))}
                className="input"
                autoComplete="name"
              />
            </div>

            {/* 2. Dates — calendar drag + fallback text inputs */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p className="label" style={{ margin: 0 }}>Dates <span aria-hidden>*</span></p>
                {(draft.startDate || draft.endDate) && (
                  <button type="button" onClick={clearDates} className="btn-ghost" style={{ fontSize: 12 }}>
                    Clear dates
                  </button>
                )}
              </div>

              {/* Single-month interactive calendar for form */}
              <MonthPlanner
                sectionId="form-cal"
                heading="Drag to select your nights"
                reservations={sorted}
                rangeSelection
                rangeStart={draft.startDate}
                rangeEnd={draft.endDate}
                onRangeSelect={handleFormRangeSelect}
                onSelectReservation={handleOverviewEdit}
                monthCount={1}
                focusDate={draft.startDate || undefined}
              />

              {/* Date selection status */}
              {draft.startDate && draft.endDate ? (
                <Banner variant="forest">
                  <strong>Selected:</strong> {fmtDates(draft.startDate, draft.endDate)}
                </Banner>
              ) : draft.startDate && !draft.endDate ? (
                <Banner variant="amber">
                  Drag through the <strong>day you leave</strong> (checkout) to finish selecting.
                </Banner>
              ) : (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                  Click a day and drag across your nights. The checkout day is the morning after.
                </p>
              )}

              {/* Manual date entry fallback */}
              <details style={{ marginTop: 10, borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)", padding: "10px 14px", background: "var(--bg-subtle)" }}>
                <summary style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer", outline: "none", userSelect: "none" }}>
                  Type dates instead
                </summary>
                <div
                  className="date-grid-2col"
                  style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
                >
                  <div>
                    <label className="label" htmlFor="d-start">First night</label>
                    <input
                      id="d-start" type="date" value={draft.startDate}
                      onChange={(e) => setDraft((c) => ({ ...c, startDate: e.target.value }))}
                      className="input" style={{ fontSize: 15 }}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="d-end">Day you leave</label>
                    <input
                      id="d-end" type="date" value={draft.endDate}
                      min={draft.startDate || undefined}
                      onChange={(e) => setDraft((c) => ({ ...c, endDate: e.target.value }))}
                      className="input" style={{ fontSize: 15 }}
                    />
                  </div>
                </div>
              </details>
            </div>

            {/* 3. Guest count */}
            <div>
              <label className="label" htmlFor="guests">Number of guests</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Stepper buttons for easier mobile use */}
                <button
                  type="button"
                  aria-label="Decrease guest count"
                  onClick={() => setDraft((c) => ({ ...c, guestCount: Math.max(1, c.guestCount - 1) }))}
                  className="btn-secondary"
                  style={{ width: 40, height: 40, padding: 0, fontSize: 20, flexShrink: 0 }}
                >
                  −
                </button>
                <input
                  id="guests" type="number" min={1} max={30} required
                  value={draft.guestCount}
                  onChange={(e) => setDraft((c) => ({ ...c, guestCount: Math.max(1, Math.min(30, Number(e.target.value) || 1)) }))}
                  className="input"
                  style={{ maxWidth: 80, textAlign: "center" }}
                  aria-label="Guest count"
                />
                <button
                  type="button"
                  aria-label="Increase guest count"
                  onClick={() => setDraft((c) => ({ ...c, guestCount: Math.min(30, c.guestCount + 1) }))}
                  className="btn-secondary"
                  style={{ width: 40, height: 40, padding: 0, fontSize: 20, flexShrink: 0 }}
                >
                  +
                </button>
              </div>
            </div>

            {/* 4. Bedrooms — always visible, required */}
            <div ref={bedroomRef}>
              <p
                className="label"
                style={{ marginBottom: 6, color: bedroomErr ? "var(--rose-700)" : undefined }}
              >
                Bedrooms / sleeping spots <span style={{ color: "var(--rose-700)" }} aria-label="required">*</span>
              </p>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
                Select all rooms your group will use. At least one is required to prevent double-booking.
              </p>

              {(data.sleepingSpots ?? []).length === 0 ? (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                  No rooms configured — contact the admin.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(data.sleepingSpots ?? []).map((spot) => {
                    const on = draft.sleepingSpotIds.includes(spot.id);
                    return (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => toggleSpot(spot.id)}
                        className={`spot-chip${on ? " active" : ""}${bedroomErr && !on ? " spot-error" : ""}`}
                        aria-pressed={on}
                      >
                        {on && <span aria-hidden style={{ fontSize: 12 }}>✓</span>}
                        {spot.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {bedroomErr && (
                <div style={{ marginTop: 8 }}>
                  <Banner variant="rose">⚠ Please select at least one bedroom before saving.</Banner>
                </div>
              )}
            </div>

            {/* 5. Optional note */}
            {!showNote && !draft.notes ? (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="btn-ghost"
                style={{ alignSelf: "flex-start" }}
              >
                + Add a note (optional)
              </button>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label className="label" htmlFor="note" style={{ margin: 0 }}>Note (optional)</label>
                  {!draft.notes && (
                    <button type="button" onClick={() => setShowNote(false)} className="btn-ghost" style={{ fontSize: 11 }}>
                      Hide
                    </button>
                  )}
                </div>
                <textarea
                  id="note" rows={2}
                  placeholder="e.g. bringing the dog, kids-only weekend…"
                  value={draft.notes}
                  onChange={(e) => setDraft((c) => ({ ...c, notes: e.target.value }))}
                  className="input"
                  style={{ resize: "vertical", minHeight: 72 }}
                />
              </div>
            )}

            {/* Form-level error (non-bedroom) */}
            {formError && !bedroomErr && (
              <Banner variant="amber">{formError}</Banner>
            )}

            {/* Submit / cancel */}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ minWidth: 180, fontSize: 15, padding: "13px 28px" }}
              >
                {loading ? "Saving…" : editingId ? "Save changes" : "Add to calendar"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setDraft(BLANK); setShowNote(false); setFormError(""); setBedroomErr(false); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* ── ALL TRIPS LIST ────────────────────────────────────── */}
        <section id="all-trips" className="jump-target" style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 20, color: "var(--text-primary)", margin: 0 }}>
              All trips
            </h2>
            {sorted.length > 0 && (
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--text-muted)" }}>
                {sorted.length} {sorted.length === 1 ? "booking" : "bookings"}
              </span>
            )}
          </div>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Tap Edit to change a trip, or tap a name on the calendar above.
          </p>

          {sorted.length === 0 ? (
            <div style={{ border: "1.5px dashed var(--border)", borderRadius: "var(--radius-lg)", padding: "32px 24px", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-ui)", fontSize: 14 }}>
              No trips yet — use the form above to add yours.
            </div>
          ) : (
            <ul style={{ padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {sorted.map((r) => (
                <TripCard
                  key={r.id} r={r} authed={authed}
                  isEditing={editingId === r.id}
                  onEdit={() => startEdit(r)}
                  onDelete={() => deleteReservation(r.id)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <button
            type="button"
            onClick={() => setShowHow((v) => !v)}
            className="btn-secondary"
            style={{ width: "100%", display: "flex", justifyContent: "space-between", textAlign: "left" }}
          >
            <span>How this works</span>
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{showHow ? "−" : "+"}</span>
          </button>
          {showHow && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "0 0 var(--radius-md) var(--radius-md)", padding: "16px 20px", marginTop: -1 }}>
              <ul style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--text-secondary)", paddingLeft: 20, margin: 0, lineHeight: 1.9 }}>
                <li>The overview shows 3 months at once — tap any name chip to jump straight to editing that booking.</li>
                <li>Green-tinted days are already booked; amber is your current draft before saving.</li>
                <li>The left orange edge on a date = checkout morning. You don't sleep there that night.</li>
                <li>You must select at least one bedroom so we can catch room conflicts before they happen.</li>
                <li>If the house would be over capacity on any night, you'll see an error and can adjust.</li>
                <li>Past trips appear faded in the list — they're still there for reference.</li>
              </ul>
              {data.settings && (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-muted)", marginTop: 12, marginBottom: 0 }}>
                  House limit: {data.settings.max_total_guests} guests total ·{" "}
                  Typical season: {data.settings.season_start ?? "?"} – {data.settings.season_end ?? "?"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── TOAST ────────────────────────────────────────────── */}
        {toast && (
          <div
            role="status" aria-live="polite"
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "center", pointerEvents: "none", padding: "16px max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))" }}
          >
            <div
              className="toast-animate"
              style={{ background: "var(--forest-800)", color: "#fff", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, padding: "12px 22px", borderRadius: "var(--radius-md)", boxShadow: "0 4px 24px rgba(0,0,0,.28)", maxWidth: 480, textAlign: "center", pointerEvents: "auto" }}
            >
              {toast}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
