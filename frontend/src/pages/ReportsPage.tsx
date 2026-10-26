import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { StatusPill } from '@/components/ui/StatusPill';
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
  Download,
  FileText,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Eye,
} from 'lucide-react';

interface SuiteReport {
  id: string;
  name: string;
  project: string;
  testCount: number;
  mutationKillRate: number;
  lineCoverage: number;
  branchCoverage: number;
  flakinessScore: number;
  status: 'optimal' | 'warning' | 'critical';
  lastRun: string;
  mutantBreakdown: {
    ror: { total: number; killed: number };
    aor: { total: number; killed: number };
    lcr: { total: number; killed: number };
    bsr: { total: number; killed: number };
  };
}

const MOCK_SUITES: SuiteReport[] = [
  {
    id: 'REP-01',
    name: 'auth/jwt_validator_test.py',
    project: 'core-auth-service',
    testCount: 42,
    mutationKillRate: 88.5,
    lineCoverage: 96.2,
    branchCoverage: 89.1,
    flakinessScore: 0.5,
    status: 'optimal',
    lastRun: '15 mins ago',
    mutantBreakdown: {
      ror: { total: 24, killed: 22 },
      aor: { total: 12, killed: 11 },
      lcr: { total: 18, killed: 15 },
      bsr: { total: 8, killed: 7 },
    },
  },
  {
    id: 'REP-02',
    name: 'billing/proration_calculator.spec.ts',
    project: 'billing-engine',
    testCount: 28,
    mutationKillRate: 64.2,
    lineCoverage: 78.4,
    branchCoverage: 62.0,
    flakinessScore: 6.8,
    status: 'warning',
    lastRun: '1 hour ago',
    mutantBreakdown: {
      ror: { total: 30, killed: 18 },
      aor: { total: 25, killed: 16 },
      lcr: { total: 15, killed: 9 },
      bsr: { total: 12, killed: 8 },
    },
  },
  {
    id: 'REP-03',
    name: 'storage/s3_multipart_uploader.go',
    project: 'data-pipeline',
    testCount: 35,
    mutationKillRate: 92.1,
    lineCoverage: 94.0,
    branchCoverage: 91.5,
    flakinessScore: 1.2,
    status: 'optimal',
    lastRun: '3 hours ago',
    mutantBreakdown: {
      ror: { total: 20, killed: 19 },
      aor: { total: 16, killed: 15 },
      lcr: { total: 22, killed: 20 },
      bsr: { total: 6, killed: 5 },
    },
  },
  {
    id: 'REP-04',
    name: 'checkout/discount_engine_test.py',
    project: 'ecommerce-checkout',
    testCount: 19,
    mutationKillRate: 52.0,
    lineCoverage: 68.1,
    branchCoverage: 48.3,
    flakinessScore: 11.4,
    status: 'critical',
    lastRun: '5 hours ago',
    mutantBreakdown: {
      ror: { total: 26, killed: 12 },
      aor: { total: 18, killed: 8 },
      lcr: { total: 14, killed: 8 },
      bsr: { total: 10, killed: 4 },
    },
  },
];

