import React from 'react';
import { useAnalytics } from '../../hooks/useAnalytics.js';
import { AnalyticsMetricCard } from './AnalyticsShared.jsx';
import { AircraftTypeChart } from './AircraftTypeChart.jsx';
import { RecentFlightsTable } from './RecentFlightsTable.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// AnalyticsDashboard
//
// This is the top-level panel that composes all analytics sections.
// It owns the useAnalytics hook and passes data down to each section.
//
// ARCHITECTURE DECISION — single hook, multiple sections:
//   All analytics data is fetched by one hook at this level. Each child
//   component receives only the slice it needs (no prop drilling of the full
//   analytics object). This avoids:
//   1. Multiple independent polls for the same backend
//   2. Out-of-sync loading states between sections
//   3. Redundant useEffect logic duplicated across components
//
// PANEL PLACEMENT:
//   This panel slides in from the right side of the screen on desktop, as a
//   sibling to the existing traffic panel (KochiTrafficPanel). On mobile it is
//   toggled via a FAB. It does NOT replace or modify the traffic panel.
// ─────────────────────────────────────────────────────────────────────────────

export const AnalyticsDashboard = ({ visible, isMobile, activeTab }) => {
  const analytics = useAnalytics();

  return (
    <aside
      className={`fixed z-40 flex flex-col bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5)] font-inter text-sm antialiased overflow-hidden transition-all duration-500 ease-out`}
      style={{
        width: isMobile ? 'calc(100vw - 2rem)' : '24rem',
        // Instead of sitting on the right, let's make it a floating panel above the navbar
        bottom: isMobile ? '6rem' : '7rem',
        left: '50%',
        transform: visible 
          ? 'translateX(-50%) translateY(0) scale(1)' 
          : 'translateX(-50%) translateY(20px) scale(0.95)',
        maxHeight: isMobile ? 'calc(100vh - 12rem)' : '70vh',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* ── Panel Header ── */}
      <div className="p-4 border-b border-white/5 flex-shrink-0 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                analytics
              </span>
            </div>
            <div>
              <div className="text-sky-300 font-headline font-bold text-sm tracking-tight">Analytics</div>
              <div className="text-slate-500 text-[9px] uppercase tracking-[0.2em]">Telemetry Database</div>
            </div>
          </div>
          {/* Last refreshed indicator */}
          <div className="text-right">
            {analytics.lastFetchedAt && (
              <div className="text-[9px] text-slate-600 font-mono">
                {analytics.lastFetchedAt.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-[8px] text-emerald-400/60 uppercase tracking-wider">Live DB</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-5 min-h-0 relative">
        <div className="transition-all duration-300 ease-in-out" style={{ opacity: activeTab === 'overview' ? 1 : 0, position: activeTab === 'overview' ? 'relative' : 'absolute', pointerEvents: activeTab === 'overview' ? 'auto' : 'none', visibility: activeTab === 'overview' ? 'visible' : 'hidden' }}>
          {/* ── KPI Metrics Strip ── */}
          <div className="grid grid-cols-2 gap-3">
            <AnalyticsMetricCard
              icon="database"
              label="Total Snapshots"
              value={analytics.flightCount !== null ? analytics.flightCount.toLocaleString() : '—'}
              sub="rows in flight_snapshots"
              loading={analytics.flightCountLoading}
              error={analytics.flightCountError}
              accentColor="text-primary"
            />
            <AnalyticsMetricCard
              icon="category"
              label="Aircraft Types"
              value={!analytics.aircraftTypesLoading && !analytics.aircraftTypesError ? analytics.aircraftTypes.length : '—'}
              sub="distinct ICAO codes"
              loading={analytics.aircraftTypesLoading}
              error={analytics.aircraftTypesError}
              accentColor="text-tertiary"
            />
            <AnalyticsMetricCard
              icon="speed"
              label="Avg Speed"
              value={
                analytics.recentFlights.length > 0
                  ? `${Math.round(analytics.recentFlights.reduce((s, f) => s + (f.speed || 0), 0) / analytics.recentFlights.length)} kts`
                  : '—'
              }
              sub="recent 20 snapshots"
              loading={analytics.recentFlightsLoading}
              error={analytics.recentFlightsError}
              accentColor="text-emerald-400"
            />
            <AnalyticsMetricCard
              icon="altitude"
              label="Avg Altitude"
              value={
                analytics.recentFlights.length > 0
                  ? `${Math.round(analytics.recentFlights.reduce((s, f) => s + (f.altitude || 0), 0) / analytics.recentFlights.length).toLocaleString()} ft`
                  : '—'
              }
              sub="recent 20 snapshots"
              loading={analytics.recentFlightsLoading}
              error={analytics.recentFlightsError}
              accentColor="text-secondary"
            />
          </div>
        </div>

        <div className="transition-all duration-300 ease-in-out" style={{ opacity: activeTab === 'fleet' ? 1 : 0, position: activeTab === 'fleet' ? 'relative' : 'absolute', pointerEvents: activeTab === 'fleet' ? 'auto' : 'none', top: activeTab === 'fleet' ? 'auto' : 20, left: 20, right: 20, visibility: activeTab === 'fleet' ? 'visible' : 'hidden' }}>
          {/* ── Aircraft Type Distribution ── */}
          <AircraftTypeChart
            data={analytics.aircraftTypes}
            loading={analytics.aircraftTypesLoading}
            error={analytics.aircraftTypesError}
          />
        </div>

        <div className="transition-all duration-300 ease-in-out" style={{ opacity: activeTab === 'recent' ? 1 : 0, position: activeTab === 'recent' ? 'relative' : 'absolute', pointerEvents: activeTab === 'recent' ? 'auto' : 'none', top: activeTab === 'recent' ? 'auto' : 20, left: 20, right: 20, visibility: activeTab === 'recent' ? 'visible' : 'hidden' }}>
          {/* ── Recent Snapshots Table ── */}
          <RecentFlightsTable
            data={analytics.recentFlights}
            loading={analytics.recentFlightsLoading}
            error={analytics.recentFlightsError}
          />
        </div>
      </div>
      
      {/* ── Footer note ── */}
      <div className="text-[9px] text-slate-700 text-center py-2 bg-white/[0.01] border-t border-white/5 uppercase tracking-widest">
        Autonomous collection · 2 min intervals
      </div>
    </aside>
  );
};
