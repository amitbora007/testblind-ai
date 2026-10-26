import React, { useState } from 'react';
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
} from 'lucide-react';

export interface TestCaseItem {
  id: string;
  name: string;
  file: string;
  language: string;
  framework: string;
  status: TestStatus;
  statusLabel: string;
  mutantsKilled: number;
  totalMutants: number;
  lastExecution: string;
  codeSnippet: string;
}

const MOCK_TEST_CASES: TestCaseItem[] = [
  {
    id: 'TC-1049',
    name: 'test_jwt_boundary_exact_expiry',
    file: 'tests/auth/test_jwt.py',
    language: 'Python',
    framework: 'pytest 8.2',
    status: 'verified',
    statusLabel: 'Verified Execution',
    mutantsKilled: 2,
    totalMutants: 2,
    lastExecution: '15m ago',
    codeSnippet: `def test_jwt_boundary_exact_expiry():\n    token = issue_token(exp=1700000000)\n    assert validate_token(token, current_time=1700000000) is False`,
  },
  {
    id: 'TC-1048',
    name: 'test_invoice_prorate_zero_cycle_days',
    file: 'tests/billing/test_prorate.py',
    language: 'Python',
    framework: 'pytest 8.2',
    status: 'verified',
    statusLabel: 'Verified Execution',
    mutantsKilled: 3,
    totalMutants: 3,
    lastExecution: '1 hour ago',
    codeSnippet: `def test_invoice_prorate_zero_cycle_days():\n    res = calculate_prorate(days=0, total=49.0)\n    assert res == 0.0`,
  },
  {
    id: 'TC-1047',
    name: 'test_stale_cache_bypass_on_mutation',
    file: 'tests/storage/test_cache.py',
    language: 'Python',
    framework: 'pytest 8.2',
    status: 'ai_suggested',
    statusLabel: 'AI Draft (Unexecuted)',
    mutantsKilled: 1,
    totalMutants: 1,
    lastExecution: 'Unexecuted',
    codeSnippet: `def test_stale_cache_bypass_on_mutation():\n    cache.invalidate("user_session_42")\n    assert fetch_session("user_session_42") is None`,
  },
  {
    id: 'TC-1046',
    name: 'test_rate_limiter_distributed_burst',
    file: 'tests/api/test_limiter.py',
    language: 'Python',
    framework: 'pytest 8.2',
    status: 'failed',
    statusLabel: 'Failed on Baseline',
    mutantsKilled: 0,
    totalMutants: 2,
    lastExecution: '2 hours ago',
    codeSnippet: `def test_rate_limiter_distributed_burst():\n    with concurrent.futures.ThreadPoolExecutor() as executor:\n        results = list(executor.map(send_request, range(200)))\n    assert results.count(429) >= 100`,
  },
  {
    id: 'TC-1045',
    name: 'test_webhook_idempotency_token_cache',
    file: 'tests/payments/test_webhooks.py',
    language: 'TypeScript',
    framework: 'vitest 1.6',
    status: 'verified',
    statusLabel: 'Verified Execution',
    mutantsKilled: 4,
    totalMutants: 4,
    lastExecution: '3 hours ago',
    codeSnippet: `it('handles duplicate charge event idempotently', async () => {\n  const res1 = await postWebhook(mockCharge);\n  const res2 = await postWebhook(mockCharge);\n  expect(res2.status).toBe(200);\n});`,
  },
];

