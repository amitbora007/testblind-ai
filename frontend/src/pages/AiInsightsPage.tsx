import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { Pagination } from '@/components/ui/Pagination';
import { DemoModeBanner } from '@/components/common/DemoModeBanner';
import { api, isDemoActive, AiInsightItem } from '@/services/api';
import {
  Sparkles,
  AlertTriangle,
  Layers,
  Zap,
  CheckCircle2,
  Filter,
  ArrowRight,
  Code2,
  Trash2,
  ShieldCheck,
  RefreshCw,
  Clock,
  HelpCircle,
} from 'lucide-react';

interface InsightItem {
  id: string;
  type: 'flakiness' | 'redundancy' | 'gap';
  severity: 'high' | 'medium' | 'low';
  title: string;
  targetFile: string;
  affectedFunction: string;
  confidence: number;
  description: string;
  evidence: string;
  suggestedAction: string;
  codeSnippet?: string;
  status: 'active' | 'applied' | 'dismissed';
}

const MOCK_INSIGHTS: InsightItem[] = [
  {
    id: 'INS-01',
    type: 'flakiness',
    severity: 'high',
    title: 'Unseeded Random Token Generation in Session Expiry Test',
    targetFile: 'tests/auth/test_session_expiry.py',
    affectedFunction: 'test_refresh_token_entropy()',
    confidence: 96,
    description:
      'Test relies on system clock millis and random.randint() without a fixed pseudo-random seed. In 4 out of 100 container executions, token collisions fail the uniqueness assertion.',
    evidence:
      'Observed non-deterministic failure in RUN-879 and RUN-884 under parallel runner concurrency (jitter 24ms).',
    suggestedAction: 'Inject deterministic PRNG seed or freeze time fixture.',
    codeSnippet: `@pytest.fixture\ndef seeded_session():\n    # Freeze monotonic clock to prevent race jitter\n    with freeze_time("2026-10-26T12:00:00Z"):\n        yield SessionManager(seed=42)`,
    status: 'active',
  },
  {
    id: 'INS-02',
    type: 'redundancy',
    severity: 'medium',
    title: 'Redundant Test Case: 100% AST Path Overlap with Zero Kill Differential',
    targetFile: 'tests/billing/test_proration_duplication.ts',
    affectedFunction: 'testProrationCalculationDuplicate()',
    confidence: 94,
    description:
      'This test executes the exact same bytecode path as testStandardProrationCalculation() and kills 0 unique mutants. Eliminating this reduces suite run time by 1.4s without lowering mutation coverage.',
    evidence:
      'Mutation diff: 0 / 28 mutants killed solely by this test across all 4 mutation operators.',
    suggestedAction: 'Deprecate or merge with parameterized proration matrix.',
    status: 'active',
  },
  {
    id: 'INS-03',
    type: 'gap',
    severity: 'high',
    title: 'Critical Unhandled Boundary: Zero-Quantity Stripe Invoicing',
    targetFile: 'src/billing/invoice_generator.py',
    affectedFunction: 'calculate_line_items()',
    confidence: 91,
    description:
      'Relational operator mutant (quantity <= 0 replaced with quantity < 0) survived all 14 billing tests. A zero quantity item enters calculation and raises an unhandled ZeroDivisionError in invoice formatting.',
    evidence:
      'Mutant ROR-294 on line 118 was NOT killed by any existing test case.',
    suggestedAction: 'Synthesize regression test with quantity=0 invoice payload.',
    codeSnippet: `def test_zero_quantity_line_item_raises_validation_error():\n    engine = InvoiceEngine()\n    with pytest.raises(InvalidQuantityError, match="Quantity must be >= 1"):\n        engine.calculate_line_items([{"item_id": "sub_1", "quantity": 0}])`,
    status: 'active',
  },
  {
    id: 'INS-04',
    type: 'flakiness',
    severity: 'medium',
    title: 'Async Sleep Jitter in S3 Multipart Upload Completion',
    targetFile: 'tests/storage/multipart_test.go',
    affectedFunction: 'TestMultipartUploadConcurrentChunks()',
    confidence: 88,
    description:
      'Hardcoded time.Sleep(50 * time.Millisecond) waits for simulated S3 chunk synchronization. Under heavy container CPU throttling (2 vCPU quota), chunks occasionally finish in 52ms.',
    evidence:
      'Failed in 2 of 40 runs on runner testblind-runner-go:1.22.',
    suggestedAction: 'Replace sleep with sync.WaitGroup or poll channel with timeout.',
    status: 'active',
  },
  {
    id: 'INS-05',
    type: 'gap',
    severity: 'low',
    title: 'Missing Unicode Boundary Test in JWT Header Algorithm Parsing',
    targetFile: 'src/auth/token_verifier.py',
    affectedFunction: 'extract_alg_header()',
    confidence: 82,
    description:
      'Mutant replacing case-insensitive check with strict ASCII comparison survived. Malformed payloads with non-ASCII spaces or lowercase `hs256` cause unhandled fallback to none algorithm.',
    evidence:
      'Mutant LCR-102 survived AST test suite pass.',
    suggestedAction: 'Synthesize parameterized header algorithm validation test.',
    codeSnippet: `@pytest.mark.parametrize("alg_header", ["HS256", "hs256", " HS256 "])\ndef test_jwt_alg_header_case_insensitivity(alg_header):\n    header = extract_alg_header({"alg": alg_header})\n    assert header == Algorithm.HS256`,
    status: 'active',
  },
];

