import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
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
import { api, isDemoActive, ExecutionRunResult, ProjectResult } from '@/services/api';
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
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  Filter,
} from 'lucide-react';

export function ExecutionRunsPage() {
  const [projects, setProjects] = useState<ProjectResult[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [runs, setRuns] = useState<ExecutionRunResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState('all');
  const [triggerFilter, setTriggerFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Detail Modal & Logs
  const [selectedRun, setSelectedRun] = useState<ExecutionRunResult | null>(null);
  const [liveLogs, setLiveLogs] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Initial load projects
  useEffect(() => {
    async function loadProjects() {
      try {
        const projs = await api.getProjects();
        if (projs && projs.length > 0) {
          setProjects(projs);
          setSelectedProjectId(projs[0].id);
        }
      } catch {
        // demo fallback
      }
    }
    loadProjects();
  }, []);

  // Fetch runs
  const fetchRuns = async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        page_size: 10,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (triggerFilter !== 'all') params.trigger = triggerFilter;

      const res = await api.getProjectExecutionRuns(selectedProjectId, params);
      if (res && res.items) {
        setRuns(res.items);
        setTotalPages(res.total_pages || 1);
        setTotalCount(res.total || 0);
        setIsLiveBackend(true);
      } else if (Array.isArray(res) && res.length > 0) {
        setRuns(res);
        setTotalPages(1);
        setTotalCount(res.length);
        setIsLiveBackend(true);
      } else {
        setRuns(isDemoActive() ? MOCK_INITIAL_RUNS : []);
        setTotalPages(1);
        setTotalCount(isDemoActive() ? MOCK_INITIAL_RUNS.length : 0);
        setIsLiveBackend(true);
      }
    } catch {
      setRuns(isDemoActive() ? MOCK_INITIAL_RUNS : []);
      setTotalPages(1);
      setTotalCount(isDemoActive() ? MOCK_INITIAL_RUNS.length : 0);
      setIsLiveBackend(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [selectedProjectId, statusFilter, triggerFilter, sortBy, sortOrder, page]);

  // Load detailed logs when run is selected
  const handleSelectRun = async (run: ExecutionRunResult) => {
    setSelectedRun(run);
    setIsLoadingLogs(true);
    try {
      const logRes = await api.getExecutionRunLogs(run.id);
      setLiveLogs(logRes.stdout_log || logRes.stderr_log || run.stdout_log || 'No terminal logs available.');
    } catch {
      setLiveLogs(run.stdout_log || 'No terminal logs available.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleTriggerRun = async () => {
    if (!selectedProjectId) return;
    setIsTriggering(true);
    try {
      await api.triggerExecutionRun(selectedProjectId, {
        trigger: 'manual',
        trigger_label: 'Manual Console Trigger',
        branch: 'main',
      });
      await fetchRuns();
    } catch (err) {
      console.error('Failed to trigger execution run:', err);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      {!isLiveBackend ? (
        <DemoModeBanner message="DEMO MODE — Ephemeral container execution logs, process group isolation, and cryptographic proofs." />
      ) : (
        <div className="px-4 py-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected to Live Runner Engine: <strong>{totalCount} total execution runs</strong> logged.</span>
          </div>
          <Badge variant="green">Isolated Subprocess & Docker Sandboxes</Badge>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-blue-400" />
            Execution Runs & Runner History
          </h2>
          <p className="text-xs text-slate-400">
            Real-time audit log of test executions, CI webhooks, trigger provenance, and sandbox evidence logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {projects.length > 0 && (
            <Select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setPage(1);
              }}
              className="w-48 text-xs bg-slate-900 border-slate-700"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}

          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={fetchRuns}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            isLoading={isTriggering}
            leftIcon={<PlayCircle className="w-3.5 h-3.5" />}
            onClick={handleTriggerRun}
            disabled={!selectedProjectId}
          >
            Trigger Run
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Total Runs Recorded</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">{totalCount || runs.length}</span>
          <span className="text-[11px] text-slate-400">Multi-tenant execution stream</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Passed & Verified</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">
            {runs.filter((r) => r.status === 'passed').length}
          </span>
          <span className="text-[11px] text-emerald-500 font-medium">Exit Code 0 Proof</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Failed on Invariant</span>
          <span className="text-2xl font-bold text-red-400 font-mono mt-1 block">
            {runs.filter((r) => r.status === 'failed').length}
          </span>
          <span className="text-[11px] text-red-400 font-medium">Defects caught</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Skipped / Blocked</span>
          <span className="text-2xl font-bold text-amber-300 font-mono mt-1 block">
            {runs.reduce((acc, r) => acc + (r.tests_skipped || 0) + (r.tests_blocked || 0), 0)}
          </span>
          <span className="text-[11px] text-amber-400 font-medium">Environment timeouts</span>
        </Card>
      </div>

      {/* Filter and Sorting Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-slate-900/70 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1 hidden sm:flex">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filters:</span>
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-36 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          <Select
            value={triggerFilter}
            onChange={(e) => {
              setTriggerFilter(e.target.value);
              setPage(1);
            }}
            className="w-36 text-xs"
          >
            <option value="all">All Triggers</option>
            <option value="ci">CI / Webhooks</option>
            <option value="manual">Manual Console</option>
            <option value="scheduled">Scheduled</option>
          </Select>

          <div className="h-4 w-px bg-slate-800 hidden sm:block mx-1" />

          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-36 text-xs"
          >
            <option value="created_at">Sort: Date</option>
            <option value="duration_ms">Sort: Duration</option>
            <option value="tests_passed">Sort: Passed</option>
          </Select>

          <Select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-28 text-xs"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>

          {(statusFilter !== 'all' || triggerFilter !== 'all' || sortBy !== 'created_at' || sortOrder !== 'desc') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setTriggerFilter('all');
                setSortBy('created_at');
                setSortOrder('desc');
                setPage(1);
              }}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 h-auto"
            >
              Reset
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto text-xs text-slate-400">
          <Badge variant="outline" size="sm" className="font-mono">
            {totalCount} total runs
          </Badge>
          <span>Page {page} of {totalPages || 1}</span>
        </div>
      </div>

      {/* Runs Table */}
      <Card>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <p className="text-sm font-semibold text-white">No Execution Runs Found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Trigger an execution from CI, Code Lab, or run test cases in the Sandbox to view telemetry.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
              <TableRow className="hover:bg-transparent cursor-default">
                <TableHead>Run ID</TableHead>
                <TableHead>Trigger & Provenance</TableHead>
                <TableHead>Branch & Commit</TableHead>
                <TableHead>Results (P / F / S / B)</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Logs</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {runs.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={() => handleSelectRun(r)}
                  className="hover:bg-slate-800/60 cursor-pointer"
                >
                  <TableCell className="font-mono text-xs font-semibold text-blue-400">
                    {r.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-semibold text-white">
                      {r.trigger_label || r.trigger}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {r.started_at ? new Date(r.started_at).toLocaleTimeString() : new Date(r.created_at).toLocaleTimeString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                      <span>{r.branch}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">
                      {r.commit_hash ? r.commit_hash.slice(0, 7) : 'head'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-emerald-400 font-bold">{r.tests_passed}P</span>
                      <span className="text-slate-600">/</span>
                      <span className={r.tests_failed > 0 ? 'text-red-400 font-bold' : 'text-slate-500'}>
                        {r.tests_failed}F
                      </span>
                      <span className="text-slate-600">/</span>
                      <span className="text-amber-400">{r.tests_skipped || 0}S</span>
                      <span className="text-slate-600">/</span>
                      <span className="text-orange-400">{r.tests_blocked || 0}B</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(2)}s` : '1.4s'}
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      status={r.status === 'passed' ? 'verified' : r.status === 'failed' ? 'failed' : 'ai_suggested'}
                      label={r.status.toUpperCase()}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-white">
                      Inspect Logs <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg border border-slate-800">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Previous
          </Button>
          <span className="text-xs text-slate-400 font-mono">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Next
          </Button>
        </div>
      )}

      {/* Log Output & Detail Modal */}
      <Dialog
        isOpen={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        title={selectedRun ? `Run Details: ${selectedRun.id}` : ''}
        description={selectedRun ? `Trigger: ${selectedRun.trigger_label || selectedRun.trigger} | Branch: ${selectedRun.branch}` : ''}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="font-mono text-xs text-slate-400">
              Completed at: {selectedRun?.completed_at || selectedRun?.created_at}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setSelectedRun(null)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedRun && (
          <div className="space-y-4">
            {/* Run Header Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusPill status={selectedRun.status === 'passed' ? 'verified' : 'failed'} />
              <Badge variant="outline">Trigger: {selectedRun.trigger}</Badge>
              <Badge variant="outline">Commit: {selectedRun.commit_hash || 'latest'}</Badge>
              <span className="text-slate-400 font-mono">Duration: {(selectedRun.duration_ms / 1000).toFixed(2)}s</span>
            </div>

            {/* Error Details if any */}
            {selectedRun.error_details && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-red-400">
                  <AlertCircle className="w-4 h-4" /> Error Details:
                </span>
                <p className="font-mono text-[11px]">{selectedRun.error_details}</p>
              </div>
            )}

            {/* Associated tests links */}
            {selectedRun.associated_test_ids && selectedRun.associated_test_ids.length > 0 && (
              <div className="text-xs text-slate-300">
                <span className="font-semibold block mb-1">Associated Tests:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRun.associated_test_ids.map((tid) => (
                    <span key={tid} className="font-mono text-[11px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-blue-400">
                      {tid}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Terminal Stdout/Stderr Stream */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Container Runner Terminal Output
                </span>
                <span className="text-slate-500 font-mono text-[11px]">POSIX setrlimit isolated</span>
              </div>
              <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto max-h-64 leading-relaxed">
                {isLoadingLogs ? 'Loading execution logs...' : liveLogs}
              </pre>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

const MOCK_INITIAL_RUNS: ExecutionRunResult[] = [
  {
    id: 'run-892-auth',
    project_id: 'proj-01',
    branch: 'main',
    commit_hash: '8f1b4a3c',
    trigger: 'ci',
    trigger_label: 'GitHub Actions PR #142',
    tests_passed: 42,
    tests_failed: 0,
    tests_skipped: 0,
    tests_blocked: 0,
    total_tests: 42,
    duration_ms: 1240,
    status: 'passed',
    stdout_log: '[00:00.01] GitHub Actions CI step started\n[00:00.12] Provisioning testblind-runner-python:3.12 (UID 10001)\n============================= 42 passed in 1.15s =============================\nContainer exited with code 0.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'run-891-billing',
    project_id: 'proj-01',
    branch: 'release/v2.1',
    commit_hash: '7f9a2b8e',
    trigger: 'manual',
    trigger_label: 'Manual Console Trigger',
    tests_passed: 28,
    tests_failed: 0,
    tests_skipped: 1,
    tests_blocked: 0,
    total_tests: 29,
    duration_ms: 850,
    status: 'passed',
    stdout_log: '[00:00.01] User initiated regression check\n[00:00.41] Verified 28 boundary invariant assertions\nExit code: 0.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'run-890-invoices',
    project_id: 'proj-01',
    branch: 'feat/invoices-v2',
    commit_hash: '9a3c2d1e',
    trigger: 'ci',
    trigger_label: 'GitHub Actions PR #89',
    tests_passed: 18,
    tests_failed: 2,
    tests_skipped: 0,
    tests_blocked: 0,
    total_tests: 20,
    duration_ms: 2100,
    status: 'failed',
    error_details: 'AssertionError: expected prorated days to be >= 1, got 0 in test_prorate.py:42',
    stdout_log: '[00:00.01] Running pytest tests/invoices/test_prorate.py\nFAIL tests/invoices/test_prorate.py::test_zero_days\nAssertionError: expected prorated days to be >= 1\nExit code 1.',
    created_at: new Date().toISOString(),
  },
];