export function TestCasesPage() {
  const [testCases, setTestCases] = useState<TestCaseItem[]>(MOCK_TEST_CASES);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [selectedTestCase, setSelectedTestCase] = useState<TestCaseItem | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // New test case state
  const [newName, setNewName] = useState('');
  const [newFile, setNewFile] = useState('tests/test_custom.py');
  const [newCode, setNewCode] = useState('def test_new_case():\n    assert True');

  const filteredTests = testCases.filter((tc) => {
    const matchesSearch =
      tc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tc.status === statusFilter;
    const matchesLang = languageFilter === 'all' || tc.language.toLowerCase() === languageFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesLang;
  });

  const handleCreateTestCase = () => {
    if (!newName.trim()) return;

    const newTC: TestCaseItem = {
      id: `TC-${1050 + testCases.length}`,
      name: newName.trim(),
      file: newFile,
      language: 'Python',
      framework: 'pytest 8.2',
      status: 'ai_suggested',
      statusLabel: 'AI Draft (Unexecuted)',
      mutantsKilled: 0,
      totalMutants: 1,
      lastExecution: 'Unexecuted',
      codeSnippet: newCode,
    };

    setTestCases([newTC, ...testCases]);
    setIsNewModalOpen(false);
    setNewName('');
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredTests, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'testblind-test-cases.json';
    a.click();
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner message="DEMO MODE — Unified Regression Test Library distinguishing verified execution tests from unexecuted AI drafts." />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Unified Test Case Catalog</h2>
          <p className="text-xs text-slate-400">
            Searchable repository of regression tests, boundary assertions, and verified incident reproduction suites.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportJSON}
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
          <span className="text-2xl font-bold text-white font-mono mt-1 block">1,250</span>
          <span className="text-[11px] text-slate-400">Across 6 repositories</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Verified Executed</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">850</span>
          <span className="text-[11px] text-emerald-500 font-medium">Exit Code 0 Proof</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">AI Draft Candidates</span>
          <span className="text-2xl font-bold text-purple-300 font-mono mt-1 block">250</span>
          <span className="text-[11px] text-purple-400 font-medium">Pending Sandbox Run</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Failing / Triage Needed</span>
          <span className="text-2xl font-bold text-red-400 font-mono mt-1 block">150</span>
          <span className="text-[11px] text-red-400 font-medium">Requires attention</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search test cases by name, ID, or file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40 text-xs"
          >
            <option value="all">All Verification Statuses</option>
            <option value="verified">Verified Execution</option>
            <option value="ai_suggested">AI Draft (Unexecuted)</option>
            <option value="failed">Failed on Baseline</option>
          </Select>

          <Select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="w-32 text-xs"
          >
            <option value="all">All Languages</option>
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
          </Select>
        </div>
      </div>

      {/* Test Cases Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold text-white">
            Regression Library Tests
          </CardTitle>
          <span className="text-xs text-slate-400">
            Showing {filteredTests.length} test records
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent cursor-default">
                <TableHead>Test ID</TableHead>
                <TableHead>Test Name & Target</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead>Verification Status</TableHead>
                <TableHead>Mutants Killed</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredTests.map((tc) => (
                <TableRow
                  key={tc.id}
                  onClick={() => setSelectedTestCase(tc)}
                  className="hover:bg-slate-800/60"
                >
                  <TableCell className="font-mono text-xs font-semibold text-blue-400">
                    {tc.id}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-white text-xs">{tc.name}</div>
                    <div className="font-mono text-[11px] text-slate-500 mt-0.5">{tc.file}</div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-slate-300">{tc.framework}</span>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={tc.status} label={tc.statusLabel} />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-bold text-purple-300">
                      {tc.mutantsKilled} / {tc.totalMutants}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {tc.lastExecution}
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
        </CardContent>
      </Card>

      {/* Inspect Test Case Modal */}
      <Dialog
        isOpen={Boolean(selectedTestCase)}
        onClose={() => setSelectedTestCase(null)}
        title={selectedTestCase ? `${selectedTestCase.id}: ${selectedTestCase.name}` : ''}
        description={selectedTestCase ? `${selectedTestCase.file} (${selectedTestCase.framework})` : ''}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <StatusPill
              status={selectedTestCase?.status || 'verified'}
              label={selectedTestCase?.statusLabel}
            />
            <Button variant="secondary" size="sm" onClick={() => setSelectedTestCase(null)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedTestCase && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-200">
              <pre className="overflow-x-auto leading-relaxed">{selectedTestCase.codeSnippet}</pre>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
              <span className="text-slate-400">Target Mutants Killed:</span>
              <span className="font-mono text-emerald-400 font-bold">
                {selectedTestCase.mutantsKilled} / {selectedTestCase.totalMutants} (100% effectiveness)
              </span>
            </div>
          </div>
        )}
      </Dialog>

      {/* Create Test Case Modal */}
      <Dialog
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Add New Test Case to Regression Suite"
        description="Author an atomic test assertion or boundary invariant."
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
            label="Test Function Name *"
            placeholder="e.g. test_payment_idempotency_retry"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            label="File Path"
            value={newFile}
            onChange={(e) => setNewFile(e.target.value)}
          />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Test Code Body:</label>
            <textarea
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="w-full h-28 bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-slate-100 resize-none focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
