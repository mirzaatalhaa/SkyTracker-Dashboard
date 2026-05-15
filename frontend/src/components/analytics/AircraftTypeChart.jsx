import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { AnalyticsSectionHeader, AnalyticsLoadingState, AnalyticsEmptyState, AnalyticsErrorState } from './AnalyticsShared.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// AircraftTypeChart — Horizontal bar chart of aircraft type frequency
//
// INSIGHT PROVIDED:
//   Answers: "What types of aircraft operate most frequently in COK airspace?"
//   This is a meaningful aviation question — it reveals whether COK is primarily
//   a narrowbody hub (A320 family), widebody capable (A330/B777), or regional
//   (ATR72/Dash 8). That pattern reflects route structures and airline strategy.
//
// WHY A BAR CHART:
//   - We're comparing discrete categories (ICAO aircraft type codes) by frequency.
//   - A bar chart is the clearest encoding for ranked categorical comparison.
//   - A pie chart would be tempting here but is harder to read when there are
//     6+ categories of similar size — bars give precise length encoding.
//   - Horizontal orientation gives enough room for 4-character ICAO codes on
//     the Y axis without rotation or truncation.
//
// DATA TRANSFORMATION:
//   Backend returns:  { aircraft: "A20N", count: "5" }
//   useAnalytics transforms to: { name: "A20N", value: 5 }
//   This component just renders — transformation is kept in the hook (separation
//   of concerns: the hook owns data shape, the component owns presentation).
// ─────────────────────────────────────────────────────────────────────────────

// Chart color palette — sky-blue family to stay consistent with the app theme.
// We cycle through these for each bar so the chart is visually rich.
const BAR_COLORS = [
  '#a2c9ff', '#7db4f5', '#5a9fe0', '#3a8acb', '#1e76b6',
  '#6dbfb8', '#4da3a0', '#2d8a88',
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-surface-container border border-white/10 rounded-lg px-3 py-2 text-[10px] shadow-xl">
      <div className="text-on-surface font-headline font-bold">{d.payload.name}</div>
      <div className="text-slate-400 mt-0.5">{d.value} snapshots captured</div>
    </div>
  );
};

export const AircraftTypeChart = ({ data, loading, error }) => {
  return (
    <div className="flex flex-col h-full">
      <AnalyticsSectionHeader
        icon="flight"
        title="Aircraft Type Distribution"
        subtitle="By snapshot frequency · Top 8"
      />

      {loading && <AnalyticsLoadingState rows={4} />}
      {!loading && error && <AnalyticsErrorState message={error} />}
      {!loading && !error && data.length === 0 && <AnalyticsEmptyState message="No type data yet" />}

      {!loading && !error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={data.length * 32 + 20}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="30%"
          >
            <XAxis
              type="number"
              tick={{ fill: '#64748b', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, index) => (
                <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
