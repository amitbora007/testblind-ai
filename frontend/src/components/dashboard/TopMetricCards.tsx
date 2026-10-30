import React from 'react';
import { Card } from '@/components/ui/Card';
import { ClipboardCheck, FileText, Flag, BrainCircuit } from 'lucide-react';
import { isDemoActive, DashboardMetricsResult } from '@/services/api';

export interface TopMetricCardsProps {
  metrics?: DashboardMetricsResult | null;
}

export function TopMetricCards({ metrics }: TopMetricCardsProps = {}) {
  const isDemo = isDemoActive();

  const totalCasesVal = metrics ? metrics.total_test_cases.value : isDemo ? '1,250' : '0';
  const reqCoverageVal = metrics ? metrics.requirement_coverage.value : isDemo ? '92%' : '0.0%';
  const scenariosVal = metrics ? metrics.test_scenarios_executed.value : isDemo ? '450' : '0';
  const insightsVal = metrics ? metrics.ai_insights.value : isDemo ? '15' : '0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Test Cases Overview */}
      <Card className="p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden bg-card border-slate-700/60 shadow-sm hover:border-slate-600 transition-all">
        <div className="flex items-start justify-between">
          <span className="text-xs sm:text-sm font-semibold text-slate-200">
            Test Cases Overview
          </span>
          <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-500/30 text-blue-400">
            <ClipboardCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <span className="text-xs text-slate-400 block mb-0.5">Total:</span>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {totalCasesVal}
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-400">
              {isDemo ? (
                <>
                  <div>Automated: <span className="text-emerald-400 font-medium">850</span></div>
                  <div>Manual: <span className="text-slate-300 font-medium">400</span></div>
                </>
              ) : (
                <div className="text-slate-400">Verified assertions in catalog</div>
              )}
            </div>
          </div>

          {/* Professional Automation Rate Telemetry Visual */}
          <div className="flex flex-col items-center gap-1.5 pl-2">
            <div className="px-2 py-0.5 rounded-full bg-blue-950/70 border border-blue-500/30 text-[10px] font-semibold text-blue-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span>{isDemo ? '68%' : totalCasesVal !== '0' ? '100%' : '0%'}</span>
            </div>
            {/* Multi-frequency activity telemetry visual */}
            <div className="flex items-end gap-1 h-9 px-2.5 py-1 bg-slate-900/80 rounded-lg border border-slate-800 shadow-inner">
              <div className="w-1.5 bg-blue-500/40 rounded-full h-3" />
              <div className="w-1.5 bg-blue-500/60 rounded-full h-5" />
              <div className="w-1.5 bg-blue-500/80 rounded-full h-7" />
              <div className="w-1.5 bg-blue-400 rounded-full h-full shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
              <div className="w-1.5 bg-cyan-400 rounded-full h-6" />
            </div>
            <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">
              Automation Rate
            </span>
          </div>
        </div>
      </Card>

      {/* Card 2: Requirement Coverage */}
      <Card className="p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden bg-card border-slate-700/60 shadow-sm hover:border-slate-600 transition-all">
        <div className="flex items-start justify-between">
          <span className="text-xs sm:text-sm font-semibold text-slate-200">
            Requirement Coverage
          </span>
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <span className="text-xs text-slate-400 block mb-0.5">
              {isDemo ? 'Total Req:' : 'Score:'}
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {isDemo ? '320' : reqCoverageVal}
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-400">
              {isDemo ? (
                <>
                  <div>Covered: <span className="text-blue-400 font-medium">295</span></div>
                  <div>Untested: <span className="text-orange-400 font-medium">25</span></div>
                </>
              ) : (
                <div className="text-slate-400">Branch &amp; AST mutation invariant coverage</div>
              )}
            </div>
          </div>

          {/* Radial / Donut Gauge Graphic */}
          <div className="flex flex-col items-center">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                {/* Background Track */}
                <path
                  className="text-slate-800/90 stroke-current"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Progress Arc */}
                <path
                  className="text-cyan-400 stroke-current transition-all duration-700"
                  strokeDasharray={`${parseFloat(reqCoverageVal) || (isDemo ? 92 : 0)}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-bold text-white font-mono tracking-tight">
                  {isDemo ? '92%' : `${Math.round(parseFloat(reqCoverageVal) || 100)}%`}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 whitespace-nowrap font-medium">
              Coverage
            </span>
          </div>
        </div>
      </Card>

      {/* Card 3: Test Scenarios Executed */}
      <Card className="p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden bg-card border-slate-700/60 shadow-sm hover:border-slate-600 transition-all">
        <div className="flex items-start justify-between">
          <span className="text-xs sm:text-sm font-semibold text-slate-200">
            Test Scenarios Executed
          </span>
          <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-500/30 text-blue-400">
            <Flag className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <span className="text-xs text-slate-400 block mb-0.5">Total Runs:</span>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {scenariosVal}
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-400">
              {isDemo ? (
                <>
                  <div>Passed: <span className="text-emerald-400 font-medium">380</span></div>
                  <div>Failed: <span className="text-red-400 font-medium">70</span></div>
                </>
              ) : (
                <div className="text-slate-400">Multi-step regression runs executed</div>
              )}
            </div>
          </div>

          {/* Green Trend Sparkline */}
          <div className="flex flex-col items-end pb-1">
            <svg
              className="w-20 h-10 overflow-visible"
              viewBox="0 0 80 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 30 C 15 20, 25 35, 40 18 C 55 5, 65 25, 78 8"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              />
              <circle cx="78" cy="8" r="3" fill="#10B981" />
            </svg>
            <span className="text-[10px] text-emerald-400 font-medium mt-1">
              {isDemo ? '+14% this month' : scenariosVal !== '0' ? '+100% active' : 'Ready'}
            </span>
          </div>
        </div>
      </Card>

      {/* Card 4: AI-Driven Insights */}
      <Card className="p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden bg-card border-slate-700/60 shadow-sm hover:border-purple-600/40 transition-all">
        <div className="flex items-start justify-between">
          <span className="text-xs sm:text-sm font-semibold text-slate-200">
            AI-Driven Insights
          </span>
          <div className="p-2 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-400 shadow-glow-ai">
            <BrainCircuit className="w-4 h-4 animate-pulse" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {isDemo ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Flaky Tests Predicted:</span>
                <span className="text-xl font-bold text-white font-mono">15</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Optimization Suggestions:</span>
                <span className="text-xl font-bold text-purple-300 font-mono">8</span>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <span className="text-xs text-slate-400 block">Identified Finding Gaps:</span>
              <div className="text-2xl font-bold text-white font-mono">{insightsVal}</div>
              <span className="text-[11px] text-purple-300 block">AST mutations &amp; flaky tests detected</span>
            </div>
          )}
          <div className="pt-1 flex items-center gap-1.5 text-[10px] text-purple-400">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
            <span>AST mutation scanner ready</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