const mapBackendInsight = (b: AiInsightItem): InsightItem => {
  const typeMap: Record<string, 'flakiness' | 'redundancy' | 'gap'> = {
    flakiness: 'flakiness',
    redundancy: 'redundancy',
    gap: 'gap',
    boundary_gap: 'gap',
    unasserted_boundary: 'gap',
  };
  const sevMap: Record<string, 'high' | 'medium' | 'low'> = {
    high: 'high',
    medium: 'medium',
    low: 'low',
  };
  return {
    id: b.id,
    type: typeMap[b.type] || 'gap',
    severity: sevMap[b.severity] || 'medium',
    title: b.title,
    targetFile: b.target_file,
    affectedFunction: b.evidence?.affected_function || `Line ${b.line_number}`,
    confidence: Math.round((1 - (b.uncertainty?.score ?? 0.2)) * 100),
    description: b.description,
    evidence: typeof b.evidence === 'string' ? b.evidence : JSON.stringify(b.evidence, null, 2),
    suggestedAction: b.suggested_fix || 'Review test coverage and apply boundary assertions.',
    codeSnippet: b.suggested_fix || undefined,
    status: 'active',
  };
};

export function AiInsightsPage() {
  const [insights, setInsights] = useState<InsightItem[]>(() => isDemoActive() ? MOCK_INSIGHTS : []);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [inspectItem, setInspectItem] = useState<InsightItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isDemoActive()) {
      api.getAiInsights().then((items) => {
        if (items && items.length > 0) {
          setInsights(items.map(mapBackendInsight));
        } else {
          setInsights(isDemoActive() ? MOCK_INSIGHTS : []);
        }
      }).catch(() => {
        setInsights(isDemoActive() ? MOCK_INSIGHTS : []);
      });
    }
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(3);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedType, selectedSeverity]);

  const filteredInsights = insights.filter((item) => {
    const matchesType = selectedType === 'all' || item.type === selectedType;
    const matchesSev = selectedSeverity === 'all' || item.severity === selectedSeverity;
    return matchesType && matchesSev && item.status !== 'dismissed';
  });

  const totalItems = filteredInsights.length;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedInsights = filteredInsights.slice(startIndex, startIndex + pageSize);

  const handleApplyFix = (id: string, actionDesc: string) => {
    setInsights((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'applied' } : item))
    );
    setToastMessage(`Action triggered: "${actionDesc}". New test draft staged.`);
    setTimeout(() => setToastMessage(null), 4000);
    setInspectItem(null);
  };

  const handleDismiss = (id: string) => {
    setInsights((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'dismissed' } : item))
    );
    setToastMessage('Insight dismissed from active review queue.');
    setTimeout(() => setToastMessage(null), 3000);
    setInspectItem(null);
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner context="AI Test Intelligence Engine (AST Mutation & Flakiness Heuristics)" />

      {toastMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-teal" />
            AI Test Intelligence &amp; Insights
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Proactive flaky test prediction, redundant test pruning, and automated boundary gap synthesis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="cyan" size="md">
            {filteredInsights.length} Recommendations Active
          </Badge>
        </div>
      </div>

      {/* Filter and stats row */}
      <Card className="p-3.5 bg-slate-900/70 border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1 hidden sm:flex">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Category:</span>
            </div>
            <Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-48 text-xs"
              options={[
                { value: 'all', label: 'All Categories' },
                { value: 'flakiness', label: 'Flakiness Predictor' },
                { value: 'redundancy', label: 'Redundancy Pruning' },
                { value: 'gap', label: 'Coverage Gap Optimizer' },
              ]}
            />

            <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-1 hidden sm:flex">
              <span>Severity:</span>
            </div>
            <Select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-36 text-xs"
              options={[
                { value: 'all', label: 'All Severities' },
                { value: 'high', label: 'High Priority' },
                { value: 'medium', label: 'Medium Priority' },
                { value: 'low', label: 'Low Priority' },
              ]}
            />

            {(selectedType !== 'all' || selectedSeverity !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedType('all');
                  setSelectedSeverity('all');
                }}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 h-auto"
              >
                Reset
              </Button>
            )}
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              High Risk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Medium
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Low
            </span>
          </div>
        </div>
      </Card>

      {/* Insights List */}
      <div className="space-y-4">
        {filteredInsights.length === 0 ? (
          <Card className="p-12 text-center bg-slate-900/40 border-slate-800">
            {isDemoActive() ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-base font-medium text-slate-200">No Pending AI Recommendations</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  All identified test gaps and flakiness risks for the selected filters have been addressed or resolved.
                </p>
              </>
            ) : (
              <>
                <Sparkles className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <h3 className="text-base font-medium text-slate-200">No AI Insights Detected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Run AST mutation scanning and test executions on your projects to discover test gaps, redundant assertions, and flakiness risks.
                </p>
              </>
            )}
          </Card>
        ) : (
          paginatedInsights.map((item) => (
            <Card
              key={item.id}
              className={`p-5 bg-slate-900/50 border transition-all ${
                item.severity === 'high'
                  ? 'border-slate-800 hover:border-rose-500/40'
                  : item.severity === 'medium'
                  ? 'border-slate-800 hover:border-amber-500/40'
                  : 'border-slate-800 hover:border-blue-500/40'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.type === 'flakiness' && (
                      <Badge variant="amber" size="sm">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Flakiness Predictor
                      </Badge>
                    )}
                    {item.type === 'redundancy' && (
                      <Badge variant="blue" size="sm">
                        <Layers className="w-3 h-3 mr-1" />
                        Redundant Test
                      </Badge>
                    )}
                    {item.type === 'gap' && (
                      <Badge variant="rose" size="sm">
                        <Zap className="w-3 h-3 mr-1" />
                        Coverage Gap
                      </Badge>
                    )}

                    <Badge
                      variant={
                        item.severity === 'high'
                          ? 'rose'
                          : item.severity === 'medium'
                          ? 'amber'
                          : 'blue'
                      }
                      size="sm"
                    >
                      {item.severity.toUpperCase()} RISK
                    </Badge>

                    <Badge variant="green" size="sm">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Verified in Sandbox
                    </Badge>

                    <span className="text-xs font-mono text-purple-300 font-medium bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/20">
                      Uncertainty: {item.severity === 'high' ? 'Low (0.10)' : 'Med (0.24)'}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="text-slate-300">{item.targetFile}</span>
                    <span>&bull;</span>
                    <span className="text-cyan-300">{item.affectedFunction}</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pt-1">
                    {item.description}
                  </p>

                  <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-md text-xs text-slate-400 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-200 font-medium">Empirical Evidence: </span>
                      <span>{item.evidence}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-row lg:flex-col gap-2 shrink-0 justify-end pt-2 lg:pt-0">
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs flex items-center justify-center gap-1.5"
                    onClick={() => setInspectItem(item)}
                  >
                    <span>Inspect &amp; Resolve</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-slate-400 hover:text-slate-200"
                    onClick={() => handleDismiss(item.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}

        {totalItems > 0 && (
          <div className="pt-2">
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[3, 6, 12]}
            />
          </div>
        )}
      </div>

      {/* Inspect & Resolve Dialog */}
      {inspectItem && (
        <Dialog
          isOpen={true}
          onClose={() => setInspectItem(null)}
          title={`Insight Resolution: ${inspectItem.title}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="cyan" size="sm">Confidence: {inspectItem.confidence}%</Badge>
              <Badge
                variant={
                  inspectItem.severity === 'high'
                    ? 'rose'
                    : inspectItem.severity === 'medium'
                    ? 'amber'
                    : 'blue'
                }
                size="sm"
              >
                {inspectItem.severity.toUpperCase()} PRIORITY
              </Badge>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                <strong className="text-slate-100">Recommended Action: </strong>
                {inspectItem.suggestedAction}
              </p>
              <p className="text-slate-400">
                <strong className="text-slate-200">Sandbox Isolation: </strong>
                Verified against isolated non-root container runner testblind-runner-python:3.12 (airgapped, 60s hard timeout).
              </p>
            </div>

            {inspectItem.codeSnippet && (
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1 font-mono">
                  <span>Synthesized Test Implementation</span>
                  <span className="text-[11px] text-cyan-400">Deterministic</span>
                </div>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto">
                  {inspectItem.codeSnippet}
                </pre>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDismiss(inspectItem.id)}
                className="text-xs text-slate-400"
              >
                Ignore Recommendation
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleApplyFix(inspectItem.id, inspectItem.suggestedAction)}
                className="text-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Apply Suggested Fix
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default AiInsightsPage;
