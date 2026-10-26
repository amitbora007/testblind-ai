import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NAV_ITEMS } from '@/components/layout/Sidebar';
import { Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';

export interface PlaceholderPageProps {
  routeId: string;
  onNavigateHome: () => void;
}

export function PlaceholderPage({ routeId, onNavigateHome }: PlaceholderPageProps) {
  const currentNav = NAV_ITEMS.find((item) => item.id === routeId);
  const title = currentNav ? currentNav.label : 'Module';
  const Icon = currentNav ? currentNav.icon : Sparkles;

  return (
    <div className="space-y-6">
      <Card className="p-8 text-center flex flex-col items-center justify-center max-w-2xl mx-auto space-y-4">
        <div className="p-3 rounded-full bg-blue-950/60 border border-blue-500/40 text-blue-400">
          <Icon className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-sm text-slate-400 max-w-md">
            This module is scheduled for backend wiring in Phase 3–5. The BlindShield design system, responsive layout tokens, and navigation shell are established.
          </p>
        </div>

        <div className="flex items-center gap-2 p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-300">
          <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Spec: Defined in docs/product-spec.md & docs/architecture.md</span>
        </div>

        <div className="pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onNavigateHome}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Return to TraceAI Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
