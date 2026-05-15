import React from 'react';
import { AnalyticsSectionHeader, AnalyticsLoadingState, AnalyticsEmptyState, AnalyticsErrorState } from './AnalyticsShared.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// RecentFlightsTable — Tabular view of most recently captured flight snapshots
//
// INSIGHT PROVIDED:
//   Answers: "What flights were recorded in COK airspace recently?"
//   This table is the "raw evidence" view — it lets you verify the telemetry
//   pipeline is working and see what real aircraft the system is capturing.
//   It also shows altitude/speed distributions across recent traffic.
//
// WHY A TABLE (not a chart):
//   - Individual flight records are multi-attribute (callsign, type, alt, speed, time).
//   - Tables are the correct encoding for multi-attribute record inspection.
//   - A chart would aggregate this into a single axis, losing the per-flight detail.
//   - Users of aviation analytics tools (ForeFlight, FlightAware) expect tabular
//     flight data as a primary view — it's the industry convention.
//
// DATA NOTES:
//   - Altitude is stored in feet (INT) in PostgreSQL after our rounding fix.
//   - Speed is stored in knots (INT).
//   - captured_at is a TIMESTAMPTZ — we format it to local HH:MM:SS for readability.
//   - callsign may be null if the aircraft didn't broadcast an ICAO callsign.
// ─────────────────────────────────────────────────────────────────────────────

const formatTime = (isoString) => {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const COLS = [
  { label: 'Callsign', key: 'callsign', mono: true },
  { label: 'Type', key: 'aircraft', mono: true },
  { label: 'Alt (ft)', key: 'altitude', align: 'right' },
  { label: 'Speed (kts)', key: 'speed', align: 'right' },
  { label: 'Captured', key: 'captured_at', format: formatTime },
];

export const RecentFlightsTable = ({ data, loading, error }) => {
  return (
    <div className="flex flex-col h-full">
      <AnalyticsSectionHeader
        icon="history"
        title="Recent Snapshots"
        subtitle="Latest 20 captured records"
      />

      {loading && <AnalyticsLoadingState rows={5} />}
      {!loading && error && <AnalyticsErrorState message={error} />}
      {!loading && !error && data.length === 0 && <AnalyticsEmptyState message="No snapshots yet" />}

      {!loading && !error && data.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {COLS.map(col => (
                  <th
                    key={col.key}
                    className={`pb-2 text-[9px] text-slate-500 uppercase tracking-[0.15em] font-medium ${col.align === 'right' ? 'text-right' : 'text-left'} px-1`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.id || i}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors duration-100"
                >
                  {COLS.map(col => {
                    const rawVal = row[col.key];
                    const display = col.format ? col.format(rawVal) : (rawVal ?? '—');
                    return (
                      <td
                        key={col.key}
                        className={`py-1.5 px-1 ${col.align === 'right' ? 'text-right' : 'text-left'} ${
                          col.mono ? 'font-mono text-primary-fixed-dim' : 'text-on-surface/70'
                        }`}
                      >
                        {display !== null && display !== undefined ? String(display) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
