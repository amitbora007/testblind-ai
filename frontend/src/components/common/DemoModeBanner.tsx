import React from 'react';
import { Terminal } from 'lucide-react';

export interface DemoModeBannerProps {
  message?: string;
  context?: string;
}

export function DemoModeBanner({
  message,
  context,
}: DemoModeBannerProps) {
  const displayMessage =
    context ||
    message ||
    'DEMO ENVIRONMENT — Telemetry and test executions are simulated on precomputed AST fixtures. Unexecuted synthetic test candidates are strictly demarcated from verified test suites.';

  return (
    <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-slate-900/90 border border-blue-500/30 text-xs text-slate-300 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono font-semibold text-[10px] bg-blue-950 text-blue-300 border border-blue-600/40 shrink-0">
          DEMO MODE
        </span>
        <p className="truncate text-slate-400">{displayMessage}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0 text-[11px] text-blue-400 font-mono hidden sm:flex">
        <Terminal className="w-3.5 h-3.5" />
        <span>Sandboxes: Mocked (Zero API exec)</span>
      </div>
    </div>
  );
}

export default DemoModeBanner;
