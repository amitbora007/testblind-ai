import React from 'react';
import { cn } from '@/utils/cn';
import { AlertCircle, RefreshCw, FolderSearch, Loader2 } from 'lucide-react';
import { Button } from './Button';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading execution metrics...', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center p-12 text-center space-y-4', className)}
    >
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
        <Loader2 className="w-5 h-5 text-blue-400 absolute animate-pulse" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-200">{message}</p>
        <p className="text-xs text-slate-500">Querying sandboxed runners & telemetry caches...</p>
      </div>
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-5 rounded-xl bg-card border border-slate-800 animate-pulse space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 bg-slate-800 rounded" />
        <div className="h-6 w-6 bg-slate-800 rounded-full" />
      </div>
      <div className="h-8 w-20 bg-slate-700/60 rounded" />
      <div className="h-3 w-36 bg-slate-800/80 rounded" />
    </div>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-10 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3',
        className
      )}
    >
      <div className="p-3 rounded-full bg-slate-800/70 text-slate-400 mb-1">
        {icon || <FolderSearch className="w-6 h-6" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Failed to load telemetry',
  message = 'An unexpected connection error occurred while querying the execution engine.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-10 text-center rounded-xl border border-red-900/40 bg-red-950/20 space-y-3',
        className
      )}
    >
      <div className="p-3 rounded-full bg-red-950/60 text-red-400 mb-1 border border-red-800/50">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-red-200">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm">{message}</p>
      {onRetry && (
        <div className="pt-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={onRetry}
          >
            Retry Connection
          </Button>
        </div>
      )}
    </div>
  );
}
