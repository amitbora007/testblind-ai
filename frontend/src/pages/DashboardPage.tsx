import React, { useState } from 'react';
import { TopMetricCards } from '@/components/dashboard/TopMetricCards';
import { ExecutionStatusBarChart } from '@/components/dashboard/ExecutionStatusBarChart';
import { RequirementCoverageDonut } from '@/components/dashboard/RequirementCoverageDonut';
import { RecentTestScenariosTable } from '@/components/dashboard/RecentTestScenariosTable';
import {
  ComponentStateTester,
  DashboardViewState,
} from '@/components/dashboard/ComponentStateTester';
import {
  LoadingState,
  SkeletonCard,
  EmptyState,
  ErrorState,
} from '@/components/ui/States';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { NotificationToast, ToastProps } from '@/components/ui/NotificationToast';
import { PlusCircle, PlayCircle, ShieldCheck } from 'lucide-react';

export function DashboardPage() {
  const [viewState, setViewState] = useState<DashboardViewState>('normal');
  const [isSampleDialogOpen, setIsSampleDialogOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const handleTriggerToast = () => {
    const id = Date.now().toString();
    const newToast: ToastProps = {
      id,
      type: 'success',
      title: 'Regression Suite Verified',
      message: 'All 14 assertions in SC-1023 passed in isolated container sandbox.',
      onDismiss: (dismissId) => {
        setToasts((prev) => prev.filter((t) => t.id !== dismissId));
      },
    };
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return (
    <div className="space-y-6">
      {/* Interactive Component State Harness */}
      <ComponentStateTester
        viewState={viewState}
        onViewStateChange={setViewState}
        onOpenSampleDialog={() => setIsSampleDialogOpen(true)}
        onTriggerToast={handleTriggerToast}
      />

      {/* Floating Toast Notification Container */}
      {toasts.length > 0 && (
        <div className="fixed top-20 right-6 z-50 space-y-2 pointer-events-auto">
          {toasts.map((toast) => (
            <NotificationToast key={toast.id} {...toast} />
          ))}
        </div>
      )}

      {/* CONDITIONAL RENDERING BASED ON TEST STATE */}

      {viewState === 'loading' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="p-8 rounded-xl bg-card border border-slate-800">
            <LoadingState message="Executing parallel AST mutation batch against runner pool..." />
          </div>
        </div>
      )}

      {viewState === 'empty' && (
        <EmptyState
          title="No Execution Runs Found"
          description="Connect your GitHub repository or upload a local project ZIP archive to trigger autonomous mutation testing and regression analysis."
          actionLabel="Run First Gap Analysis"
          onAction={() => setViewState('normal')}
        />
      )}

      {viewState === 'error' && (
        <ErrorState
          title="Telemetry Connection Disrupted"
          message="Could not reach the Redis log broker at redis://localhost:6379. Runner heartbeats are queued."
          onRetry={() => setViewState('normal')}
        />
      )}

      {viewState === 'normal' && (
        <>
          {/* 1. Top 4 KPI Metric Cards (TraceAI Studio benchmark) */}
          <TopMetricCards />

          {/* 2. Middle Visualizations Grid (Stacked Bar & Donut) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left 7 Columns: Weekly Execution Status Stacked Bar Chart */}
            <div className="lg:col-span-7">
              <ExecutionStatusBarChart />
            </div>

            {/* Right 5 Columns: Requirement Coverage Analysis Donut Chart */}
            <div className="lg:col-span-5">
              <RequirementCoverageDonut />
            </div>
          </div>

          {/* 3. Bottom Data Table: Recent Test Scenarios */}
          <RecentTestScenariosTable />
        </>
      )}

      {/* Interactive Sample Dialog */}
      <Dialog
        isOpen={isSampleDialogOpen}
        onClose={() => setIsSampleDialogOpen(false)}
        title="Configure New Test Scenario"
        description="Define mutation matrix parameters and isolated runner timeouts."
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSampleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<PlayCircle className="w-4 h-4" />}
              onClick={() => {
                setIsSampleDialogOpen(false);
                handleTriggerToast();
              }}
            >
              Dispatch to Sandbox
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Scenario Name"
            defaultValue="Auth Session Invariant Test"
            placeholder="e.g. User Checkout Idempotency"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Target Language" defaultValue="python">
              <option value="python">Python (pytest 8.2)</option>
              <option value="node">TypeScript / Node (jest)</option>
              <option value="go">Go (testing)</option>
            </Select>

            <Select label="Runner Sandbox Mode" defaultValue="isolated">
              <option value="isolated">Ephemeral gVisor Container</option>
              <option value="strict">Read-Only Tmpfs Strict</option>
            </Select>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero Host Execution Guarantee</span>
            </div>
            <p className="text-slate-400">
              Untrusted code runs strictly under non-root UID 10001 with --network=none and 60s hard timeout.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
