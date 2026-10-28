import React from 'react';
import { cn } from '@/utils/cn';
import { BrandLogo } from './BrandLogo';
import {
  LayoutDashboard,
  FolderGit2,
  GitBranch,
  Code2,
  ScanSearch,
  Flame,
  CheckSquare,
  GitFork,
  PlayCircle,
  BarChart3,
  Sparkles,
  PlugZap,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  category?: 'core' | 'qa' | 'system';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'core' },
  { id: 'projects', label: 'Projects', icon: FolderGit2, category: 'core' },
  { id: 'code-lab', label: 'Code Lab', icon: Code2, badge: 'Live', category: 'core' },
  { id: 'gap-discovery', label: 'Test Gap Discovery', icon: ScanSearch, badge: 'AI', category: 'core' },
  { id: 'incidents', label: 'Incident Analysis', icon: Flame, badge: 'New', category: 'core' },
  { id: 'test-cases', label: 'Test Cases', icon: CheckSquare, category: 'qa' },
  { id: 'test-scenarios', label: 'Test Scenarios', icon: GitFork, category: 'qa' },
  { id: 'execution-runs', label: 'Execution Runs', icon: PlayCircle, category: 'qa' },
  { id: 'reports', label: 'Reports', icon: BarChart3, category: 'qa' },
  { id: 'ai-insights', label: 'AI Insights', icon: Sparkles, badge: 'Pro', category: 'qa' },
  { id: 'integrations', label: 'Integrations', icon: PlugZap, category: 'system' },
  { id: 'team-settings', label: 'Team & Settings', icon: Users, category: 'system' },
];

export interface SidebarProps {
  currentRoute: string;
  onRouteChange: (routeId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  currentRoute,
  onRouteChange,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  const renderNavContent = () => (
    <div className="flex flex-col h-full bg-sidebar border-r border-slate-800/80">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
        <BrandLogo collapsed={isCollapsed} />
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
          aria-label="Close mobile navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                onRouteChange(item.id);
                onMobileClose();
              }}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 group relative',
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 hover:bg-slate-800/40 border border-transparent'
              )}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-500 rounded-r-full shadow-glow-primary" />
              )}

              <Icon
                className={cn(
                  'w-4 h-4 shrink-0 transition-colors',
                  isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                )}
              />

              {!isCollapsed && (
                <span className="flex-1 text-left truncate">{item.label}</span>
              )}

              {!isCollapsed && item.badge && (
                <span
                  className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.2 rounded-full uppercase tracking-wider',
                    item.badge === 'AI' || item.badge === 'Pro'
                      ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
                      : 'bg-blue-950/80 text-blue-300 border border-blue-500/40'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer & Collapse Toggle (Desktop only) */}
      <div className="p-3 border-t border-slate-800/80 hidden lg:flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Runner Engine Live</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors',
            isCollapsed && 'w-full flex justify-center'
          )}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:block shrink-0 transition-all duration-300 ease-in-out h-screen sticky top-0 z-30',
          isCollapsed ? 'w-[68px]' : 'w-[240px]'
        )}
      >
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <div className="relative w-[280px] max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {renderNavContent()}
          </div>
        </div>
      )}
    </>
  );
}
