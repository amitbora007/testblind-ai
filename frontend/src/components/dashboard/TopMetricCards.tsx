import React from 'react';
import { Card } from '@/components/ui/Card';
import { ClipboardCheck, FileText, Flag, BrainCircuit } from 'lucide-react';

export function TopMetricCards() {
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
              1,250
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-400">
              <div>Automated: <span className="text-emerald-400 font-medium">850</span></div>
              <div>Manual: <span className="text-slate-300 font-medium">400</span></div>
            </div>
          </div>

          {/* Mini Automation Rate Chart Graphic */}
          <div className="flex flex-col items-center gap-1.5 pl-2">
            <span className="text-[11px] font-semibold text-blue-400">68%</span>
            <div className="flex items-end gap-1.5 h-12 w-14 bg-slate-900/60 p-1 rounded-md border border-slate-800">
              <div className="w-1/3 bg-cyan-500 rounded-sm h-[40%]" title="Manual: 32%" />
              <div className="w-1/3 bg-blue-500 rounded-sm h-[68%]" title="Automated: 68%" />
              <div className="w-1/3 bg-purple-500 rounded-sm h-[50%]" title="Target: 50%" />
            </div>
            <span className="text-[10px] text-slate-400 whitespace-nowrap">
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
            <span className="text-xs text-slate-400 block mb-0.5">Total Req:</span>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              320
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-400">
              <div>Covered: <span className="text-blue-400 font-medium">295</span></div>
              <div>Untested: <span className="text-orange-400 font-medium">25</span></div>
            </div>
          </div>

          {/* Radial / Donut Gauge Graphic */}
          <div className="flex flex-col items-center">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                {/* Background Track */}
                <path
                  className="text-slate-800 stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* 92% Progress Arc */}
                <path
                  className="text-cyan-400 stroke-current drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                  strokeDasharray="92, 100"
                  strokeLinecap="round"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-white">92%</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">
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
              450
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-400">
              <div>Passed: <span className="text-emerald-400 font-medium">380</span></div>
              <div>Failed: <span className="text-red-400 font-medium">70</span></div>
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
              +14% this month
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
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">Flaky Tests Predicted:</span>
            <span className="text-xl font-bold text-white font-mono">15</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">Optimization Suggestions:</span>
            <span className="text-xl font-bold text-purple-300 font-mono">8</span>
          </div>
          <div className="pt-1 flex items-center gap-1.5 text-[10px] text-purple-400">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
            <span>AST mutation scanner ready</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
