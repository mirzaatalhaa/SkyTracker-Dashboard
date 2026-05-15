import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// AnalyticsMetricCard — a single KPI tile
//
// INSIGHT: Gives an at-a-glance view of a single telemetry number.
// Used for: total snapshots collected, unique aircraft types, etc.
//
// WHY THIS DESIGN:
//   Single metric cards are the entry point for any analytics dashboard.
//   They answer "what's the state of the system right now?" before the user
//   needs to read a chart. Aviation ops dashboards (FlightAware, FlightRadar24)
//   always lead with KPI strips.
// ─────────────────────────────────────────────────────────────────────────────
export const AnalyticsMetricCard = ({ icon, label, value, sub, loading, error, accentColor = 'text-primary' }) => (
  <div className="bg-white/[0.04] rounded-xl border border-white/[0.07] p-4 flex items-center gap-3.5 relative overflow-hidden transition-all hover:bg-white/[0.06]">
    {/* Subtle glow on the icon */}
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/[0.05] border border-white/[0.08] shadow-inner">
      <span className={`material-symbols-outlined text-lg ${accentColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    </div>
    <div className="flex-1 min-w-0 flex flex-col justify-center">
      <div className="text-[9px] text-slate-400 uppercase tracking-[0.2em] mb-1 font-medium">{label}</div>
      {loading ? (
        <div className="h-6 w-16 bg-white/5 rounded animate-pulse" />
      ) : error ? (
        <div className="text-xs text-red-400/70">Unavailable</div>
      ) : (
        <div className="flex flex-col">
          <div className={`text-xl font-headline font-extrabold leading-none tracking-tight ${accentColor}`}>{value}</div>
          {sub && <div className="text-[9px] text-slate-500 mt-1 font-medium">{sub}</div>}
        </div>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AnalyticsSectionHeader
// ─────────────────────────────────────────────────────────────────────────────
export const AnalyticsSectionHeader = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-2.5 mb-3">
    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
      <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    </div>
    <div>
      <div className="text-[11px] font-headline font-bold text-on-surface tracking-tight">{title}</div>
      {subtitle && <div className="text-[9px] text-slate-500 uppercase tracking-[0.15em]">{subtitle}</div>}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AnalyticsLoadingState / AnalyticsEmptyState / AnalyticsErrorState
// ─────────────────────────────────────────────────────────────────────────────
export const AnalyticsLoadingState = ({ rows = 3 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-8 bg-white/[0.03] rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
    ))}
  </div>
);

export const AnalyticsEmptyState = ({ message = 'No data yet' }) => (
  <div className="flex flex-col items-center justify-center py-6 text-center">
    <span className="material-symbols-outlined text-slate-600 text-2xl mb-2">inbox</span>
    <div className="text-[10px] text-slate-600 uppercase tracking-wider">{message}</div>
    <div className="text-[9px] text-slate-700 mt-1">Collecting data in background…</div>
  </div>
);

export const AnalyticsErrorState = ({ message }) => (
  <div className="flex items-center gap-2 py-4 px-3 rounded-lg bg-red-500/5 border border-red-500/10">
    <span className="material-symbols-outlined text-red-400/60 text-base">error</span>
    <div className="text-[10px] text-red-400/70">{message}</div>
  </div>
);
