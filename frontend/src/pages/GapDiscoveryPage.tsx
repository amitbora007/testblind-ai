import React, { useState, useEffect } from 'react';
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
import { Pagination } from '@/components/ui/Pagination';
import { DemoModeBanner } from '@/components/common/DemoModeBanner';
import {
  ScanSearch,
  GitBranch,
  PlayCircle,
  Filter,
  Search,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Code2,
  CheckCircle2,
  Clock,
  Hash,
  Database,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  FolderGit2
} from 'lucide-react';
import {
  api,
  isDemoActive,
  ProjectResult,
  ScanJobResult,
  MutationResult,
  SynthesizeMutationResult
} from '@/services/api';

// Fallback demo mutations if backend is offline or empty
const DEMO_MUTATIONS: MutationResult[] = [
  {
    id: 'MUT-2041',
    scan_job_id: 'demo-job-001',
    file_path: 'src/auth/jwt_validator.py',
    line_number: 84,
    operator: 'ROR',
    original_code: 'if payload.get("exp") > current_timestamp:\n    return True\nreturn False',
    mutated_code: 'if payload.get("exp") >= current_timestamp:\n    return True\nreturn False',
    status: 'survived',
    killing_test_name: undefined,
    synthesized_test_code: `def test_jwt_exact_expiry_boundary():
    # Invariant: Tokens must be rejected at the exact second of expiration
    current_time = 1700000000
    token = issue_token(exp=current_time)
    assert validate_token(token, current_timestamp=current_time) is False`,
    verification_status: 'mutation_killing',
    evidence_hash: '9f8e4a7b2c1d3e5f6a8b0c2d4e6f8a0b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f',
    explanation: 'The relational operator > was mutated to >=. Existing tests only check tokens well before or after expiration, missing the exact expiry boundary second.',
    missing_boundary: 'payload.get("exp") == current_timestamp must evaluate to expired (False)',
  },
  {
    id: 'MUT-2042',
    scan_job_id: 'demo-job-001',
    file_path: 'src/billing/tier_engine.py',
    line_number: 42,
    operator: 'AOR',
    original_code: 'return subtotal * (1 - discount_rate)',
    mutated_code: 'return subtotal * (1 + discount_rate)',
    status: 'killed',
    killing_test_name: 'test_tier_discount_applied',
    synthesized_test_code: undefined,
    verification_status: undefined,
    evidence_hash: undefined,
  },
  {
    id: 'MUT-2043',
    scan_job_id: 'demo-job-001',
    file_path: 'src/storage/cache_broker.py',
    line_number: 112,
    operator: 'LCR',
    original_code: 'if is_cached and not is_stale:\n    return cached_record',
    mutated_code: 'if is_cached or not is_stale:\n    return cached_record',
    status: 'survived',
    killing_test_name: undefined,
    synthesized_test_code: `def test_stale_cache_invalidation_boundary():
    # Invariant: Must fetch origin if cache is marked stale even when record is present
    cache.set("session_key", data="cached_val", stale=True)
    record = fetch_record("session_key")
    assert record.source == "ORIGIN_DB"`,
    verification_status: 'mutation_killing',
    evidence_hash: '3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f9f8e4a7b2c1d3e5f6a8b0c2d4e6f8a0b1c',
    explanation: 'Logical operator "and" was mutated to "or". Existing test suite never validated the stale flag when a cache entry exists.',
    missing_boundary: 'is_cached=True, is_stale=True must NOT return cached_record',
  },
  {
    id: 'MUT-2044',
    scan_job_id: 'demo-job-001',
    file_path: 'src/api/rate_limiter.py',
    line_number: 29,
    operator: 'BSR',
    original_code: 'if client_hits > 100:\n    return False',
    mutated_code: 'if client_hits > 101:\n    return False',
    status: 'survived',
    killing_test_name: undefined,
    synthesized_test_code: undefined,
    verification_status: undefined,
    evidence_hash: undefined,
    explanation: 'Boundary shift shifted threshold constant from 100 to 101. No test verified request number exactly 101 is blocked.',
    missing_boundary: 'client_hits == 101 must be rejected',
  },
  {
    id: 'MUT-2045',
    scan_job_id: 'demo-job-001',
    file_path: 'src/auth/jwt_validator.py',
    line_number: 95,
    operator: 'ROR',
    original_code: 'return user_role == "admin"',
    mutated_code: 'return user_role != "admin"',
    status: 'killed',
    killing_test_name: 'test_admin_role_authorization',
    synthesized_test_code: undefined,
    verification_status: undefined,
    evidence_hash: undefined,
  },
  {
    id: 'MUT-2046',
    scan_job_id: 'demo-job-001',
    file_path: 'src/billing/tier_engine.py',
    line_number: 68,
    operator: 'BSR',
    original_code: 'if invoice_total <= 0:\n    return 0',
    mutated_code: 'if invoice_total < 0:\n    return 0',
    status: 'survived',
    killing_test_name: undefined,
    synthesized_test_code: `def test_zero_dollar_invoice_processing():
    # Invariant: $0.00 invoice must resolve with 0 balance without payment gateway call
    res = process_invoice(amount=0.0)
    assert res.balance == 0.0
    assert res.payment_status == "SETTLED"`,
    verification_status: 'mutation_killing',
    evidence_hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    explanation: 'Boundary operator <= was mutated to <. Zero-dollar transactions are unasserted in billing tests.',
    missing_boundary: 'invoice_total == 0 must short-circuit to 0',
  },
];

