import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusPill, TestStatus } from '@/components/ui/StatusPill';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Dialog } from '@/components/ui/Dialog';
import { DemoModeBanner } from '@/components/common/DemoModeBanner';
import {
  PlayCircle,
  Terminal,
  Clock,
  GitBranch,
  Webhook,
  Calendar,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export interface ExecutionRunRecord {
  id: string;
  project: string;
  branch: string;
  trigger: 'ci_webhook' | 'manual' | 'scheduled' | 'playground';
  triggerLabel: string;
  testsPassed: number;
  totalTests: number;
  duration: string;
  status: TestStatus;
  statusLabel: string;
  timestamp: string;
  logs: string[];
}

const MOCK_RUNS: ExecutionRunRecord[] = [
  {
    id: 'RUN-892',
    project: 'core-auth-service',
    branch: 'main',
    trigger: 'ci_webhook',
    triggerLabel: 'GitHub Actions PR #142',
    testsPassed: 42,
    totalTests: 42,
    duration: '1m 20s',
    status: 'passed',
    statusLabel: 'Passed (Green Check)',
    timestamp: '15 mins ago',
    logs: [
      '[00:00.01] Webhook received from GitHub: push to branch main (commit 8f1b4a)',
      '[00:00.12] Provisioning isolated container: testblind-runner-python:3.12',
      '[00:00.45] Security checks: Read-only rootfs OK, dropped capabilities OK',
      '[00:00.89] Running: pytest tests/auth/ tests/session/ --tb=short',
      '[00:01.15] ============================= 42 passed in 1.15s =============================',
      '[00:01.20] Container destroyed cleanly. Exit code: 0.',
    ],
  },
  {
    id: 'RUN-891',
    project: 'payment-ledger-engine',
    branch: 'release/v2.1',
    trigger: 'manual',
    triggerLabel: 'Manual Dashboard Trigger',
    testsPassed: 28,
    totalTests: 28,
    duration: '45s',
    status: 'verified',
    statusLabel: 'Verified Execution',
    timestamp: '1 hour ago',
    logs: [
      '[00:00.01] User initiated regression check: SC-1022 (Checkout Barrier)',
      '[00:00.10] Ephemeral runner spawned in gVisor runsc sandbox',
      '[00:00.41] Verified 28 boundary invariant assertions',
      '[00:00.45] Cryptographic execution proof hash: sha256:7f9a2b8e41',
    ],
  },
  {
    id: 'RUN-890',
    project: 'billing-dashboard',
    branch: 'feat/invoices-v2',
    trigger: 'ci_webhook',
    triggerLabel: 'GitHub Actions PR #89',
    testsPassed: 18,
    totalTests: 20,
    duration: '2m 10s',
    status: 'failed',
    statusLabel: 'Failed on Baseline',
    timestamp: '3 hours ago',
    logs: [
      '[00:00.01] Running vitest tests/invoices/test_prorate.ts',
      '[00:01.45] FAIL tests/invoices/test_prorate.ts > calculateProrateOnBoundary',
      '[00:01.48] AssertionError: expected NaN to be 0.00',
      '[00:02.10] Container exited with non-zero code 1.',
    ],
  },
  {
    id: 'RUN-889',
    project: 'stream-ingest-worker',
    branch: 'develop',
    trigger: 'scheduled',
    triggerLabel: 'Scheduled Nightly Suite',
    testsPassed: 80,
    totalTests: 80,
    duration: '3m 15s',
    status: 'passed',
    statusLabel: 'Passed (Green Check)',
    timestamp: 'Yesterday',
    logs: [
      '[00:00.01] Triggering scheduled nightly full AST mutation suite',
      '[00:02.10] Go test runner executed 80 packages with -race detector enabled',
      '[00:03.15] All mutations killed or triaged cleanly. Exit code 0.',
    ],
  },
];

export function ExecutionRunsPage() {
  const [runs] = useState<ExecutionRunRecord[]>(MOCK_RUNS);
  const [statusFilter, setStatusFilter] = useState('all');
  const [triggerFilter, setTriggerFilter] = useState('all');
  const [selectedRun, setSelectedRun] = useState<ExecutionRunRecord | null>(null);

  const filteredRuns = runs.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesTrigger = triggerFilter === 'all' || r.trigger === triggerFilter;
    return matchesStatus && matchesTrigger;
  });

  return (
    <div className="space-y-6">
      <DemoModeBanner message="DEMO MODE — Historical execution logs and container runner terminal playback with exit code verification." />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Execution Runs & Audit Trail</h2>
          <p className="text-xs text-slate-400">
            Audit logs for all container sandbox executions triggered via webhooks, cron, or manual dispatches.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<RefreshCw className="w-4 h-4" />}
          onClick={() => {}}
        >
          Refresh Feed
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Total Execution Runs</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">450</span>
          <span className="text-[11px] text-slate-400">Past 30 days</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Passed & Verified</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">380</span>
          <span className="text-[11px] text-emerald-500 font-medium">84.4% Pass rate</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Failed on Invariant</span>
          <span className="text-2xl font-bold text-red-400 font-mono mt-1 block">70</span>
          <span className="text-[11px] text-red-400 font-medium">Defects caught</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Active Runner Fleet</span>
          <span className="text-2xl font-bold text-blue-400 font-mono mt-1 block">4 Idle</span>
          <span className="text-[11px] text-slate-400 font-medium">Sub-second warm start</span>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="passed">Passed Runs</option>
            <option value="verified">Verified Execution</option>
            <option value="failed">Failed Runs</option>
          </Select>

          <Select
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            className="w-40 text-xs"
          >
            <option value="all">All Triggers</option>
            <option value="ci_webhook">CI Webhooks</option>
            <option value="manual">Manual</option>
            <option value="scheduled">Scheduled</option>
          </Select>
        </div>

        <span className="text-xs text-slate-400">
          Showing {filteredRuns.length} of {runs.length} runs
        </span>
      </div>

      {/* Runs Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent cursor-default">
                <TableHead>Run ID</TableHead>
                <TableHead>Target Repository & Branch</TableHead>
                <TableHead>Trigger Source</TableHead>
                <TableHead>Assertions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredRuns.map((run) => (
                <TableRow
                  key={run.id}
                  onClick={() => setSelectedRun(run)}
                  className="hover:bg-slate-800/60"
                >
                  <TableCell className="font-mono text-xs font-semibold text-blue-400">
                    {run.id}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-white text-xs">{run.project}</div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 mt-0.5">
                      <GitBranch className="w-3 h-3" />
                      <span>{run.branch}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      {run.trigger === 'ci_webhook' ? (
                        <Webhook className="w-3.5 h-3.5 text-blue-400" />
                      ) : run.trigger === 'scheduled' ? (
                        <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{run.triggerLabel}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-200">
                    {run.testsPassed} / {run.totalTests}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={run.status} label={run.statusLabel} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {run.duration}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-white">
                      Live Logs <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Live Terminal Log Modal */}
      <Dialog
        isOpen={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        title={selectedRun ? `Runner Terminal: ${selectedRun.id} (${selectedRun.project})` : ''}
        description={selectedRun ? `Trigger: ${selectedRun.triggerLabel} • Duration: ${selectedRun.duration}` : ''}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-400 font-mono">
              Exit Code: <strong className="text-white">{selectedRun?.status === 'failed' ? 1 : 0}</strong>
            </span>
            <Button variant="secondary" size="sm" onClick={() => setSelectedRun(null)}>
              Close Terminal
            </Button>
          </div>
        }
      >
        {selectedRun && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1.5 font-mono text-blue-400">
                <Terminal className="w-3.5 h-3.5" />
                <span>Docker Sandbox Stdout Stream</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500">sha256:9f8e4a10</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-1 max-h-56 overflow-y-auto leading-relaxed">
              {selectedRun.logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
