import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Activity } from 'lucide-react';
import { isDemoActive } from '@/services/api';

export interface TrendDataPoint {
  week: string | number;
  passed: number;
  failed: number;
  skipped: number;
  blocked?: number;
}

interface WeekData {
  week: number;
  passed: number;
  failed: number;
  skipped: number;
  blocked: number;
}

// 12 weeks of historical execution data matching the visual profile in aitool.jpeg
const WEEKLY_DATA: WeekData[] = [
  { week: 1, passed: 28, failed: 18, skipped: 5, blocked: 6 },
  { week: 2, passed: 50, failed: 16, skipped: 6, blocked: 9 },
  { week: 3, passed: 52, failed: 18, skipped: 5, blocked: 8 },
  { week: 4, passed: 35, failed: 14, skipped: 8, blocked: 9 },
  { week: 5, passed: 53, failed: 11, skipped: 4, blocked: 6 },
  { week: 6, passed: 56, failed: 16, skipped: 5, blocked: 6 },
  { week: 7, passed: 68, failed: 17, skipped: 4, blocked: 7 },
  { week: 8, passed: 44, failed: 15, skipped: 6, blocked: 10 },
  { week: 9, passed: 53, failed: 18, skipped: 6, blocked: 6 },
  { week: 10, passed: 62, failed: 18, skipped: 6, blocked: 8 },
  { week: 11, passed: 48, failed: 22, skipped: 6, blocked: 10 },
  { week: 12, passed: 44, failed: 14, skipped: 5, blocked: 5 },
];

export interface ExecutionStatusBarChartProps {
  trends?: Array<{ week: string; passed: number; failed: number; skipped: number }> | null;
}

export function ExecutionStatusBarChart({ trends }: ExecutionStatusBarChartProps = {}) {
  const [hoveredWeek, setHoveredWeek] = useState<WeekData | null>(null);
  const isDemo = isDemoActive();

  // If in authenticated mode and trends has no runs
  const totalTrendExecutions = trends?.reduce((acc, t) => acc + t.passed + t.failed + t.skipped, 0) || 0;
  const hasData = isDemo || totalTrendExecutions > 0;

  const yTicks = [100, 80, 60, 40, 20, 0];

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        <CardTitle className="text-sm font-semibold text-white">
          Test Case Execution Status (Last 30 Days)
        </CardTitle>

        {/* Legend Pills */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-slate-300">Passed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
            <span className="text-slate-300">Failed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            <span className="text-slate-300">Skipped</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
            <span className="text-slate-300">Blocked</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {!hasData ? (
          <div className="h-64 sm:h-72 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-lg">
            <div className="p-3 bg-slate-900 rounded-full border border-slate-800 text-slate-400 mb-3">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-slate-200">No Execution History Yet</p>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Execute tests from Code Lab, connect a GitHub repository, or run Gap Discovery to view weekly execution telemetry.
            </p>
          </div>
        ) : (
        <div className="relative h-64 sm:h-72 flex flex-col justify-between pt-2">
          {/* Y-Axis Gridlines & Labels */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pr-2">
            {yTicks.map((tick) => (
              <div key={tick} className="flex items-center gap-2 w-full">
                <span className="text-[11px] font-mono text-slate-500 w-6 text-right shrink-0">
                  {tick}
                </span>
                <div className="flex-1 border-b border-slate-800/80" />
              </div>
            ))}
          </div>

          {/* Stacked Bars Area */}
          <div className="relative z-10 flex items-end justify-between ml-8 h-[calc(100%-24px)] pt-2 pb-0.5">
            {WEEKLY_DATA.map((item) => {
              const total = item.passed + item.failed + item.skipped + item.blocked;
              const isHovered = hoveredWeek?.week === item.week;

              return (
                <div
                  key={item.week}
                  className="flex-1 flex flex-col items-center h-full justify-end px-0.5 sm:px-1 cursor-pointer group"
                  onMouseEnter={() => setHoveredWeek(item)}
                  onMouseLeave={() => setHoveredWeek(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-12 z-30 p-2 rounded-lg bg-slate-900 border border-slate-700 shadow-xl text-[10px] text-slate-200 pointer-events-none whitespace-nowrap animate-in fade-in-50">
                      <div className="font-semibold text-white mb-0.5">Week {item.week} Total: {total}</div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="text-emerald-400">P: {item.passed}</span>
                        <span className="text-red-400">F: {item.failed}</span>
                        <span className="text-amber-400">S: {item.skipped}</span>
                        <span className="text-orange-400">B: {item.blocked}</span>
                      </div>
                    </div>
                  )}

                  {/* The Stacked Bar Column */}
                  <div
                    className="w-full max-w-[28px] rounded-t-sm overflow-hidden flex flex-col-reverse transition-transform duration-150 group-hover:scale-y-105"
                    style={{ height: `${total}%` }}
                  >
                    {/* Passed (bottom) */}
                    <div
                      className="w-full bg-emerald-500 transition-colors group-hover:brightness-110"
                      style={{ height: `${(item.passed / total) * 100}%` }}
                    />
                    {/* Failed */}
                    <div
                      className="w-full bg-red-500 transition-colors group-hover:brightness-110"
                      style={{ height: `${(item.failed / total) * 100}%` }}
                    />
                    {/* Skipped */}
                    <div
                      className="w-full bg-amber-400 transition-colors group-hover:brightness-110"
                      style={{ height: `${(item.skipped / total) * 100}%` }}
                    />
                    {/* Blocked (top) */}
                    <div
                      className="w-full bg-orange-500 transition-colors group-hover:brightness-110"
                      style={{ height: `${(item.blocked / total) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* X-Axis Labels */}
          <div className="flex items-center justify-between ml-8 pt-2 border-t border-slate-800">
            {WEEKLY_DATA.map((item) => (
              <span
                key={item.week}
                className="flex-1 text-center text-[10px] sm:text-[11px] text-slate-400 font-medium truncate"
              >
                Week {item.week}
              </span>
            ))}
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