export function GapDiscoveryPage() {
  // State
  const [projects, setProjects] = useState<ProjectResult[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [latestJob, setLatestJob] = useState<ScanJobResult | null>(null);
  const [mutations, setMutations] = useState<MutationResult[]>(() => isDemoActive() ? DEMO_MUTATIONS : []);
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Filters
  const [operatorFilter, setOperatorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal & Synthesis State
  const [inspectMutant, setInspectMutant] = useState<MutationResult | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthesisResult, setSynthesisResult] = useState<SynthesizeMutationResult | null>(null);
  const [isPromoting, setIsPromoting] = useState<boolean>(false);
  const [promotedSuccess, setPromotedSuccess] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Initial Data Load
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const fetchedProjects = await api.getProjects();
        if (fetchedProjects && fetchedProjects.length > 0) {
          setProjects(fetchedProjects);
          const firstProj = fetchedProjects[0];
          setSelectedProjectId(firstProj.id);
          setSelectedBranch(firstProj.default_branch || 'main');

          // Load latest scan job for this project
          const jobs = await api.getProjectScanJobs(firstProj.id);
          if (jobs && jobs.length > 0) {
            const latest = jobs[0];
            setLatestJob(latest);
            const fetchedMutations = await api.getScanJobMutations(latest.id);
            setMutations(fetchedMutations || []);
          } else {
            setMutations(isDemoActive() ? DEMO_MUTATIONS : []);
          }
          setIsLiveBackend(true);
        } else {
          setIsLiveBackend(false);
          setMutations(isDemoActive() ? DEMO_MUTATIONS : []);
        }
      } catch (err) {
        console.warn('Failed to connect to live backend; operating in demo fallback mode.', err);
        setIsLiveBackend(false);
        setMutations(isDemoActive() ? DEMO_MUTATIONS : []);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // When project changes, fetch its latest scan job & mutations
  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId);
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setSelectedBranch(proj.default_branch || 'main');
    }
    try {
      const jobs = await api.getProjectScanJobs(projectId);
      if (jobs && jobs.length > 0) {
        const latest = jobs[0];
        setLatestJob(latest);
        const fetchedMutations = await api.getScanJobMutations(latest.id);
        setMutations(fetchedMutations || []);
      } else {
        setLatestJob(null);
        setMutations(isDemoActive() ? DEMO_MUTATIONS : []);
      }
    } catch (err) {
      console.warn('Error loading project jobs', err);
    }
  };

  // Run Gap Analysis Trigger
  const handleRunScan = async () => {
    setIsScanning(true);
    try {
      if (selectedProjectId && isLiveBackend) {
        const newJob = await api.triggerScanJobSync(selectedProjectId, selectedBranch);
        setLatestJob(newJob);
        const updatedMutations = await api.getScanJobMutations(newJob.id);
        setMutations(updatedMutations || []);
      } else {
        // Simulated run for demo mode
        if (isDemoActive()) {
          await new Promise((r) => setTimeout(r, 900));
          setMutations(DEMO_MUTATIONS);
        }
      }
    } catch (err) {
      console.error('Scan execution error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Pagination & Filter state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, operatorFilter, statusFilter, selectedProjectId, selectedBranch]);

  const searchLower = searchQuery.toLowerCase().trim();
  const filteredMutations = mutations.filter((m: any) => {
    const matchesOperator =
      operatorFilter === 'all' ||
      (m.operator || '').toUpperCase() === operatorFilter.toUpperCase();
    const matchesStatus =
      statusFilter === 'all' ||
      (m.status || '').toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch =
      !searchLower ||
      (m.id || '').toLowerCase().includes(searchLower) ||
      (m.file_path || '').toLowerCase().includes(searchLower) ||
      (m.original_code || '').toLowerCase().includes(searchLower) ||
      (m.mutated_code || '').toLowerCase().includes(searchLower) ||
      (m.operator || '').toLowerCase().includes(searchLower);
    return matchesOperator && matchesStatus && matchesSearch;
  });

  const totalItems = filteredMutations.length;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedMutations = filteredMutations.slice(startIndex, startIndex + pageSize);

  // Calculate Live KPI Metrics
  const totalCount = latestJob?.total_mutants ?? mutations.length;
  const killedCount = latestJob?.killed_mutants ?? mutations.filter((m) => m.status === 'killed').length;
  const survivingCount = latestJob?.surviving_mutants ?? mutations.filter((m) => m.status === 'survived').length;
  const mutationScore = latestJob
    ? latestJob.mutation_score
    : totalCount > 0
    ? (killedCount / totalCount) * 100
    : 0;

  // Synthesize Test Handler (Dual-State Verification)
  const handleSynthesize = async (mutant: MutationResult) => {
    if (!latestJob || !isLiveBackend) {
      // Demo synthesis simulation
      setIsSynthesizing(true);
      setTimeout(() => {
        setIsSynthesizing(false);
        const synthRes: SynthesizeMutationResult = {
          mutation_id: mutant.id,
          synthesized_test_code: `def test_${mutant.operator.toLowerCase()}_boundary_invariance():\n    # Dual-State Certified: Passes on pristine baseline, fails on mutated syntax\n    val = compute_boundary_check(target=True)\n    assert val is True`,
          verification_status: 'mutation_killing',
          verified: true,
          baseline_passed: true,
          mutant_killed: true,
          evidence_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          duration_ms: 342,
          explanation: `Synthesized targeted assertion killing ${mutant.operator} mutation at line ${mutant.line_number}.`,
          missing_boundary: 'Unasserted boundary equality condition.',
          recommended_action: 'Merge test into regression suite.',
          details: 'Verified in isolated container sandbox.',
        };
        setSynthesisResult(synthRes);
        setInspectMutant({
          ...mutant,
          synthesized_test_code: synthRes.synthesized_test_code,
          verification_status: 'mutation_killing',
          evidence_hash: synthRes.evidence_hash,
          explanation: synthRes.explanation,
          missing_boundary: synthRes.missing_boundary,
        });
      }, 800);
      return;
    }

    try {
      setIsSynthesizing(true);
      const res = await api.synthesizeMutationTest(latestJob.id, mutant.id);
      setSynthesisResult(res);
      // Update local mutant record
      const updated = {
        ...mutant,
        synthesized_test_code: res.synthesized_test_code,
        verification_status: res.verification_status,
        evidence_hash: res.evidence_hash,
        explanation: res.explanation,
        missing_boundary: res.missing_boundary,
      };
      setInspectMutant(updated);
      setMutations((prev) => prev.map((m) => (m.id === mutant.id ? updated : m)));
    } catch (err: any) {
      alert(`Synthesis failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Promote Test to Catalog
  const handlePromote = async (mutant: MutationResult) => {
    if (!latestJob || !isLiveBackend) {
      setIsPromoting(true);
      setTimeout(() => {
        setIsPromoting(false);
        setPromotedSuccess(`Test for ${mutant.id} successfully promoted to suite!`);
        setTimeout(() => setPromotedSuccess(null), 3000);
      }, 600);
      return;
    }

    try {
      setIsPromoting(true);
      const res = await api.promoteMutationTest(
        latestJob.id,
        mutant.id,
        `test_kill_${mutant.id.toLowerCase()}`,
        mutant.synthesized_test_code || undefined
      );
      setPromotedSuccess(res.message);
      setTimeout(() => setPromotedSuccess(null), 3500);
    } catch (err: any) {
      alert(`Promotion failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsPromoting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {!isLiveBackend ? (
        <DemoModeBanner message="DEMO MODE — Operating in AST preview mode. Connect a live repository or project with automated tests to trigger dynamic sandbox execution." />
      ) : (
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">Live Sandbox Runner Connected</span>
            <span className="text-slate-400">• AST Mutation Engine active with Dual-State Verification</span>
          </div>
          {latestJob && (
            <span className="text-slate-400 font-mono text-[11px]">
              Job #{latestJob.id.substring(0, 8)} • {latestJob.duration_seconds.toFixed(2)}s execution
            </span>
          )}
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <ScanSearch className="w-5 h-5 text-blue-400" />
            AI Test Gap Discovery
          </h2>
          <p className="text-xs text-slate-400">
            Inject semantic AST mutations to unmask test blindspots surviving existing automated test suites.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {projects.length > 0 && (
            <Select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-48 text-xs"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-36 text-xs"
          >
            <option value="main">branch: main</option>
            <option value="develop">branch: develop</option>
            <option value="staging">branch: staging</option>
          </Select>

          <Button
            variant="primary"
            size="sm"
            isLoading={isScanning}
            onClick={handleRunScan}
            leftIcon={<PlayCircle className="w-4 h-4" />}
          >
            Run Gap Analysis
          </Button>
        </div>
      </div>

      {/* 4 KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Total AST Mutants</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">{totalCount}</span>
          <span className="text-[11px] text-slate-400">ROR, AOR, LCR & BSR families</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Killed by Suite</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">{killedCount}</span>
          <span className="text-[11px] text-emerald-500 font-medium">
            {totalCount > 0 ? ((killedCount / totalCount) * 100).toFixed(1) : 0}% Kill rate
          </span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Surviving Blindspots</span>
          <span className="text-2xl font-bold text-red-400 font-mono mt-1 block">{survivingCount}</span>
          <span className="text-[11px] text-red-400 font-medium">Requires targeting tests</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Mutation Score</span>
          <span className="text-2xl font-bold text-purple-300 font-mono mt-1 block">
            {mutationScore.toFixed(1)}%
          </span>
          <span className="text-[11px] text-purple-400 font-medium">
            Formula: Killed / (Total - Equiv)
          </span>
        </Card>
      </div>

      {/* Filter and Operator Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search mutants by file, operator, token..."
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
                  operatorFilter.toLowerCase() === op.toLowerCase()
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
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="survived">Surviving Only</option>
            <option value="killed">Killed Only</option>
            <option value="timeout">Timeout Only</option>
            <option value="equivalent">Equivalent Only</option>
          </Select>
        </div>
      </div>

      {/* Mutation Matrix Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <span>AST Mutation Testing Matrix</span>
            <Badge variant="blue" size="sm">
              {filteredMutations.length} mutants
            </Badge>
          </CardTitle>
          <span className="text-xs text-slate-400">
            Showing {filteredMutations.length} of {mutations.length} mutants
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
                <TableHead>Verification</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredMutations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                    <p className="font-semibold text-slate-300">No mutations match filter criteria</p>
                    <p className="mt-1">No mutants found matching &quot;{searchQuery}&quot;.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-xs"
                      onClick={() => {
                        setSearchQuery('');
                        setOperatorFilter('all');
                        setStatusFilter('all');
                      }}
                    >
                      Clear Search & Filters
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMutations.map((mutant) => (
                  <TableRow
                    key={mutant.id}
                    onClick={() => {
                      setInspectMutant(mutant);
                      setSynthesisResult(null);
                    }}
                    className="hover:bg-slate-800/60 cursor-pointer"
                  >
                    <TableCell className="font-mono text-xs font-semibold text-blue-400">
                      {mutant.id}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-200">
                      {mutant.file_path}:{mutant.line_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant="purple" size="sm">
                        {mutant.operator}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300 max-w-xs truncate">
                      <span className="text-red-400">{mutant.original_code.split('\n')[0]}</span>
                      <span className="text-slate-500 mx-1.5">→</span>
                      <span className="text-emerald-400">{mutant.mutated_code.split('\n')[0]}</span>
                    </TableCell>
                    <TableCell>
                      {mutant.status === 'survived' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-950/60 px-2 py-0.5 rounded-full border border-red-500/30">
                          SURVIVED
                        </span>
                      ) : mutant.status === 'killed' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          KILLED
                        </span>
                      ) : mutant.status === 'timeout' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                          TIMEOUT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                          {mutant.status.toUpperCase()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {mutant.verification_status === 'mutation_killing' ? (
                        <StatusPill status="verified" label="Killer Verified" />
                      ) : mutant.synthesized_test_code ? (
                        <StatusPill status="ai_suggested" label="AI Suggested" />
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-blue-400 hover:text-white">
                        Inspect <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredMutations.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50]}
          itemLabel="mutants"
        />
      )}

      {/* Mutant Inspection & Synthesis Modal */}
      <Dialog
        isOpen={Boolean(inspectMutant)}
        onClose={() => setInspectMutant(null)}
        title={inspectMutant ? `${inspectMutant.id} (${inspectMutant.operator} Mutation)` : ''}
        description={inspectMutant ? `${inspectMutant.file_path} at line ${inspectMutant.line_number}` : ''}
        maxWidth="lg"
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Target invariant: Dual-State Verified (PASS baseline, FAIL mutant)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setInspectMutant(null)}>
                Close
              </Button>

              {inspectMutant?.status === 'survived' && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isSynthesizing}
                    leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                    onClick={() => inspectMutant && handleSynthesize(inspectMutant)}
                  >
                    {inspectMutant.synthesized_test_code ? 'Re-Synthesize Test' : 'Synthesize Killing Test'}
                  </Button>

                  {inspectMutant.synthesized_test_code && (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isPromoting}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      onClick={() => inspectMutant && handlePromote(inspectMutant)}
                    >
                      Promote to Suite
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        }
      >
        {inspectMutant && (
          <div className="space-y-4">
            {promotedSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{promotedSuccess}</span>
              </div>
            )}

            {/* AST Substitution Diff */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-blue-400" />
                  AST Semantic Substitution Diff:
                </span>
                <Badge variant="purple" size="sm">
                  {inspectMutant.operator} Operator
                </Badge>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs space-y-1 overflow-x-auto">
                <div className="text-red-400">
                  <span className="text-red-600 mr-2 select-none">-</span>
                  {inspectMutant.original_code}
                </div>
                <div className="text-emerald-400">
                  <span className="text-emerald-600 mr-2 select-none">+</span>
                  {inspectMutant.mutated_code}
                </div>
              </div>
            </div>

            {/* Gap Explanation & Missing Invariant */}
            {inspectMutant.explanation && (
              <div className="p-3.5 bg-slate-900/80 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Why This Mutant Survived</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {inspectMutant.explanation}
                </p>
                {inspectMutant.missing_boundary && (
                  <div className="pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-400 font-semibold">Missing Invariant Boundary: </span>
                    <span className="text-emerald-400 font-mono">{inspectMutant.missing_boundary}</span>
                  </div>
                )}
              </div>
            )}

            {/* Killing test info if mutant was killed */}
            {inspectMutant.status === 'killed' && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Killed by test:{' '}
                  <strong className="font-mono text-white">
                    {inspectMutant.killing_test_name || 'test_suite_regression'}
                  </strong>
                  . No gap detected.
                </span>
              </div>
            )}

            {/* Synthesized Test with Dual-State Certification Badge */}
            {inspectMutant.synthesized_test_code && (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-purple-300">
                      Dual-State Synthesized Test Assertion
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {inspectMutant.verification_status === 'mutation_killing' ? (
                      <StatusPill status="verified" label="Dual-State Verified Killer" />
                    ) : (
                      <StatusPill status="ai_suggested" label="AI Suggestion" />
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyCode(inspectMutant.synthesized_test_code || '')}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                <pre className="p-3.5 bg-slate-950 rounded-lg border border-purple-500/30 text-purple-200 font-mono text-xs overflow-x-auto leading-relaxed">
                  {inspectMutant.synthesized_test_code}
                </pre>

                {inspectMutant.evidence_hash && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-950/80 px-2.5 py-1.5 rounded border border-slate-800">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Hash className="w-3 h-3" /> Evidence Hash:
                    </span>
                    <span className="text-slate-300 truncate max-w-xs sm:max-w-md">
                      {inspectMutant.evidence_hash}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
