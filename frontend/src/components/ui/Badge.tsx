import React from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'purple'
    | 'outline'
    | 'cyan'
    | 'blue'
    | 'green'
    | 'rose'
    | 'amber'
    | 'gray';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    primary: 'bg-blue-950/60 text-blue-300 border-blue-600/40',
    success: 'bg-emerald-950/60 text-emerald-300 border-emerald-600/40',
    danger: 'bg-red-950/60 text-red-300 border-red-600/40',
    warning: 'bg-amber-950/60 text-amber-300 border-amber-600/40',
    purple: 'bg-purple-950/60 text-purple-300 border-purple-600/40',
    outline: 'bg-transparent text-slate-300 border-slate-700',
    cyan: 'bg-cyan-950/60 text-cyan-300 border-cyan-600/40',
    blue: 'bg-blue-950/60 text-blue-300 border-blue-600/40',
    green: 'bg-emerald-950/60 text-emerald-300 border-emerald-600/40',
    rose: 'bg-rose-950/60 text-rose-300 border-rose-600/40',
    amber: 'bg-amber-950/60 text-amber-300 border-amber-600/40',
    gray: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-0.5 font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border tracking-wide uppercase',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export default Badge;
