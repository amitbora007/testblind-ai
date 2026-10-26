import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  ScanSearch,
  GitBranch,
  PlayCircle,
  Filter,
  Search,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Code2,
  CheckCircle2,
} from 'lucide-react';

export interface MutationRecord {
  id: string;
  file: string;
  line: number;
  operator: 'ROR' | 'AOR' | 'LCR' | 'BSR';
  originalToken: string;
  mutatedToken: string;
  status: 'survived' | 'killed' | 'timeout';
  synthesizedTest?: string;
  snippetOriginal: string;
  snippetMutated: string;
}

const MOCK_MUTATIONS: MutationRecord[] = [
  {
    id: 'MUT-2041',
    file: 'src/auth/jwt_validator.py',
    line: 84,
    operator: 'ROR',
    originalToken: 'exp > current_timestamp',
    mutatedToken: 'exp >= current_timestamp',
    status: 'survived',
    snippetOriginal: 'if payload.get("exp") > current_timestamp:\n    return True\nreturn False',
    snippetMutated: 'if payload.get("exp") >= current_timestamp:\n    return True\nreturn False',
    synthesizedTest: 'def test_exact_expiry_boundary():\n    token = issue_token(exp=1700000000)\n    assert validate_token(token, current_time=1700000000) is False',
  },
  {
    id: 'MUT-2042',
    file: 'src/billing/tier_engine.py',
    line: 42,
    operator: 'AOR',
    originalToken: 'subtotal * (1 - discount_rate)',
    mutatedToken: 'subtotal * (1 + discount_rate)',
    status: 'killed',
    snippetOriginal: 'return subtotal * (1 - discount_rate)',
    snippetMutated: 'return subtotal * (1 + discount_rate)',
  },
  {
    id: 'MUT-2043',
    file: 'src/storage/cache_broker.py',
    line: 112,
    operator: 'LCR',
    originalToken: 'is_cached and not is_stale',
    mutatedToken: 'is_cached or not is_stale',
    status: 'survived',
    snippetOriginal: 'if is_cached and not is_stale:\n    return cached_record',
    snippetMutated: 'if is_cached or not is_stale:\n    return cached_record',
    synthesizedTest: 'def test_stale_cache_invalidation():\n    # Invariant: Must fetch origin if cache is marked stale even when present\n    cache.set("key", stale=True)\n    assert fetch_record("key") == ORIGIN_DATA',
  },
  {
    id: 'MUT-2044',
    file: 'src/api/rate_limiter.py',
    line: 29,
    operator: 'BSR',
    originalToken: 'return False (Block Request)',
    mutatedToken: 'return True (Pass through)',
    status: 'survived',
    snippetOriginal: 'if client_hits > max_threshold:\n    return False',
    snippetMutated: 'if client_hits > max_threshold:\n    return True',
    synthesizedTest: 'def test_rate_limit_exceeded_blocks_subsequent():\n    for _ in range(101):\n        res = limiter.check("192.168.1.1")\n    assert res is False',
  },
  {
    id: 'MUT-2045',
    file: 'src/auth/jwt_validator.py',
    line: 95,
    operator: 'ROR',
    originalToken: 'user_role == "admin"',
    mutatedToken: 'user_role != "admin"',
    status: 'killed',
    snippetOriginal: 'return user_role == "admin"',
    snippetMutated: 'return user_role != "admin"',
  },
];

