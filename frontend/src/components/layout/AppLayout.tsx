import React, { useState } from 'react';
import { Sidebar, NAV_ITEMS } from './Sidebar';
import { Header } from './Header';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Search } from 'lucide-react';
import { CurrentUserProfile } from '@/services/api';
import {
  LayoutDashboard,
  FolderGit2,
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
} from 'lucide-react';

interface SearchCatalogItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
  keywords: string[];
}

const SEARCH_CATALOG: SearchCatalogItem[] = [
  { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard, description: 'Live KPI metrics, execution trends, and recent scenarios', keywords: ['kpi', 'metrics', 'trends', 'overview', 'home'] },
  { id: 'projects', label: 'Projects & Repositories', icon: FolderGit2, badge: 'Active', description: 'Manage linked GitHub repos and shallow clone workspaces', keywords: ['locker', 'repo', 'github', 'branch', 'workspace'] },
  { id: 'gap-discovery', label: 'Test Gap Discovery (AST Mutations)', icon: ScanSearch, badge: 'AI', description: 'Run mutation scans and detect unexercised AST blindspots', keywords: ['mutation', 'ror', 'aor', 'mutants', 'scan', 'ast'] },
  { id: 'test-scenarios', label: 'Test Scenarios & Workflows', icon: GitFork, badge: 'Auto', description: 'REQ-AUTO-01 multi-step regression scenarios and assertions', keywords: ['scenario', 'req', 'req-auto', 'steps', 'workflow', 'auto-generate'] },
  { id: 'test-cases', label: 'Cataloged Test Cases', icon: CheckSquare, description: 'Unified library of mutation-killing tests and assertions', keywords: ['test_auto_generated', 'assertions', 'unit', 'cases', 'code'] },
  { id: 'code-lab', label: 'Code Lab Sandbox', icon: Code2, badge: 'Live', description: 'Live AST node parser, mutation preview, and dual-state runner', keywords: ['sandbox', 'syntax', 'python', 'analyze', 'preview'] },
  { id: 'incidents', label: 'Incident-to-Regression', icon: Flame, badge: 'New', description: 'Traceback reproduction and automated incident tests', keywords: ['incident', 'traceback', 'repro', 'bug', 'patch'] },
  { id: 'execution-runs', label: 'Execution Runs & Logs', icon: PlayCircle, description: 'Detailed runner logs, stdout/stderr, and exit codes', keywords: ['logs', 'runs', 'pytest', 'isolated', 'runner'] },
  { id: 'reports', label: 'Test Suite Audit Reports', icon: BarChart3, description: 'Mutation score breakdown, flakiness index, and MTTK', keywords: ['coverage', 'audit', 'export', 'pdf', 'csv', 'json'] },
  { id: 'ai-insights', label: 'AI Insights & Flakiness Engine', icon: Sparkles, badge: 'Pro', description: 'Flakiness detection, test smells, and boundary suggestions', keywords: ['flaky', 'smells', 'ai', 'suggestions'] },
  { id: 'integrations', label: 'CI/CD & Integrations', icon: PlugZap, description: 'GitHub App, Slack alerts, and webhook pipelines', keywords: ['github', 'slack', 'webhook', 'ci', 'cd'] },
  { id: 'team-settings', label: 'Team & Organization Settings', icon: Users, description: 'Members, RBAC roles, retention policies, and audit logs', keywords: ['team', 'members', 'roles', 'settings', 'organization'] },
];

export interface AppLayoutProps {
  currentRoute: string;
  onRouteChange: (routeId: string) => void;
  children: React.ReactNode;
  currentUser?: CurrentUserProfile | null;
  isDemoMode?: boolean;
  onLogout?: () => void;
}

export function AppLayout({
  currentRoute,
  onRouteChange,
  children,
  currentUser,
  isDemoMode = false,
  onLogout,
}: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState('Last 30 Days');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentItem = NAV_ITEMS.find((item) => item.id === currentRoute);
  const currentTitle = currentItem ? currentItem.label : 'Dashboard';

  const searchLower = searchQuery.toLowerCase().trim();
  const filteredNavItems = SEARCH_CATALOG.filter((item) => {
    if (!searchLower) return true;
    return (
      (item.label || '').toLowerCase().includes(searchLower) ||
      (item.description || '').toLowerCase().includes(searchLower) ||
      (item.keywords || []).some((kw) => kw.toLowerCase().includes(searchLower))
    );
  });

  // Global ⌘K / Ctrl+K shortcut listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-canvas-base text-slate-100 overflow-x-hidden w-full">
      {/* Sidebar Navigation */}
      <Sidebar
        currentRoute={currentRoute}
        onRouteChange={onRouteChange}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        <Header
          currentRouteTitle={currentTitle}
          onMobileMenuToggle={() => setIsMobileOpen(true)}
          selectedDateRange={selectedDateRange}
          onDateRangeChange={setSelectedDateRange}
          onSearchOpen={() => setIsSearchOpen(true)}
          currentUser={currentUser}
          isDemoMode={isDemoMode}
          onLogout={onLogout}
          onNavigate={onRouteChange}
        />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden min-w-0 w-full">
          <div className="max-w-7xl mx-auto space-y-6 min-w-0 w-full">{children}</div>
        </main>
      </div>

      {/* Command Palette / Search Dialog */}
      <Dialog
        isOpen={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false);
          setSearchQuery('');
        }}
        title="Quick Navigation & Global Search"
        description="Search pages, actions, and regression assets or press ⌘K anywhere."
        maxWidth="md"
      >
        <div className="space-y-4">
          <Input
            autoFocus
            placeholder="Search test cases, scenarios, actions (e.g. 'mutation', 'locker', 'REQ-AUTO')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
          <div className="max-h-80 overflow-y-auto space-y-1 divide-y divide-slate-800">
            {filteredNavItems.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No results found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`${item.id}-${item.label}`}
                    onClick={() => {
                      onRouteChange(item.id);
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-800 text-left text-xs transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-blue-400 group-hover:border-blue-500/40 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-slate-200 block truncate">{item.label}</span>
                        {item.description && (
                          <span className="text-[11px] text-slate-400 block truncate">{item.description}</span>
                        )}
                      </div>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0 ml-2">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
