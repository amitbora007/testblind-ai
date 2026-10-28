import React, { useState, useEffect, useRef } from 'react';
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
  LogOut,
  CheckCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CurrentUserProfile } from '@/services/api';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'scan' | 'test' | 'security' | 'info';
  route?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'AST Mutation Scan Complete',
    description: 'Scan on locker finished with 78.4% mutation score. 6 mutants tested.',
    time: '12m ago',
    read: false,
    type: 'scan',
    route: 'gap-discovery',
  },
  {
    id: 'n-2',
    title: 'Auto-Generated Regression Suite',
    description: 'Synthesized 6 scenarios & unit test cases for locker.py.',
    time: '45m ago',
    read: false,
    type: 'test',
    route: 'test-scenarios',
  },
  {
    id: 'n-3',
    title: 'Boundary Invariance Verified',
    description: 'Zero unexercised boundary condition leaks detected in test suite.',
    time: '2h ago',
    read: false,
    type: 'security',
    route: 'reports',
  },
  {
    id: 'n-4',
    title: 'GitHub Repository Synced',
    description: 'amitbora007/locker workspace linked to tenant storage.',
    time: '5h ago',
    read: true,
    type: 'info',
    route: 'projects',
  },
];

export interface HeaderProps {
  currentRouteTitle: string;
  onMobileMenuToggle: () => void;
  selectedDateRange: string;
  onDateRangeChange: (range: string) => void;
  onSearchOpen?: () => void;
  notificationCount?: number;
  currentUser?: CurrentUserProfile | null;
  isDemoMode?: boolean;
  onLogout?: () => void;
  onNavigate?: (route: string) => void;
}

export function Header({
  currentRouteTitle,
  onMobileMenuToggle,
  selectedDateRange,
  onDateRangeChange,
  onSearchOpen,
  notificationCount: initialNotificationCount = 3,
  currentUser,
  isDemoMode = false,
  onLogout,
  onNavigate,
}: HeaderProps) {
  const [isEnvMenuOpen, setIsEnvMenuOpen] = useState(false);
  const [currentEnv, setCurrentEnv] = useState('Production Cluster');

  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const notificationRef = useRef<HTMLDivElement>(null);
  const dateRanges = ['Last 24 Hours', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days'];

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleNotificationClick = (item: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    setIsNotificationOpen(false);
    if (item.route && onNavigate) {
      onNavigate(item.route);
    }
  };

  const initials = currentUser?.full_name
    ? currentUser.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : isDemoMode
    ? 'DM'
    : 'QA';

  const userRole = currentUser?.memberships?.[0]?.role?.toUpperCase() || (isDemoMode ? 'DEMO' : 'OWNER');
  const orgName = currentUser?.memberships?.[0]?.organization_name || localStorage.getItem('tb_active_org_name') || (isDemoMode ? 'Demo Workspace' : 'Organization');

  return (
    <header className="h-16 shrink-0 bg-canvas-base/80 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 lg:px-6 flex items-center justify-between sticky top-0 z-20 w-full min-w-0">
      {/* Left: Mobile hamburger & Page Title / Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="hidden sm:inline-block text-xs font-medium text-slate-500 shrink-0">
            TestBlind AI
          </span>
          <span className="hidden sm:inline-block text-xs text-slate-600 shrink-0">/</span>
          <h1 className="text-sm sm:text-lg font-bold text-white tracking-tight truncate max-w-[120px] sm:max-w-none">
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
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
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
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 text-xs font-medium transition-colors"
            title={`Date range: ${selectedDateRange}`}
            aria-label="Filter date range"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">{selectedDateRange}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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

        {/* Notification Bell & Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => {
              setIsNotificationOpen(!isNotificationOpen);
              setIsDateMenuOpen(false);
              setIsUserMenuOpen(false);
            }}
            className="relative p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
            aria-label="View notifications"
            title="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500 shadow-glow-primary animate-pulse" />
            )}
          </button>

          {isNotificationOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-card border border-slate-700/80 shadow-2xl z-30 animate-in fade-in-50 duration-100 overflow-hidden">
              {/* Header */}
              <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">Notifications</span>
                  {unreadCount > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-semibold border border-blue-500/30">
                      {unreadCount} new
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono">All caught up</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearNotifications}
                      className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
                      title="Clear notifications"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Notification Items List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    <Bell className="w-6 h-6 mx-auto mb-2 text-slate-600 opacity-60" />
                    <p className="text-xs">No active notifications</p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={cn(
                        'p-3 hover:bg-slate-800/60 transition-colors cursor-pointer flex items-start gap-3',
                        !item.read ? 'bg-blue-950/20' : 'bg-transparent'
                      )}
                    >
                      <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                        {item.type === 'scan' && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                        {item.type === 'test' && <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />}
                        {item.type === 'security' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        {item.type === 'info' && <Layers className="w-3.5 h-3.5 text-purple-400" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn('text-xs truncate', !item.read ? 'text-white font-medium' : 'text-slate-300')}>
                            {item.title}
                          </p>
                          {!item.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                        <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
                          <span>{item.time}</span>
                          {item.route && (
                            <span className="text-blue-400 hover:underline flex items-center gap-0.5 font-medium">
                              View <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Badge & Dropdown */}
        <div className="relative pl-1.5 sm:pl-2 border-l border-slate-800">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-800/60 transition-colors focus:outline-none"
            aria-label="User profile menu"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-semibold text-xs border border-blue-400/30">
              {initials}
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-card border border-slate-700/80 shadow-2xl p-3 z-30 animate-in fade-in-50 duration-100 space-y-3">
              <div className="pb-3 border-b border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate max-w-[150px]">
                    {currentUser?.full_name || (isDemoMode ? 'Demo Explorer' : 'QA Engineer')}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                    {userRole}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {currentUser?.email || (isDemoMode ? 'demo@testblind.local' : 'qa-team@acme.corp')}
                </p>
                <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                  <Layers className="w-3 h-3 text-slate-400" />
                  <span>{orgName}</span>
                </p>
              </div>

              <div className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-mono text-slate-400 flex items-center justify-between rounded bg-slate-900/60 border border-slate-800">
                  <span>Session Mode:</span>
                  <span className={isDemoMode ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {isDemoMode ? 'Demo Tour' : 'Live Backend'}
                  </span>
                </div>
              </div>

              {onLogout && (
                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isDemoMode ? 'Exit Demo / Sign In' : 'Sign Out'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