export function GapDiscoveryPage() {
  const [selectedRepo, setSelectedRepo] = useState('acme-corp/core-auth-service');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'survived' | 'killed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectMutant, setInspectMutant] = useState<MutationRecord | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [promotedTest, setPromotedTest] = useState<string | null>(null);

  const filteredMutations = MOCK_MUTATIONS.filter((m) => {
    const matchesOperator = operatorFilter === 'all' || m.operator === operatorFilter;
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesSearch =
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.originalToken.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesOperator && matchesStatus && matchesSearch;
  });

  const handlePromoteTest = (mutantId: string) => {
    setPromotedTest(mutantId);
    setTimeout(() => {
      setPromotedTest(null);
      setInspectMutant(null);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner message="DEMO MODE — AST mutation discovery matrix analyzing surviving blindspots and synthesizing targeting assertions." />

      {/* Header and Trigger */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">AI Test Gap Discovery</h2>
          <p className="text-xs text-slate-400">
            Inject semantic AST mutations to unmask test blindspots surviving existing automated suites.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-36 text-xs"
          >
            <option value="main">branch: main</option>
            <option value="develop">branch: develop</option>
          </Select>

          <Button
            variant="primary"
            size="sm"
            isLoading={isScanning}
            onClick={() => {
              setIsScanning(true);
              setTimeout(() => setIsScanning(false), 800);
            }}
            leftIcon={<PlayCircle className="w-4 h-4" />}
          >
            Run Gap Analysis
          </Button>
        </div>
      </div>

      {/* Top 4 KPI Metrics for Mutation Analysis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Total AST Mutants</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">184</span>
          <span className="text-[11px] text-slate-400">Injected across 42 files</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Killed by Existing Tests</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">142</span>
          <span className="text-[11px] text-emerald-500 font-medium">77.1% Kill rate</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Surviving Blindspots</span>
          <span className="text-2xl font-bold text-red-400 font-mono mt-1 block">42</span>
          <span className="text-[11px] text-red-400 font-medium">Requires targeting tests</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">AI Verified Kill Gain</span>
          <span className="text-2xl font-bold text-purple-300 font-mono mt-1 block">+18.5%</span>
          <span className="text-[11px] text-purple-400 font-medium">Predicted score: 95.6%</span>
        </Card>
      </div>

      {/* Filter and Operator Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search mutants by file or token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Operator Filter Tabs */}
          <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
            {['all', 'ROR', 'AOR', 'LCR', 'BSR'].map((op) => (
              <button
                key={op}
                onClick={() => setOperatorFilter(op)}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors ${
                  operatorFilter === op
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {op.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-36 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="survived">Surviving Only</option>
            <option value="killed">Killed Only</option>
          </Select>
        </div>
      </div>

      {/* Mutation Matrix Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold text-white">
            AST Mutation Testing Matrix
          </CardTitle>
          <span className="text-xs text-slate-400">
            Showing {filteredMutations.length} of {MOCK_MUTATIONS.length} mutants
          </span>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent cursor-default">
                <TableHead>Mutant ID</TableHead>
                <TableHead>Target File & Line</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Semantic Mutation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredMutations.map((mutant) => (
                <TableRow
                  key={mutant.id}
                  onClick={() => setInspectMutant(mutant)}
                  className="hover:bg-slate-800/60"
                >
                  <TableCell className="font-mono text-xs font-semibold text-blue-400">
                    {mutant.id}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-200">
                    {mutant.file}:{mutant.line}
                  </TableCell>
                  <TableCell>
                    <Badge variant="purple" size="sm">
                      {mutant.operator}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    <span className="text-red-400">{mutant.originalToken}</span>
                    <span className="text-slate-500 mx-1.5">→</span>
                    <span className="text-emerald-400">{mutant.mutatedToken}</span>
                  </TableCell>
                  <TableCell>
                    {mutant.status === 'survived' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-950/60 px-2 py-0.5 rounded-full border border-red-500/30">
                        SURVIVED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        KILLED
                      </span>
                    )}
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

      {/* Mutant Inspection & Synthesis Modal */}
      <Dialog
        isOpen={Boolean(inspectMutant)}
        onClose={() => setInspectMutant(null)}
        title={inspectMutant ? `${inspectMutant.id} (${inspectMutant.operator} Mutation)` : ''}
        description={inspectMutant ? `${inspectMutant.file} at line ${inspectMutant.line}` : ''}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-400">
              Target invariant: Must fail on mutated syntax and pass on unmutated baseline.
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setInspectMutant(null)}>
                Close
              </Button>
              {inspectMutant?.status === 'survived' && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  onClick={() => inspectMutant && handlePromoteTest(inspectMutant.id)}
                >
                  {promotedTest === inspectMutant?.id ? 'Verified & Promoted!' : 'Synthesize Killing Test'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        {inspectMutant && (
          <div className="space-y-4">
            {/* Diff Preview */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">AST Token Substitution Diff:</span>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
                <div className="text-red-400">- {inspectMutant.snippetOriginal}</div>
                <div className="text-emerald-400">+ {inspectMutant.snippetMutated}</div>
              </div>
            </div>

            {/* AI Synthesized Test (if survived) */}
            {inspectMutant.synthesizedTest ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-purple-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    AI Synthesized Killing Test (Edge-Case Assertion)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">pytest 8.2 compatible</span>
                </div>
                <pre className="p-3 bg-slate-950 rounded-lg border border-purple-500/30 text-purple-200 font-mono text-xs overflow-x-auto leading-relaxed">
                  {inspectMutant.synthesizedTest}
                </pre>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Existing unit test suite successfully killed this mutant. No gap detected.</span>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
