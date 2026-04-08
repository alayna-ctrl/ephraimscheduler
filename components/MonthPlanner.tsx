"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addOneDayIso,
  buildMonthGrid,
  colorForGroup,
  isCheckoutDayOnCalendar,
  isNightInTripRange,
  monthLabel,
  reservationsOnDate,
} from "@/lib/planner";
import type { ReservationWithSpots } from "@/lib/types";

/* ─── Helpers ──────────────────────────────────────────────── */
function roomsLine(r: ReservationWithSpots): string {
  return r.spots.map((s) => s.name).join(", ");
}
function roomsLineShort(r: ReservationWithSpots, maxLen = 24): string {
  const s = roomsLine(r);
  return s.length <= maxLen ? s : `${s.slice(0, maxLen - 1)}…`;
}
function todayIsoLocal(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function offsetMonth(year: number, month0: number, delta: number) {
  let m = month0 + delta;
  let y = year;
  while (m > 11) { m -= 12; y++; }
  while (m < 0)  { m += 12; y--; }
  return { year: y, month0: m };
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/* ─── Types ────────────────────────────────────────────────── */
export type MonthPlannerProps = {
  reservations: ReservationWithSpots[];
  readOnly?: boolean;
  rangeSelection?: boolean;
  rangeStart?: string;
  rangeEnd?: string;
  onRangeSelect?: (range: { startDate: string; endDate: string }) => void;
  onRangeDayClick?: (isoDate: string) => void;
  onSelectDay?: (isoDate: string) => void;
  onSelectReservation?: (id: string) => void;
  heading?: string;
  compact?: boolean;
  /** How many months to render side-by-side (1 = default, 3 = overview) */
  monthCount?: number;
  /** If set, navigate to show this date when the component mounts or the date changes */
  focusDate?: string;
  /** Unique id for the section element (for aria / jump links) */
  sectionId?: string;
};

/* ─── Single month grid ────────────────────────────────────── */
function MonthGrid({
  year, month0, reservations, readOnly, rangeSelection,
  previewStart, previewEnd, useDragRange,
  onDayPointerDown, onDayClick, onSelectReservation,
  compact, today, isInteractiveOverview,
}: {
  year: number; month0: number;
  reservations: ReservationWithSpots[];
  readOnly: boolean; rangeSelection: boolean;
  previewStart: string; previewEnd: string;
  useDragRange: boolean;
  onDayPointerDown: (e: React.PointerEvent, iso: string) => void;
  onDayClick: (iso: string) => void;
  onSelectReservation?: (id: string) => void;
  compact: boolean; today: string;
  /** readOnly overview where chips are still clickable to edit */
  isInteractiveOverview: boolean;
}) {
  const grid = useMemo(() => buildMonthGrid(year, month0), [year, month0]);
  const cellMinH = compact ? 60 : 88;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Month label */}
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 14,
        fontWeight: 500,
        color: "var(--text-primary)",
        marginBottom: 5,
        paddingLeft: 2,
        letterSpacing: ".01em",
      }}>
        {monthLabel(year, month0)}
      </div>

      {/* Day-of-week header */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7,1fr)",
        gap: 1, borderRadius: "8px 8px 0 0", overflow: "hidden",
        background: "var(--border-light)", marginBottom: 1,
      }}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="cal-header-day">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div
        style={{
          display: "grid", gridTemplateColumns: "repeat(7,1fr)",
          gap: 1, background: "var(--border-light)",
          borderRadius: "0 0 8px 8px", overflow: "hidden",
        }}
        className={useDragRange ? "touch-none select-none" : ""}
      >
        {grid.flat().map((iso, idx) => {
          if (!iso) {
            return (
              <div key={`e${idx}`} className="cal-cell cal-cell-empty"
                style={{ minHeight: cellMinH }} aria-hidden />
            );
          }

          const dayRes = reservationsOnDate(iso, reservations);
          const isTodayCell = iso === today;
          const isPast = iso < today;
          const inDraft = rangeSelection && previewStart && previewEnd && isNightInTripRange(iso, previewStart, previewEnd);
          const draftOnly = rangeSelection && previewStart && !previewEnd && iso === previewStart;
          const isCheckout = rangeSelection && previewStart && previewEnd && isCheckoutDayOnCalendar(iso, previewStart, previewEnd);
          const dayNum = Number(iso.slice(8, 10));

          let cellCls = "cal-cell";
          if (inDraft || draftOnly) cellCls += " cal-cell-draft";
          else if (dayRes.length)   cellCls += " cal-cell-booked";
          if (isCheckout)           cellCls += " cal-cell-checkout";
          if (useDragRange)         cellCls += " cal-draggable";

          const dayNumCls = `cal-daynum${isTodayCell ? " cal-daynum-today" : isPast ? " cal-daynum-past" : ""}`;

          const dayNumEl = <span className={dayNumCls}>{dayNum}</span>;

          return (
            <div
              key={iso}
              data-planner-day={iso}
              onPointerDown={useDragRange ? (e) => onDayPointerDown(e, iso) : undefined}
              className={cellCls}
              style={{ minHeight: cellMinH }}
            >
              {/* Day number — clickable only in non-drag, non-readOnly contexts */}
              {useDragRange || readOnly ? (
                <div style={{ marginBottom: 2 }}>{dayNumEl}</div>
              ) : (
                <button
                  type="button"
                  aria-current={isTodayCell ? "date" : undefined}
                  aria-label={`${iso}${dayRes.length ? `, ${dayRes.length} booking${dayRes.length > 1 ? "s" : ""}` : ""}`}
                  onClick={() => onDayClick(iso)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 1, marginBottom: 2 }}
                >
                  {dayNumEl}
                </button>
              )}

              {/* Reservation chips */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, overflow: "hidden" }}>
                {dayRes.slice(0, compact ? 1 : 2).map((r) => {
                  const style = colorForGroup(r.group_name);
                  const rooms = roomsLine(r);
                  const chipTitle = rooms
                    ? `${r.group_name} — ${rooms} (${r.guest_count}p)`
                    : `${r.group_name} (${r.guest_count}p)`;

                  const inner = (
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
                      <span style={{
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontWeight: 600, fontSize: compact ? 9 : 10, lineHeight: 1.3,
                      }}>
                        {r.group_name}
                      </span>
                      {rooms && !compact ? (
                        <span style={{
                          fontSize: 8, opacity: .85,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3,
                        }}>
                          {roomsLineShort(r)}
                        </span>
                      ) : null}
                    </span>
                  );

                  const chipBase: React.CSSProperties = {
                    ...style,
                    borderRadius: 4,
                    padding: "2px 4px",
                    fontSize: compact ? 9 : 10,
                    lineHeight: 1.3,
                    display: "block",
                    fontFamily: "var(--font-ui)",
                    border: "none",
                    textAlign: "left",
                    width: "100%",
                    overflow: "hidden",
                  };

                  // Chips are clickable if this is the interactive overview (readOnly overview with edit support)
                  // or if onSelectReservation is passed and not readOnly
                  const canClick = (isInteractiveOverview || (!readOnly && !!onSelectReservation));

                  if (!canClick) {
                    return <span key={r.id} title={chipTitle} style={chipBase}>{inner}</span>;
                  }
                  return (
                    <button
                      key={r.id}
                      type="button"
                      title={chipTitle}
                      aria-label={`Edit: ${chipTitle}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectReservation?.(r.id);
                      }}
                      style={{ ...chipBase, cursor: "pointer" }}
                    >
                      {inner}
                    </button>
                  );
                })}
                {dayRes.length > (compact ? 1 : 2) && (
                  <span style={{
                    fontSize: 8, color: "var(--text-muted)",
                    paddingLeft: 3, fontFamily: "var(--font-ui)",
                  }}>
                    +{dayRes.length - (compact ? 1 : 2)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main MonthPlanner ────────────────────────────────────── */
export function MonthPlanner({
  reservations, readOnly = false,
  rangeSelection = false, rangeStart = "", rangeEnd = "",
  onRangeSelect, onRangeDayClick, onSelectDay, onSelectReservation,
  heading, compact = false, monthCount = 1, focusDate, sectionId,
}: MonthPlannerProps) {
  function getInitialYearMonth() {
    // If there's a focusDate or rangeStart, start there; otherwise current month
    const seed = focusDate || rangeStart;
    if (seed && /^\d{4}-\d{2}/.test(seed)) {
      return { year: parseInt(seed.slice(0, 4)), month0: parseInt(seed.slice(5, 7)) - 1 };
    }
    const n = new Date();
    return { year: n.getFullYear(), month0: n.getMonth() };
  }

  const init = getInitialYearMonth();
  const [year, setYear]   = useState(init.year);
  const [month0, setMonth0] = useState(init.month0);
  const [dragSession, setDragSession] = useState<{ anchor: string; hover: string } | null>(null);
  const dragAnchorRef = useRef("");
  const dragHoverRef  = useRef("");
  const today = todayIsoLocal();

  // When editing a trip, navigate the form calendar to show the selected dates
  useEffect(() => {
    const seed = focusDate || rangeStart;
    if (!seed || !seed.match(/^\d{4}-\d{2}/)) return;
    const y = parseInt(seed.slice(0, 4));
    const m = parseInt(seed.slice(5, 7)) - 1;
    // Only jump if currently showing a different month
    if (y !== year || m !== month0) {
      setYear(y);
      setMonth0(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusDate]);

  const normalizeDragRange = useCallback((anchor: string, hover: string) => {
    if (anchor === hover) return { startDate: anchor, endDate: addOneDayIso(anchor) };
    const lo = anchor < hover ? anchor : hover;
    const hi = anchor < hover ? hover : anchor;
    return { startDate: lo, endDate: addOneDayIso(hi) };
  }, []);

  const { previewStart, previewEnd } = useMemo(() => {
    if (dragSession) {
      const r = normalizeDragRange(dragSession.anchor, dragSession.hover);
      return { previewStart: r.startDate, previewEnd: r.endDate };
    }
    return { previewStart: rangeStart, previewEnd: rangeEnd };
  }, [dragSession, rangeStart, rangeEnd, normalizeDragRange]);

  const handleRangePointerDown = useCallback(
    (e: React.PointerEvent, iso: string) => {
      if (!onRangeSelect || readOnly) return;
      if (e.button !== 0) return;
      e.preventDefault();
      document.body.style.userSelect = "none";
      dragAnchorRef.current = iso;
      dragHoverRef.current  = iso;
      setDragSession({ anchor: iso, hover: iso });

      const onMove = (ev: PointerEvent) => {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const cell = el?.closest("[data-planner-day]");
        const next = cell?.getAttribute("data-planner-day");
        if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) {
          dragHoverRef.current = next;
          setDragSession({ anchor: dragAnchorRef.current, hover: next });
        }
      };
      const endDrag = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", endDrag);
        document.removeEventListener("pointercancel", endDrag);
        document.body.style.userSelect = "";
        const range = normalizeDragRange(dragAnchorRef.current, dragHoverRef.current);
        onRangeSelect(range);
        setDragSession(null);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", endDrag);
      document.addEventListener("pointercancel", endDrag);
    },
    [onRangeSelect, readOnly, normalizeDragRange],
  );

  function goPrev() { const r = offsetMonth(year, month0, -1); setYear(r.year); setMonth0(r.month0); }
  function goNext() { const r = offsetMonth(year, month0,  1); setYear(r.year); setMonth0(r.month0); }
  function goToday() { const n = new Date(); setYear(n.getFullYear()); setMonth0(n.getMonth()); }

  function handleDayClick(iso: string) {
    if (readOnly) return;
    if (rangeSelection && onRangeDayClick && !onRangeSelect) { onRangeDayClick(iso); return; }
    if (onSelectDay) onSelectDay(iso);
  }

  const useDragRange = rangeSelection && !!onRangeSelect;
  // overview = readOnly but chips are editable (authenticated overview)
  const isInteractiveOverview = readOnly && !!onSelectReservation;

  const helperText = readOnly && !isInteractiveOverview
    ? "Sign in below to add or change trips."
    : isInteractiveOverview
      ? "Tap a name to edit that booking."
      : useDragRange
        ? "Drag across the nights you'll sleep there. Amber = your selection."
        : "Tap a day to start booking.";

  const months = useMemo(
    () => Array.from({ length: monthCount }, (_, i) => offsetMonth(year, month0, i)),
    [year, month0, monthCount],
  );

  const navLabel = monthLabel(year, month0);
  const navLabelEnd = monthCount > 1
    ? monthLabel(months[months.length - 1].year, months[months.length - 1].month0)
    : null;

  return (
    <section
      id={sectionId}
      aria-labelledby={sectionId ? `${sectionId}-heading` : undefined}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        padding: compact ? "14px" : "20px",
        marginBottom: compact ? 12 : 24,
      }}
      className="jump-target"
    >
      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10,
      }}>
        <div style={{ minWidth: 0 }}>
          {heading ? (
            <p
              id={sectionId ? `${sectionId}-heading` : undefined}
              style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}
            >
              {heading}
            </p>
          ) : (
            <h2
              id={sectionId ? `${sectionId}-heading` : undefined}
              style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}
            >
              {navLabel}{navLabelEnd ? ` – ${navLabelEnd}` : ""}
            </h2>
          )}
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--text-muted)", margin: "3px 0 0" }}>
            {helperText}
          </p>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
          <button
            type="button" onClick={goPrev}
            className="btn-secondary" aria-label="Previous month"
            style={{ padding: "7px 11px", fontSize: 13, minHeight: 34 }}
          >
            ‹
          </button>
          <button
            type="button" onClick={goToday}
            className="btn-secondary" aria-label="Go to today"
            style={{ padding: "7px 11px", fontSize: 12, minHeight: 34, borderColor: "var(--accent-mid)", color: "var(--accent)", background: "var(--accent-faint)" }}
          >
            Today
          </button>
          <button
            type="button" onClick={goNext}
            className="btn-secondary" aria-label="Next month"
            style={{ padding: "7px 11px", fontSize: 13, minHeight: 34 }}
          >
            ›
          </button>
        </div>
      </div>

      {/* Colour key — shown inline, small, always visible */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12 }}>
        {[
          { bg: "var(--forest-100)", border: "var(--border)", label: "Booked" },
          { bg: "var(--amber-100)", border: "var(--amber-200)", label: "Your draft" },
          { bg: "var(--accent)", border: "var(--accent)", label: "Today", round: true },
        ].map(({ bg, border, label, round }) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-muted)" }}>
            <span style={{
              width: 12, height: 12, background: bg, border: `1px solid ${border}`,
              borderRadius: round ? "50%" : 3, display: "inline-block", flexShrink: 0,
            }} />
            {label}
          </span>
        ))}
        {rangeSelection && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--text-muted)" }}>
            <span style={{ width: 12, height: 12, background: "transparent", borderLeft: "3px solid var(--amber-400)", flexShrink: 0 }} />
            Checkout
          </span>
        )}
      </div>

      {/* Month grid(s) */}
      <div
        className="planner-scroll"
        style={{ display: "flex", gap: 14, overflowX: "auto", alignItems: "flex-start" }}
      >
        {months.map(({ year: y, month0: m }) => (
          <div
            key={`${y}-${m}`}
            style={{ flex: `1 1 ${monthCount > 1 ? "220px" : "260px"}`, minWidth: monthCount > 1 ? 210 : 250 }}
          >
            <MonthGrid
              year={y} month0={m}
              reservations={reservations}
              readOnly={readOnly}
              rangeSelection={rangeSelection}
              previewStart={previewStart}
              previewEnd={previewEnd}
              useDragRange={useDragRange}
              onDayPointerDown={handleRangePointerDown}
              onDayClick={handleDayClick}
              onSelectReservation={onSelectReservation}
              compact={compact || monthCount > 1}
              today={today}
              isInteractiveOverview={isInteractiveOverview}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