export function ReportsPage() {
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedRange, setSelectedRange] = useState('7d');
  const [selectedSuite, setSelectedSuite] = useState<SuiteReport | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const filteredSuites = MOCK_SUITES.filter(
    (s) => selectedProject === 'all' || s.project === selectedProject
  );

  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredSuites, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `testblind-report-${selectedRange}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setDownloadNotice('JSON report downloaded successfully.');
    } else if (format === 'csv') {
      const headers = 'ID,Name,Project,TestCount,MutationKillRate,LineCoverage,BranchCoverage,FlakinessScore\n';
      const rows = filteredSuites
        .map(
          (s) =>
            `${s.id},"${s.name}",${s.project},${s.testCount},${s.mutationKillRate}%,${s.lineCoverage}%,${s.branchCoverage}%,${s.flakinessScore}%`
        )
        .join('\n');
      const csvStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + rows);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', csvStr);
      downloadAnchor.setAttribute('download', `testblind-report-${selectedRange}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setDownloadNotice('CSV report downloaded successfully.');
    } else {
      setDownloadNotice('PDF report generation triggered (Demo: printable version prepared).');
      window.print();
    }

    setTimeout(() => setDownloadNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner context="Reports & Quality Analytics (Historical aggregation generated from container sandbox verification passes)." />

      {downloadNotice && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{downloadNotice}</span>
          </div>
          <button
            onClick={() => setDownloadNotice(null)}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-teal" />
            Test Health & Audit Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aggregated mutation kill rates, multi-layer code coverage, and test flakiness metrics.
          </p>
        </div>

        {/* Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            className="text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            className="text-xs flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Export JSON
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleExport('pdf')}
            className="text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-slate-900/60 border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>
            <div className="w-48">
              <Select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                options={[
                  { value: 'all', label: 'All Projects' },
                  { value: 'core-auth-service', label: 'core-auth-service' },
                  { value: 'billing-engine', label: 'billing-engine' },
                  { value: 'data-pipeline', label: 'data-pipeline' },
                  { value: 'ecommerce-checkout', label: 'ecommerce-checkout' },
                ]}
              />
            </div>
            <div className="w-36">
              <Select
                value={selectedRange}
                onChange={(e) => setSelectedRange(e.target.value)}
                options={[
                  { value: '7d', label: 'Last 7 Days' },
                  { value: '30d', label: 'Last 30 Days' },
                  { value: '90d', label: 'Last 90 Days' },
                ]}
              />
            </div>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3" />
            <span>Updated 5m ago from isolated CI runners</span>
          </div>
        </div>
      </Card>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900/40 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Overall Mutation Score</span>
            <Badge variant="cyan" size="sm">+4.2%</Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">78.4%</span>
            <span className="text-xs text-slate-500">328 / 418 killed</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-brand-teal h-full rounded-full" style={{ width: '78.4%' }} />
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/40 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Semantic Code Coverage</span>
            <Badge variant="blue" size="sm">Healthy</Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">84.2%</span>
            <span className="text-xs text-slate-500">91% line / 82% branch</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: '84.2%' }} />
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/40 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Suite Flakiness Index</span>
            <Badge variant="green" size="sm">-1.4%</Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">2.8%</span>
            <span className="text-xs text-amber-400/90">2 unstable tests</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: '2.8%' }} />
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/40 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Mean Time to Kill (MTTK)</span>
            <Badge variant="purple" size="sm">Airgapped</Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">1.8s</span>
            <span className="text-xs text-slate-500">per mutant check</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-purple-500 h-full rounded-full" style={{ width: '65%' }} />
          </div>
        </Card>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mutation Operator Effectiveness */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="border-b border-slate-800/80 pb-3">
            <CardTitle className="text-sm font-medium text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-teal" />
                Mutation Effectiveness by Operator
              </span>
              <span className="text-xs font-normal text-slate-400">AST Transformations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">ROR (Relational Operators: &lt;, &gt;, ==, !=)</span>
                <span className="text-slate-400">82% Killed (82/100)</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '82%' }} />
                <div className="bg-rose-500/80 h-full" style={{ width: '18%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">AOR (Arithmetic Operators: +, -, *, /)</span>
                <span className="text-slate-400">76% Killed (68/90)</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '76%' }} />
                <div className="bg-rose-500/80 h-full" style={{ width: '24%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">LCR (Logical Connectors: &amp;&amp;, ||, !)</span>
                <span className="text-slate-400">68% Killed (45/66)</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '68%' }} />
                <div className="bg-rose-500/80 h-full" style={{ width: '32%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">BSR (Bound &amp; Shift Registers: &gt;&gt;, &lt;&lt;)</span>
                <span className="text-slate-400">85% Killed (34/40)</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '85%' }} />
                <div className="bg-rose-500/80 h-full" style={{ width: '15%' }} />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span>Killed (Passing quality check)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80" />
                  <span>Survived (Test gap detected)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Multi-Dimensional Coverage Comparison */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="border-b border-slate-800/80 pb-3">
            <CardTitle className="text-sm font-medium text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Multi-Layered Coverage Integrity
              </span>
              <span className="text-xs font-normal text-slate-400">Semantic vs Syntactic</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Line Coverage (Syntactic lines executed)</span>
                <span className="font-mono text-slate-200">91.4%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: '91.4%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Branch Coverage (Condition outcomes evaluated)</span>
                <span className="font-mono text-slate-200">82.0%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-cyan-500 h-full rounded-full" style={{ width: '82.0%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Mutation Coverage (Fault-detection efficacy)</span>
                <span className="font-mono text-slate-200">78.4%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-brand-teal h-full rounded-full" style={{ width: '78.4%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300">Invariant Assertion Density (Assertions / Branch)</span>
                <span className="font-mono text-slate-200">68.2%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: '68.2%' }} />
              </div>
            </div>

            <div className="pt-2 text-xs text-slate-400 border-t border-slate-800/60 leading-relaxed">
              <span className="text-amber-400 font-medium">Gap Analysis Insight:</span> Traditional line coverage (91.4%) masks surviving mutants in 13.0% of unexercised boundary condition permutations.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Suites Audit Table */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="border-b border-slate-800/80 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-teal" />
            Test Suite Audit Breakdown ({filteredSuites.length} suites)
          </CardTitle>
          <span className="text-xs text-slate-400">Click row for mutant breakdown</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test Suite File</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Tests</TableHead>
                <TableHead>Mutation Score</TableHead>
                <TableHead>Line / Branch</TableHead>
                <TableHead>Flakiness</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuites.map((suite) => (
                <TableRow
                  key={suite.id}
                  className="cursor-pointer hover:bg-slate-800/50 transition-colors"
                  onClick={() => setSelectedSuite(suite)}
                >
                  <TableCell className="font-mono text-xs text-cyan-400 font-medium">
                    {suite.name}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {suite.project}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {suite.testCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">
                        {suite.mutationKillRate}%
                      </span>
                      <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            suite.mutationKillRate >= 80
                              ? 'bg-emerald-500'
                              : suite.mutationKillRate >= 65
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${suite.mutationKillRate}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 font-mono">
                    {suite.lineCoverage}% / {suite.branchCoverage}%
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-mono ${
                        suite.flakinessScore > 5
                          ? 'text-rose-400 font-semibold'
                          : suite.flakinessScore > 2
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {suite.flakinessScore}%
                    </span>
                  </TableCell>
                  <TableCell>
                    {suite.status === 'optimal' && (
                      <Badge variant="green" size="sm">Optimal</Badge>
                    )}
                    {suite.status === 'warning' && (
                      <Badge variant="amber" size="sm">Attention</Badge>
                    )}
                    {suite.status === 'critical' && (
                      <Badge variant="rose" size="sm">Gaps Detected</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSuite(suite);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Suite Detail Modal */}
      {selectedSuite && (
        <Dialog
          isOpen={true}
          onClose={() => setSelectedSuite(null)}
          title={`Suite Audit: ${selectedSuite.name}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                <span className="text-[11px] text-slate-400">Total Tests</span>
                <p className="text-lg font-bold text-slate-100">{selectedSuite.testCount}</p>
              </div>
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                <span className="text-[11px] text-slate-400">Kill Rate</span>
                <p className="text-lg font-bold text-emerald-400">{selectedSuite.mutationKillRate}%</p>
              </div>
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                <span className="text-[11px] text-slate-400">Branch Coverage</span>
                <p className="text-lg font-bold text-cyan-400">{selectedSuite.branchCoverage}%</p>
              </div>
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                <span className="text-[11px] text-slate-400">Flakiness</span>
                <p className="text-lg font-bold text-amber-400">{selectedSuite.flakinessScore}%</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2">Operator Kill Breakdown</h4>
              <div className="space-y-2">
                {Object.entries(selectedSuite.mutantBreakdown).map(([op, data]) => {
                  const rate = Math.round((data.killed / data.total) * 100);
                  return (
                    <div key={op} className="p-2.5 bg-slate-950/40 border border-slate-800 rounded-lg">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-mono text-cyan-300 uppercase">{op} Mutants</span>
                        <span className="text-slate-300">
                          {data.killed} / {data.total} killed ({rate}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400">
              <span className="text-slate-200 font-medium">Isolated Execution Proof:</span>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                Container run hash: sha256:7f01a392b4... | Verified non-root UID 10001 | Zero network egress
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedSuite(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default ReportsPage;
