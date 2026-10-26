import React, { useState } from 'react';
import { Sidebar, NAV_ITEMS } from './Sidebar';
import { Header } from './Header';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Search } from 'lucide-react';

export interface AppLayoutProps {
  currentRoute: string;
  onRouteChange: (routeId: string) => void;
  children: React.ReactNode;
}

export function AppLayout({ currentRoute, onRouteChange, children }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState('Last 30 Days');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentItem = NAV_ITEMS.find((item) => item.id === currentRoute);
  const currentTitle = currentItem ? currentItem.label : 'Dashboard';

  const filteredNavItems = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-canvas-base text-slate-100">
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
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentRouteTitle={currentTitle}
          onMobileMenuToggle={() => setIsMobileOpen(true)}
          selectedDateRange={selectedDateRange}
          onDateRangeChange={setSelectedDateRange}
          onSearchOpen={() => setIsSearchOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>

      {/* Command Palette / Search Dialog */}
      <Dialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        title="Quick Navigation & Search"
        description="Type to jump directly to any test module or analysis workflow."
        maxWidth="md"
      >
        <div className="space-y-4">
          <Input
            autoFocus
            placeholder="Search test cases, scenarios, incidents, or pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
          <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-800">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onRouteChange(item.id);
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-800 text-left text-xs transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-blue-400" />
                    <span className="font-medium text-slate-200">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
