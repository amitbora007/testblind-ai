import React, { createContext, useContext, useState } from 'react';
import { cn } from '@/utils/cn';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (val: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

export interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (val: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({ defaultValue, value, onValueChange, className, children }: TabsProps) {
  const [currentTab, setCurrentTab] = useState(defaultValue);
  const activeTab = value !== undefined ? value : currentTab;

  const handleTabChange = (val: string) => {
    if (value === undefined) {
      setCurrentTab(val);
    }
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={cn('w-full space-y-4', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 p-1 bg-slate-900/80 rounded-lg border border-slate-800 text-slate-400',
        className
      )}
      {...props}
    />
  );
}

export interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabTrigger({ value, className, children, ...props }: TabTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabTrigger must be used inside Tabs');

  const isActive = context.activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      className={cn(
        'px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-150',
        isActive
          ? 'bg-card text-white shadow-sm border border-slate-700/80'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
        className
      )}
      onClick={() => context.setActiveTab(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabContent({ value, className, children, ...props }: TabContentProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabContent must be used inside Tabs');

  if (context.activeTab !== value) return null;

  return (
    <div role="tabpanel" className={cn('animate-in fade-in-50 duration-200', className)} {...props}>
      {children}
    </div>
  );
}
