import { cn } from '@/utils/cn';
import { CheckCircle2, XCircle, AlertCircle, StopCircle, Sparkles, ShieldCheck } from 'lucide-react';

export type TestStatus =
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'blocked'
  | 'ai_suggested'
  | 'verified';

export interface StatusPillProps {
  status: TestStatus;
  label?: string;
  className?: string;
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  switch (status) {
    case 'passed':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-500/30',
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{label || 'Passed'}</span>
        </span>
      );
    case 'failed':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-950/60 text-red-400 border border-red-500/30',
            className
          )}
        >
          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span>{label || 'Failed'}</span>
        </span>
      );
    case 'skipped':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/60 text-amber-400 border border-amber-500/30',
            className
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{label || 'Skipped'}</span>
        </span>
      );
    case 'blocked':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-950/60 text-orange-400 border border-orange-500/30',
            className
          )}
        >
          <StopCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span>{label || 'Blocked'}</span>
        </span>
      );
    case 'ai_suggested':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-950/60 text-purple-300 border border-purple-500/40 border-dashed',
            className
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>{label || 'AI Suggested'}</span>
        </span>
      );
    case 'verified':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-400/60 shadow-glow-success',
            className
          )}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{label || 'Verified'}</span>
        </span>
      );
    default:
      return null;
  }
}
