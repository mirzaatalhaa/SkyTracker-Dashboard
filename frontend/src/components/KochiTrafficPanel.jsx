import React from 'react';

const formatTime = (timeStr) => {
  if (!timeStr) return '--:--';
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};

const KochiTrafficPanel = ({ data, visible, isMobile = false }) => {
  const { arrivals, departures, total, recentArrivals, recentDepartures, loading, error, lastUpdated, isLiveFallback } = data;

  // Mobile: fixed top-right below header
  // Desktop: vertically centered on right edge
  const positionStyle = isMobile
    ? {
      top: '4.5rem',
      right: '1rem',
      transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 1rem))',
    }
    : {
      top: '50%',
      right: '1rem',
      transform: visible ? 'translateX(0) translateY(-50%)' : 'translateX(40px) translateY(-50%)',
    };

  return (
    <div
      className="fixed w-56 z-30 font-inter text-sm antialiased transition-all duration-500 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        ...positionStyle,
      }}
    >
      <div
        className="bg-white/[0.04] backdrop-blur-3xl rounded-2xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col h-auto pt-2"
      >
        {/* Accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent flex-shrink-0" />

        {/* Header */}
        <div className="px-4 pt-2 pb-3 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-sky-400 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                connecting_airports
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-sky-300 font-headline font-bold text-xs tracking-tight leading-none">COK Traffic</div>
              <div className="text-slate-500 text-[8px] uppercase tracking-[0.2em] mt-0.5">
                Today's Flights
              </div>
            </div>
          </div>
        </div>

        {/* Content body (Unconstrained) */}
        <div>

          {/* Loading / Error */}
          {loading && !arrivals && !departures ? (
            <div className="px-4 py-6 text-center">
              <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin mx-auto mb-2" />
              <div className="text-[9px] text-slate-500 uppercase tracking-widest">Loading data...</div>
            </div>
          ) : error && !arrivals && !departures ? (
            <div className="px-4 py-4 text-center">
              <span className="material-symbols-outlined text-amber-400/60 text-lg mb-1 block">warning</span>
              <div className="text-[9px] text-slate-500 uppercase tracking-widest">{error}</div>
            </div>
          ) : (
            <>
              {/* Inline error banner when showing stale data */}
              {error && (arrivals || departures) ? (
                <div className="mx-3 mt-3 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-400 text-xs">info</span>
                  <span className="text-[8px] text-amber-400/80 uppercase tracking-wider">{error}</span>
                </div>
              ) : null}

              {/* Stats */}
              <div className="px-4 pt-3 pb-3 border-b border-white/5">
                <div className="grid grid-cols-2 gap-2">
                  {/* Arrived */}
                  <div className="bg-emerald-500/[0.06] rounded-xl p-2.5 border border-emerald-500/10 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1.5">
                      <span className="material-symbols-outlined text-emerald-400/60 text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                        flight_land
                      </span>
                      <span className="text-[8px] text-emerald-400/70 uppercase tracking-widest font-semibold">
                        Landed
                      </span>
                    </div>
                    <div className="text-2xl font-headline font-extrabold text-emerald-400 leading-none tabular-nums">
                      {arrivals}
                    </div>
                  </div>

                  {/* Departed */}
                  <div className="bg-orange-500/[0.06] rounded-xl p-2.5 border border-orange-500/10 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1.5">
                      <span className="material-symbols-outlined text-orange-400/60 text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                        flight_takeoff
                      </span>
                      <span className="text-[8px] text-orange-400/70 uppercase tracking-widest font-semibold">
                        Departed
                      </span>
                    </div>
                    <div className="text-2xl font-headline font-extrabold text-orange-400 leading-none tabular-nums">
                      {departures}
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="mt-2 bg-white/[0.03] rounded-xl px-3 py-2 border border-white/5 flex items-center justify-between">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-medium">Total</span>
                  <span className="text-sm font-headline font-bold text-on-surface tabular-nums">{total}</span>
                </div>
              </div>

              {/* Recent arrivals */}
              {recentArrivals.length > 0 && (
                <div className="px-4 pt-3 pb-2 border-b border-white/5">
                  <div className="text-[8px] text-slate-500 uppercase tracking-[0.2em] mb-2 font-medium">Recent Arrivals</div>
                  <div className="space-y-1">
                    {recentArrivals.slice(0, 4).map((f, i) => (
                      <div key={`arr-${i}`} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-emerald-400/50 text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            flight_land
                          </span>
                          <span className="text-[10px] font-mono text-on-surface/80 truncate">{f.flight}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="text-[9px] text-slate-500 font-mono">{f.from}</span>
                          <span className="text-[9px] text-slate-600 font-mono">{formatTime(f.time)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent departures */}
              {recentDepartures.length > 0 && (
                <div className="px-4 pt-3 pb-3">
                  <div className="text-[8px] text-slate-500 uppercase tracking-[0.2em] mb-2 font-medium">Recent Departures</div>
                  <div className="space-y-1">
                    {recentDepartures.slice(0, 4).map((f, i) => (
                      <div key={`dep-${i}`} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-orange-400/50 text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            flight_takeoff
                          </span>
                          <span className="text-[10px] font-mono text-on-surface/80 truncate">{f.flight}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="text-[9px] text-slate-500 font-mono">{f.to}</span>
                          <span className="text-[9px] text-slate-600 font-mono">{formatTime(f.time)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          )}
        </div>

        {/* Last updated - appended physically at the bottom of the card list */}
        {!loading && !error && (arrivals || departures) && lastUpdated && (
          <div className="px-4 pb-2 pt-2 border-t border-white/5">
            <div className="text-[9px] text-slate-500 font-semibold text-center uppercase tracking-[0.2em]">
              Updated {formatTime(lastUpdated.toISOString())}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KochiTrafficPanel;
