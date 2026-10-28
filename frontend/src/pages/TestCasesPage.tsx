import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
import { api, isDemoActive, TestCaseResult, ProjectResult } from '@/services/api';
import {
  CheckSquare,
  Search,
  PlusCircle,
  Download,
  Filter,
  ShieldCheck,
  ChevronRight,
  Code2,
  Terminal,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FolderGit2,
  History,
  FileCheck2,
  Sparkles,
} from 'lucide-react';

export function TestCasesPage() {
  const [projects, setProjects] = useState<ProjectResult[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [testCases, setTestCases] = useState<TestCaseResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveBackend, setIsLiveBackend] = useState(false);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [testTypeFilter, setTestTypeFilter] = useState('all');
  const [groupBy, setGroupBy] = useState('none');

  // Inspection & Run State
  const [selectedTestCase, setSelectedTestCase] = useState<TestCaseResult | null>(null);
  const [isRunningSandbox, setIsRunningSandbox] = useState(false);
  const [sandboxOutput, setSandboxOutput] = useState<{ stdout: string; stderr: string; exit_code: number; evidence_hash: string } | null>(null);

  // New Test Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFile, setNewFile] = useState('tests/test_custom.py');
  const [newFunc, setNewFunc] = useState('test_new_assertion');
  const [newType, setNewType] = useState('mutation_killer');
  const [newCode, setNewCode] = useState('def test_new_case():\n    assert 1 + 1 == 2');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoGenSuccess, setAutoGenSuccess] = useState<string | null>(null);

  const handleAutoGenerateTests = async () => {
    if (!selectedProjectId) return;
    setIsAutoGenerating(true);
    setAutoGenSuccess(null);
    try {
      if (!isDemoActive()) {
        const res = await api.autoGenerateProjectTests(selectedProjectId);
        setAutoGenSuccess(`Generated ${res.test_cases_created} test case(s) and ${res.scenarios_created} scenario(s)!`);
        const data = await api.getProjectTestCases(selectedProjectId);
        setTestCases(data);
      } else {
        setTestCases(MOCK_INITIAL_CASES);
        setAutoGenSuccess("Generated 3 demo test cases and scenarios!");
      }
      setTimeout(() => setAutoGenSuccess(null), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to auto-generate tests");
    } finally {
      setIsAutoGenerating(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    async function loadInitial() {
      try {
        const projs = await api.getProjects();
        if (projs && projs.length > 0) {
          setProjects(projs);
          setSelectedProjectId(projs[0].id);
        }
      } catch {
        // Fallback demo mode
      }
    }
    loadInitial();
  }, []);

  // Fetch test cases for project
  useEffect(() => {
    async function fetchCases() {
      if (!selectedProjectId) return;
      setIsLoading(true);
      try {
        const params: Record<string, any> = {};
        if (statusFilter !== 'all') params.status = statusFilter;
        if (reviewFilter !== 'all') params.review_status = reviewFilter;
        if (testTypeFilter !== 'all') params.test_type = testTypeFilter;

        const data = await api.getProjectTestCases(selectedProjectId, params);
        if (data && data.length > 0) {
          setTestCases(data);
          setIsLiveBackend(true);
        } else {
          setTestCases(isDemoActive() ? MOCK_INITIAL_CASES : []);
          setIsLiveBackend(true);
        }
      } catch {
        setTestCases(isDemoActive() ? MOCK_INITIAL_CASES : []);
        setIsLiveBackend(false);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCases();
  }, [selectedProjectId, statusFilter, reviewFilter, testTypeFilter]);

  // Duplicate detection debounced check
  const handleCheckDuplicate = async (code: string) => {
    if (!selectedProjectId || !code.trim()) return;
    setIsCheckingDuplicate(true);
    try {
      const res = await api.checkDuplicateTestCase(selectedProjectId, code);
      if (res && res.is_duplicate) {
        setDuplicateWarning(res.message);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      setDuplicateWarning(null);
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleCreateTestCase = async () => {
    if (!newName.trim() || !selectedProjectId) return;

    try {
      const created = await api.createTestCase(selectedProjectId, {
        name: newName.trim(),
        file_path: newFile.trim(),
        function_name: newFunc.trim(),
        framework: 'pytest',
        code: newCode,
        test_type: newType,
        review_status: 'approved',
      });
      setTestCases([created, ...testCases]);
      setIsNewModalOpen(false);
      setNewName('');
      setDuplicateWarning(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save test case');
    }
  };

  const handleReviewAction = async (tc: TestCaseResult, newReviewStatus: string) => {
    try {
      const updated = await api.reviewTestCase(tc.id, newReviewStatus);
      setTestCases(testCases.map((t) => (t.id === tc.id ? updated : t)));
      if (selectedTestCase?.id === tc.id) {
        setSelectedTestCase(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update review status');
    }
  };

  const handleRunInSandbox = async (tc: TestCaseResult) => {
    setIsRunningSandbox(true);
    setSandboxOutput(null);
    try {
      const res = await api.runTestCase(tc.id);
      setSandboxOutput(res);
      // Refresh current test case state
      const refreshed = await api.getTestCase(tc.id);
      setSelectedTestCase(refreshed);
      setTestCases(testCases.map((t) => (t.id === tc.id ? refreshed : t)));
    } catch (err: any) {
      alert(err.message || 'Execution failed');
    } finally {
      setIsRunningSandbox(false);
    }
  };

  const handleExportTest = async (tc: TestCaseResult) => {
    try {
      const content = await api.exportTestCase(tc.id);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tc.name}.py`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      const blob = new Blob([tc.code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tc.name}.py`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportAllJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(testCases, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'testblind-unified-test-cases.json';
    a.click();
  };

  // Filter & Grouping logic
  const filtered = testCases.filter((tc) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      tc.name.toLowerCase().includes(q) ||
      tc.file_path.toLowerCase().includes(q) ||
      tc.id.toLowerCase().includes(q) ||
      tc.code.toLowerCase().includes(q);
    return matchesSearch;
  });

  const groups: Record<string, TestCaseResult[]> = {};
  if (groupBy !== 'none') {
    filtered.forEach((tc) => {
      let key = 'Default';
      if (groupBy === 'repository') key = tc.repository_name || 'Standard Repo';
      else if (groupBy === 'branch') key = tc.branch || 'main';
      else if (groupBy === 'commit') key = tc.commit_sha ? tc.commit_sha.slice(0, 8) : 'unspecified';
      else if (groupBy === 'incident') key = tc.source_incident_id ? `Incident ${tc.source_incident_id.slice(0, 8)}` : 'Standalone';
      else if (groupBy === 'test_type') key = tc.test_type ? tc.test_type.replace('_', ' ').toUpperCase() : 'STANDARD';

      if (!groups[key]) groups[key] = [];
      groups[key].push(tc);
    });
  }

  return (
    <div className="space-y-6">
      {!isLiveBackend ? (
        <DemoModeBanner message="DEMO MODE — Connect a project with verified tests to view live multi-tenant regression library telemetry." />
      ) : (
        <div className="px-4 py-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected to Live Control Plane: <strong>{testCases.length} cataloged tests</strong> across active project.</span>
          </div>
          <Badge variant="green">Live Sandbox Provenance</Badge>
        </div>
      )}

      {autoGenSuccess && (
        <div className="px-4 py-2.5 bg-blue-950/60 border border-blue-500/40 rounded-lg flex items-center justify-between text-xs text-blue-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>{autoGenSuccess}</span>
          </div>
          <Badge variant="blue">Synthesized</Badge>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-400" />
            Unified Regression Test Library
          </h2>
          <p className="text-xs text-slate-400">
            Searchable test cases uniting AST Mutation Killers and Incident Post-Mortem Regression Tests with SHA-256 evidence.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {projects.length > 0 && (
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
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
            leftIcon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportAllJSON}
          >
            Export JSON
          </Button>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
            onClick={() => setIsNewModalOpen(true)}
          >
            New Test Case
          </Button>
        </div>
      </div>

      {/* Metric Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Total Catalog Tests</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">{testCases.length}</span>
          <span className="text-[11px] text-slate-400">Grounded regression invariants</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Verified Executed</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">
            {testCases.filter((t) => t.status === 'verified').length}
          </span>
          <span className="text-[11px] text-emerald-500 font-medium">Exit Code 0 Sandbox Proof</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Approved by Review</span>
          <span className="text-2xl font-bold text-blue-400 font-mono mt-1 block">
            {testCases.filter((t) => t.review_status === 'approved').length}
          </span>
          <span className="text-[11px] text-blue-400 font-medium">Ready for CI gate</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Resolved Gaps</span>
          <span className="text-2xl font-bold text-purple-300 font-mono mt-1 block">
            {testCases.filter((t) => t.gap_resolved).length}
          </span>
          <span className="text-[11px] text-purple-400 font-medium">Mutant & Incident Defenses</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
        <div className="w-full lg:w-72">
          <Input
            placeholder="Search by name, file, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36 text-xs"
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="ai_suggested">AI Draft</option>
            <option value="failed">Failed</option>
          </Select>

          <Select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value)}
            className="w-36 text-xs"
          >
            <option value="all">All Review States</option>
            <option value="approved">Approved</option>
            <option value="pending_review">Pending Review</option>
            <option value="rejected">Rejected</option>
          </Select>

          <Select
            value={testTypeFilter}
            onChange={(e) => setTestTypeFilter(e.target.value)}
            className="w-36 text-xs"
          >
            <option value="all">All Test Types</option>
            <option value="mutation_killer">Mutation Killer</option>
            <option value="incident_regression">Incident Regression</option>
            <option value="boundary_check">Boundary Check</option>
          </Select>

          <Select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="w-36 text-xs border-blue-500/50 bg-blue-950/20"
          >
            <option value="none">Group: None</option>
            <option value="test_type">Group: Test Type</option>
            <option value="repository">Group: Repository</option>
            <option value="branch">Group: Branch</option>
            <option value="commit">Group: Commit</option>
            <option value="incident">Group: Incident</option>
          </Select>
        </div>
      </div>

      {/* Test Cases Table View */}
      {groupBy === 'none' ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold text-white">
              Catalog Test Cases ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {renderTable(filtered)}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([groupTitle, items]) => (
            <Card key={groupTitle}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-900/40 border-b border-slate-800">
                <CardTitle className="text-xs font-semibold text-blue-400 flex items-center gap-2 uppercase tracking-wider">
                  <FolderGit2 className="w-4 h-4 text-slate-400" />
                  {groupTitle} ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {renderTable(items)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Inspect & Execute Test Case Modal */}
      <Dialog
        isOpen={Boolean(selectedTestCase)}
        onClose={() => setSelectedTestCase(null)}
        title={selectedTestCase ? `${selectedTestCase.name}` : ''}
        description={selectedTestCase ? `${selectedTestCase.file_path} (${selectedTestCase.framework})` : ''}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => selectedTestCase && handleExportTest(selectedTestCase)}
              >
                Export .py
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Play className="w-3.5 h-3.5 text-emerald-400" />}
                isLoading={isRunningSandbox}
                onClick={() => selectedTestCase && handleRunInSandbox(selectedTestCase)}
              >
                Run in Sandbox
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {selectedTestCase?.review_status !== 'approved' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-emerald-400 border-emerald-500/50 hover:bg-emerald-950/30"
                  onClick={() => selectedTestCase && handleReviewAction(selectedTestCase, 'approved')}
                >
                  Approve Test
                </Button>
              )}
              {selectedTestCase?.review_status !== 'rejected' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400 border-red-500/50 hover:bg-red-950/30"
                  onClick={() => selectedTestCase && handleReviewAction(selectedTestCase, 'rejected')}
                >
                  Reject Test
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setSelectedTestCase(null)}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        {selectedTestCase && (
          <div className="space-y-4">
            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusPill status={(selectedTestCase.status as TestStatus) || 'verified'} />
              <Badge variant={selectedTestCase.review_status === 'approved' ? 'green' : 'purple'}>
                Review: {selectedTestCase.review_status.toUpperCase()}
              </Badge>
              <Badge variant="outline">Type: {selectedTestCase.test_type}</Badge>
              {selectedTestCase.evidence_hash && (
                <span className="font-mono text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Hash: {selectedTestCase.evidence_hash.slice(0, 16)}...
                </span>
              )}
            </div>

            {/* Test Code Block */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-200">
              <pre className="overflow-x-auto leading-relaxed">{selectedTestCase.code}</pre>
            </div>

            {/* Live Sandbox Execution Output */}
            {sandboxOutput && (
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-blue-400" />
                    Sandbox Execution Output
                  </span>
                  <span className={sandboxOutput.exit_code === 0 ? 'text-emerald-400 font-mono font-bold' : 'text-red-400 font-mono font-bold'}>
                    Exit Code: {sandboxOutput.exit_code} ({sandboxOutput.exit_code === 0 ? 'PASSED' : 'FAILED'})
                  </span>
                </div>
                <pre className="p-2 bg-slate-900 rounded font-mono text-[11px] text-slate-300 overflow-x-auto max-h-36">
                  {sandboxOutput.stdout || sandboxOutput.stderr || 'No stdout output.'}
                </pre>
                <div className="text-[11px] font-mono text-slate-500">
                  Evidence SHA-256: {sandboxOutput.evidence_hash}
                </div>
              </div>
            )}

            {/* Execution History */}
            {selectedTestCase.execution_history && selectedTestCase.execution_history.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  Recent Sandbox Execution Proofs:
                </span>
                <div className="space-y-1">
                  {selectedTestCase.execution_history.slice(-3).map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-900/60 rounded border border-slate-800/80 text-[11px] font-mono">
                      <span className="text-slate-400">{h.executed_at?.slice(0, 19)}</span>
                      <span className={h.exit_code === 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {h.status?.toUpperCase()} ({h.duration_ms}ms)
                      </span>
                      <span className="text-slate-500 text-[10px]">{h.evidence_hash?.slice(0, 12)}...</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Create Test Case Modal */}
      <Dialog
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Add Verified Test Case to Catalog"
        description="Author or promote an invariant protection test case into the shared project suite."
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsNewModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateTestCase}>
              Save Test Case
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label="Test Name *"
            placeholder="e.g. test_invoice_zero_cycle_boundary"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="File Path"
              value={newFile}
              onChange={(e) => setNewFile(e.target.value)}
            />
            <Input
              label="Function Name"
              value={newFunc}
              onChange={(e) => setNewFunc(e.target.value)}
            />
          </div>

          <Select
            label="Test Type"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          >
            <option value="mutation_killer">Mutation Killer</option>
            <option value="incident_regression">Incident Regression</option>
            <option value="boundary_check">Boundary Check</option>
            <option value="custom_unit">Custom Unit Test</option>
          </Select>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Test Code Body:</label>
              <button
                type="button"
                className="text-[11px] text-blue-400 hover:underline"
                onClick={() => handleCheckDuplicate(newCode)}
              >
                {isCheckingDuplicate ? 'Checking...' : 'Check Duplicates'}
              </button>
            </div>
            <textarea
              value={newCode}
              onChange={(e) => {
                setNewCode(e.target.value);
                if (duplicateWarning) setDuplicateWarning(null);
              }}
              className="w-full h-28 bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-slate-100 resize-none focus:outline-none focus:border-blue-500"
            />
          </div>

          {duplicateWarning && (
            <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-lg text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{duplicateWarning}</span>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );

  function renderTable(items: TestCaseResult[]) {
    if (items.length === 0) {
      return (
        <div className="p-10 text-center border-t border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 mx-auto flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">No test cases present in this repository</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              TestBlind can automatically analyze your repository source files and synthesize initial unit test cases and boundary invariants.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Sparkles className="w-4 h-4 text-amber-300" />}
              isLoading={isAutoGenerating}
              onClick={handleAutoGenerateTests}
            >
              Auto-Generate Test Cases & Scenarios
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={() => setIsNewModalOpen(true)}
            >
              Manual New Test
            </Button>
          </div>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent cursor-default">
            <TableHead>Test Name & Target</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Review</TableHead>
            <TableHead>Verification</TableHead>
            <TableHead>Evidence Hash</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {items.map((tc) => (
            <TableRow
              key={tc.id}
              onClick={() => setSelectedTestCase(tc)}
              className="hover:bg-slate-800/60 cursor-pointer"
            >
              <TableCell>
                <div className="font-semibold text-white text-xs font-mono">{tc.name}</div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">{tc.file_path}</div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-[11px] text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20">
                  {tc.test_type || 'mutation_killer'}
                </span>
              </TableCell>
              <TableCell>
                <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${
                  tc.review_status === 'approved'
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30'
                    : tc.review_status === 'rejected'
                    ? 'text-red-400 border-red-500/30 bg-red-950/30'
                    : 'text-amber-400 border-amber-500/30 bg-amber-950/30'
                }`}>
                  {tc.review_status || 'approved'}
                </span>
              </TableCell>
              <TableCell>
                <StatusPill status={(tc.status as TestStatus) || 'verified'} />
              </TableCell>
              <TableCell className="font-mono text-[11px] text-slate-400">
                {tc.evidence_hash ? `${tc.evidence_hash.slice(0, 10)}...` : 'unsealed'}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" className="text-blue-400 hover:text-white">
                  Inspect <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
}

const MOCK_INITIAL_CASES: TestCaseResult[] = [
  {
    id: 'tc-01',
    project_id: 'proj-01',
    name: 'test_jwt_boundary_exact_expiry',
    file_path: 'tests/auth/test_jwt.py',
    function_name: 'test_jwt_boundary_exact_expiry',
    framework: 'pytest 8.2',
    code: `def test_jwt_boundary_exact_expiry():\n    token = issue_token(exp=1700000000)\n    assert validate_token(token, current_time=1700000000) is False`,
    status: 'verified',
    mutation_kill_count: 2,
    is_flaky: false,
    repository_name: 'backend-core',
    branch: 'main',
    commit_sha: 'a1b2c3d4',
    test_type: 'mutation_killer',
    review_status: 'approved',
    verification_status: 'verified',
    evidence_hash: '9f81a7428e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991',
    gap_resolved: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'tc-02',
    project_id: 'proj-01',
    name: 'test_invoice_prorate_zero_cycle_days',
    file_path: 'tests/billing/test_prorate.py',
    function_name: 'test_invoice_prorate_zero_cycle_days',
    framework: 'pytest 8.2',
    code: `def test_invoice_prorate_zero_cycle_days():\n    res = calculate_prorate(days=0, total=49.0)\n    assert res == 0.0`,
    status: 'verified',
    mutation_kill_count: 3,
    is_flaky: false,
    repository_name: 'billing-service',
    branch: 'main',
    commit_sha: 'e5f6a7b8',
    test_type: 'incident_regression',
    review_status: 'approved',
    verification_status: 'verified',
    evidence_hash: 'b2c3d4e5f6a7b89f81a7428e3b0c44298fc1c149afbf4c8996fb92427ae41e46',
    gap_resolved: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'tc-03',
    project_id: 'proj-01',
    name: 'test_stale_cache_bypass_on_mutation',
    file_path: 'tests/storage/test_cache.py',
    function_name: 'test_stale_cache_bypass_on_mutation',
    framework: 'pytest 8.2',
    code: `def test_stale_cache_bypass_on_mutation():\n    cache.invalidate("user_session_42")\n    assert fetch_session("user_session_42") is None`,
    status: 'ai_suggested',
    mutation_kill_count: 1,
    is_flaky: false,
    repository_name: 'cache-layer',
    branch: 'develop',
    commit_sha: 'c4d5e6f7',
    test_type: 'boundary_check',
    review_status: 'pending_review',
    verification_status: 'ai_suggested',
    gap_resolved: false,
    created_at: new Date().toISOString(),
  },
];
