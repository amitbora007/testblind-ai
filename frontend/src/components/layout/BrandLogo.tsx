import React from 'react';
import { cn } from '@/utils/cn';

export interface BrandLogoProps {
  collapsed?: boolean;
  className?: string;
}

export function BrandLogo({ collapsed = false, className }: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-3 select-none', className)}>
      {/* TraceAI / TestBlind Gradient Symbol */}
      <div className="relative flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 shadow-glow-primary overflow-hidden">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
        >
          <defs>
            <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <path
            d="M8 24L16 8L24 24H19.5L16 17.5L12.5 24H8Z"
            fill="url(#brandGrad)"
          />
          <circle cx="16" cy="13.5" r="2" fill="#38BDF8" />
        </svg>
      </div>

      {!collapsed && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
              TraceAI
            </span>
            <span className="text-sm font-semibold tracking-tight text-blue-400 whitespace-nowrap">
              Studio
            </span>
          </div>
          <span className="text-[10px] font-medium tracking-wider uppercase text-slate-500 whitespace-nowrap">
            by TestBlind AI
          </span>
        </div>
      )}
    </div>
  );
}
