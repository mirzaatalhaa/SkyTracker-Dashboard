import React, { useRef, useEffect } from 'react';
import { useAnalytics } from '../../hooks/useAnalytics.js';
import { AnalyticsMetricCard } from './AnalyticsShared.jsx';
import { AircraftTypeChart } from './AircraftTypeChart.jsx';
import { RecentFlightsTable } from './RecentFlightsTable.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// AnalyticsDashboard
//
// Only the active tab's content is mounted in the DOM at any given time.
// This means:
//  - Scroll position automatically resets to top on every tab switch
//  - No phantom empty space from hidden overflow tabs
//  - Each tab is independently scrollable when its content overflows
//  - A subtle CSS fade-in gives a smooth transition feel
// ─────────────────────────────────────────────────────────────────────────────

export const AnalyticsDashboard = ({ visible, isMobile, activeTab }) => {
  const analytics = useAnalytics();
  const scrollRef = useRef(null);

  // Belt-and-suspenders: also imperatively reset scroll on tab change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
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
        );
      case 'fleet':
        return (
          <AircraftTypeChart
            data={analytics.aircraftTypes}
            loading={analytics.aircraftTypesLoading}
            error={analytics.aircraftTypesError}
          />
        );
      case 'recent':
        return (
          <RecentFlightsTable
            data={analytics.recentFlights}
            loading={analytics.recentFlightsLoading}
            error={analytics.recentFlightsError}
          />
        );
      default:
        return null;
    }
  };

  return (
    <aside
      className="fixed z-40 flex flex-col bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5)] font-inter text-sm antialiased overflow-hidden transition-all duration-500 ease-out"
      style={{
        width: isMobile ? 'calc(100vw - 2rem)' : '24rem',
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
         
        </div>
      </div>

      {/* ── Tab Content ──
          key={activeTab} causes React to fully unmount+remount this div on
          every tab switch, which:
            1. Resets scrollTop to 0 automatically
            2. Ensures no content from the previous tab bleeds through
            3. Keeps the container height driven only by the active content
      */}
      <div
        key={activeTab}
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-5"
        style={{ animation: 'tabFadeIn 0.2s ease forwards' }}
      >
        {renderContent()}
      </div>

      {/* ── Footer ── */}
      <div className="text-[9px] text-slate-700 text-center py-2 bg-white/[0.01] border-t border-white/5 uppercase tracking-widest flex-shrink-0">
        Autonomous collection · 2 min intervals
      </div>

      <style>{`@keyframes tabFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </aside>
  );
};
