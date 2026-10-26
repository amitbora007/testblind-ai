import { cn } from '@/utils/cn';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  id: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
  onDismiss: (id: string) => void;
}

export function NotificationToast({
  id,
  type = 'info',
  title,
  message,
  onDismiss,
}: ToastProps) {
  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
  };

  const borderMap = {
    success: 'border-emerald-500/40 bg-slate-900/95',
    warning: 'border-amber-500/40 bg-slate-900/95',
    error: 'border-red-500/40 bg-slate-900/95',
    info: 'border-blue-500/40 bg-slate-900/95',
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md max-w-sm w-full transition-all duration-200 animate-in slide-in-from-top-2',
        borderMap[type]
      )}
    >
      <div className="mt-0.5">{iconMap[type]}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-slate-100">{title}</h4>
        {message && <p className="text-xs text-slate-400 mt-0.5">{message}</p>}
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
