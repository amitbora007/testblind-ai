import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { PieChart } from 'lucide-react';
import { isDemoActive } from '@/services/api';

interface Segment {
  id: string;
  label: string;
  percentage: number;
  count: number;
  color: string;
}

const SEGMENTS: Segment[] = [
  { id: 'fully', label: 'Fully Covered', percentage: 60, count: 192, color: '#3B82F6' },
  { id: 'partially', label: 'Partially Covered', percentage: 25, count: 80, color: '#8B5CF6' },
  { id: 'not_covered', label: 'Not Covered', percentage: 10, count: 32, color: '#F97316' },
  { id: 'obsolete', label: 'Obsolete', percentage: 5, count: 16, color: '#64748B' },
];

export interface RequirementCoverageDonutProps {
  slices?: Array<{ name: string; value: number; color: string }> | null;
}

export function RequirementCoverageDonut({ slices }: RequirementCoverageDonutProps = {}) {
  const [activeSegment, setActiveSegment] = useState<Segment | null>(null);
  const isDemo = isDemoActive();

  const totalSliceValue = slices?.reduce((acc, s) => acc + s.value, 0) || 0;
  const hasData = isDemo || totalSliceValue > 0;

  // SVG calculations for a 200x200 donut chart
  const radius = 70;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-white">
          Requirement Coverage Analysis
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col items-center justify-center p-4">
        {!hasData ? (
          <div className="h-48 sm:h-56 flex flex-col items-center justify-center text-center p-4">
            <div className="p-3 bg-slate-900 rounded-full border border-slate-800 text-slate-400 mb-2">
              <PieChart className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-sm font-medium text-slate-200">No Coverage Data Yet</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Coverage mapping requires linked projects and executed AST mutation test suites.
            </p>
          </div>
        ) : (
        <>
        {/* Donut Chart Display */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            {SEGMENTS.map((seg) => {
              const strokeDasharray = `${(seg.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += seg.percentage;

              const isHighlighted = activeSegment?.id === seg.id;

              return (
                <circle
                  key={seg.id}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-200 cursor-pointer hover:opacity-90"
                  style={{
                    filter: isHighlighted ? `drop-shadow(0 0 6px ${seg.color})` : undefined,
                    transformOrigin: 'center',
                  }}
                  onMouseEnter={() => setActiveSegment(seg)}
                  onMouseLeave={() => setActiveSegment(null)}
                />
              );
            })}
          </svg>

          {/* Donut Center Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {activeSegment ? activeSegment.count : '320'}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {activeSegment ? activeSegment.label : 'Total'}
            </span>
          </div>
        </div>

        {/* Legend Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 w-full pt-3 border-t border-slate-800">
          {SEGMENTS.map((seg) => (
            <div
              key={seg.id}
              className="flex items-center justify-between text-xs cursor-pointer p-1 rounded hover:bg-slate-800/40"
              onMouseEnter={() => setActiveSegment(seg)}
              onMouseLeave={() => setActiveSegment(null)}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-slate-300 truncate">{seg.label}</span>
              </div>
              <span className="font-semibold text-slate-100 font-mono pl-1">
                {seg.percentage}%
              </span>
            </div>
          ))}
        </div>
        </>
        )}
      </CardContent>
    </Card>
  );
}
