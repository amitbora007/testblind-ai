import React, { useState } from 'react';
import { cn } from '@/utils/cn';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  Calendar,
  Layers,
  User,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface HeaderProps {
  currentRouteTitle: string;
  onMobileMenuToggle: () => void;
  selectedDateRange: string;
  onDateRangeChange: (range: string) => void;
  onSearchOpen?: () => void;
  notificationCount?: number;
}

export function Header({
  currentRouteTitle,
  onMobileMenuToggle,
  selectedDateRange,
  onDateRangeChange,
  onSearchOpen,
  notificationCount = 3,
}: HeaderProps) {
  const [isEnvMenuOpen, setIsEnvMenuOpen] = useState(false);
  const [currentEnv, setCurrentEnv] = useState('Production Cluster');

  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const dateRanges = ['Last 24 Hours', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days'];

  return (
    <header className="h-16 shrink-0 bg-canvas-base/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Mobile hamburger & Page Title / Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block text-xs font-medium text-slate-500">
            TestBlind AI
          </span>
          <span className="hidden sm:inline-block text-xs text-slate-600">/</span>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
            {currentRouteTitle}
          </h1>
        </div>

        {/* Environment / Project Pill */}
        <div className="relative hidden md:block ml-2">
          <button
            onClick={() => setIsEnvMenuOpen(!isEnvMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentEnv}</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {isEnvMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-48 rounded-lg bg-card border border-slate-700/80 shadow-xl py-1 z-30 animate-in fade-in-50 duration-100">
              {['Production Cluster', 'Staging Runner Pool', 'Preview Sandboxes'].map(
                (env) => (
                  <button
                    key={env}
                    onClick={() => {
                      setCurrentEnv(env);
                      setIsEnvMenuOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-between',
                      currentEnv === env && 'text-blue-400 font-semibold'
                    )}
                  >
                    <span>{env}</span>
                    {currentEnv === env && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions, Search, Date Range Filter & User Profile */}
      <div className="flex items-center gap-2.5">
        {/* Search trigger button */}
        <button
          onClick={onSearchOpen}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 text-xs transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Quick search...</span>
          <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded border border-slate-700">
            ⌘K
          </kbd>
        </button>

        {/* Date Range Selector (TraceAI Studio benchmark feature) */}
        <div className="relative">
          <button
            onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 text-xs font-medium transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span className="whitespace-nowrap">{selectedDateRange}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isDateMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-40 rounded-lg bg-card border border-slate-700/80 shadow-xl py-1 z-30 animate-in fade-in-50 duration-100">
              {dateRanges.map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    onDateRangeChange(range);
                    setIsDateMenuOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-between',
                    selectedDateRange === range && 'text-blue-400 font-semibold bg-slate-800/40'
                  )}
                >
                  <span>{range}</span>
                  {selectedDateRange === range && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <button
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="View notifications"
        >
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 shadow-glow-primary" />
          )}
        </button>

        {/* User Profile Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-semibold text-xs border border-blue-400/30">
            QA
          </div>
        </div>
      </div>
    </header>
  );
}
