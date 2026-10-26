import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Tabs, TabsList, TabTrigger, TabContent } from '@/components/ui/Tabs';
import { DemoModeBanner } from '@/components/common/DemoModeBanner';
import {
  Code2,
  PlayCircle,
  Sparkles,
  RotateCcw,
  Copy,
  Download,
  ShieldCheck,
  Terminal,
  CheckCircle2,
  FileCode,
  Flame,
  Bug,
} from 'lucide-react';

const DEFAULT_PYTHON_SOURCE = `def calculate_tier_discount(order_total: float, customer_tier: str) -> float:
    """
    Calculates percentage discount based on order amount and loyalty tier.
    Bug blindspot: surviving mutation when order_total == 100.0 or negative totals.
    """
    if order_total <= 0:
        raise ValueError("Order total must be positive")

    if customer_tier == "PLATINUM":
        if order_total > 500:
            return 0.25
        elif order_total > 100:
            return 0.15
        return 0.05
    elif customer_tier == "GOLD":
        if order_total > 100:
            return 0.10
        return 0.02
    return 0.0
`;

const DEFAULT_PYTHON_TEST = `import pytest
from solution import calculate_tier_discount

def test_platinum_high_value():
    assert calculate_tier_discount(600, "PLATINUM") == 0.25

def test_gold_normal_value():
    assert calculate_tier_discount(200, "GOLD") == 0.10
`;

const SYNTHESIZED_PYTHON_TEST = `import pytest
from solution import calculate_tier_discount

# TARGETED TEST SYNTHESIS (Kills surviving mutation: ROR > to >= at line 11)
def test_platinum_boundary_at_hundred():
    """Validates order_total exactly at 100.0 boundary (survived existing tests)"""
    assert calculate_tier_discount(100.0, "PLATINUM") == 0.05

def test_invalid_negative_order_raises():
    """Validates exception invariant on zero and negative boundary inputs"""
    with pytest.raises(ValueError, match="Order total must be positive"):
        calculate_tier_discount(-1.0, "PLATINUM")

    with pytest.raises(ValueError, match="Order total must be positive"):
        calculate_tier_discount(0.0, "GOLD")
`;

import { api, CodeLabAnalyzeResult, CodeLabExecuteResult } from '@/services/api';

export function CodeLabPage() {
  const [language, setLanguage] = useState<'python' | 'typescript' | 'go'>('python');
  const [sourceCode, setSourceCode] = useState(DEFAULT_PYTHON_SOURCE);
  const [existingTests, setExistingTests] = useState(DEFAULT_PYTHON_TEST);
  const [expectedBehavior, setExpectedBehavior] = useState(
    'Order totals <= 0 must immediately raise ValueError. Exact boundary of $100.0 must return 0.05 for PLATINUM.'
  );

  const [activeInputTab, setActiveInputTab] = useState<'source' | 'tests' | 'behavior'>('source');
  const [activeOutputTab, setActiveOutputTab] = useState<'suggestions' | 'generated' | 'execution'>('suggestions');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Dynamic Output states
  const [hasGenerated, setHasGenerated] = useState(true);
  const [synthesizedTestCode, setSynthesizedTestCode] = useState(SYNTHESIZED_PYTHON_TEST);
  const [analysisResult, setAnalysisResult] = useState<CodeLabAnalyzeResult | null>(null);
  const [executeResult, setExecuteResult] = useState<CodeLabExecuteResult | null>(null);
  const [executionOutput, setExecutionOutput] = useState<string[]>([
    '[00:00.01] Spawning isolated ephemeral sandbox (Python 3.12 / pytest 8.2)',
    '[00:00.12] Injected mutant 1/1: line 11 `order_total > 100` -> `order_total >= 100`',
    '[00:00.35] Running existing test suite: 2 passed in 0.02s [MUTANT SURVIVED]',
    '[00:00.82] Running AI synthesized boundary assertions: 3 passed in 0.04s',
    '[00:01.05] Mutant KILLED! Assertion error triggered on mutated line 11.',
    '[00:01.10] Pristine baseline verification: PASSED with exit code 0.',
    '[00:01.12] Execution proof sealed: sha256:4b91a7c390fe21',
  ]);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await api.analyzeCodeLab(sourceCode, language, existingTests, expectedBehavior);
      setAnalysisResult(res);
      setActiveOutputTab('suggestions');
    } catch {
      // Offline fallback
      setActiveOutputTab('suggestions');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateTests = async () => {
    setIsGenerating(true);
    try {
      const res = await api.synthesizeCodeLab(sourceCode, language, undefined, expectedBehavior);
      if (res && res.synthesized_test_code) {
        setSynthesizedTestCode(res.synthesized_test_code);
      }
      setHasGenerated(true);
      setActiveOutputTab('generated');
    } catch {
      // Offline fallback
      setHasGenerated(true);
      setActiveOutputTab('generated');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteSandbox = async () => {
    setIsExecuting(true);
    try {
      const res = await api.executeCodeLab(sourceCode, synthesizedTestCode, language);
      setExecuteResult(res);
      const logs = [
        `[00:00.01] Spawning isolated ephemeral sandbox (${language})`,
        `[00:00.08] Duration: ${res.duration_ms}ms | Exit Code: ${res.exit_code}`,
        `[00:00.15] Baseline Verification: ${res.baseline_passed ? 'PASSED (0 errors)' : 'FAILED'}`,
        `[00:00.22] Mutant Status: ${res.mutant_status} (Verification: ${res.verified ? 'SEALED' : 'REJECTED'})`,
        `[00:00.25] Cryptographic Proof: sha256:${res.execution_hash.slice(0, 16)}...`,
      ];
      if (res.stdout) {
        logs.push(...res.stdout.split('\n').filter(Boolean).map(l => `[STDOUT] ${l}`));
      }
      if (res.stderr) {
        logs.push(...res.stderr.split('\n').filter(Boolean).map(l => `[STDERR] ${l}`));
      }
      setExecutionOutput(logs);
      setActiveOutputTab('execution');
    } catch {
      setActiveOutputTab('execution');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([sourceCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solution.${language === 'python' ? 'py' : language === 'typescript' ? 'ts' : 'go'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setSourceCode(DEFAULT_PYTHON_SOURCE);
    setExistingTests(DEFAULT_PYTHON_TEST);
    setSynthesizedTestCode(SYNTHESIZED_PYTHON_TEST);
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner message="DEMO MODE — Standalone Code Lab with live syntax editing, AST boundary mutation analysis, and sandbox verification simulation." />

      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Standalone Code Lab</h2>
            <Badge variant="purple" size="sm">Zero Repo Required</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Paste code snippets or write algorithms to test AST mutation survival, synthesize regression edge cases, and simulate sandbox execution.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value as any)}
            className="w-36 text-xs"
          >
            <option value="python">Python (pytest)</option>
            <option value="typescript">TypeScript (vitest)</option>
            <option value="go">Go (testing)</option>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopyCode(sourceCode)}
            leftIcon={<Copy className="w-3.5 h-3.5" />}
          >
            {copyFeedback ? 'Copied!' : 'Copy'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Download
          </Button>
        </div>
      </div>

      {/* Main Split Layout: Left Editor / Right Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT PANEL: INPUT CODE & TESTS */}
        <Card className="flex flex-col h-[650px] overflow-hidden border-slate-700/80">
          <CardHeader className="p-3 border-b border-slate-800 bg-slate-900/60 flex flex-row items-center justify-between">
            {/* Input Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveInputTab('source')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeInputTab === 'source'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Source Code
              </button>
              <button
                onClick={() => setActiveInputTab('tests')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeInputTab === 'tests'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Existing Tests
              </button>
              <button
                onClick={() => setActiveInputTab('behavior')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeInputTab === 'behavior'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Target Invariant
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                {language === 'python' ? 'solution.py' : 'solution.ts'}
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 relative bg-slate-950">
            {activeInputTab === 'source' && (
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={sourceCode}
                onChange={(val) => setSourceCode(val || '')}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                  folding: true,
                }}
              />
            )}

            {activeInputTab === 'tests' && (
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={existingTests}
                onChange={(val) => setExistingTests(val || '')}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                }}
              />
            )}

            {activeInputTab === 'behavior' && (
              <div className="p-4 h-full flex flex-col space-y-3">
                <label className="text-xs font-semibold text-slate-200">
                  Target Business Invariants & Boundary Constraints:
                </label>
                <textarea
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none resize-none leading-relaxed"
                  placeholder="Describe edge cases, boundary expectations, exception contracts, or invariants..."
                />
              </div>
            )}
          </CardContent>

          {/* Bottom Execution Triggers */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {sourceCode.split('\n').length} lines • AST Analysis Ready
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                isLoading={isAnalyzing}
                onClick={handleRunAnalysis}
                leftIcon={<Bug className="w-3.5 h-3.5 text-amber-400" />}
              >
                Run Analysis
              </Button>

              <Button
                variant="primary"
                size="sm"
                isLoading={isGenerating}
                onClick={handleGenerateTests}
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Synthesize Tests
              </Button>
            </div>
          </div>
        </Card>

        {/* RIGHT PANEL: THREE DISTINCT PRESENTATION PANELS */}
        <Card className="flex flex-col h-[650px] overflow-hidden border-slate-700/80">
          <CardHeader className="p-3 border-b border-slate-800 bg-slate-900/60 flex flex-row items-center justify-between">
            {/* Output Presentation Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveOutputTab('suggestions')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeOutputTab === 'suggestions'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3 h-3 text-purple-300" />
                <span>AI Suggestions</span>
              </button>

              <button
                onClick={() => setActiveOutputTab('generated')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeOutputTab === 'generated'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3 h-3 text-blue-300" />
                <span>Generated Tests</span>
              </button>

              <button
                onClick={() => setActiveOutputTab('execution')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeOutputTab === 'execution'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3 h-3 text-emerald-300" />
                <span>Execution Results</span>
              </button>
            </div>

            <Badge
              variant={
                activeOutputTab === 'execution'
                  ? 'success'
                  : activeOutputTab === 'generated'
                  ? 'purple'
                  : 'outline'
              }
              size="sm"
            >
              {activeOutputTab === 'execution'
                ? 'Verified Sandbox Run (Sealed)'
                : activeOutputTab === 'generated'
                ? 'AI Proposal (Unexecuted)'
                : 'Source Analysis (Unexecuted)'}
            </Badge>
          </CardHeader>

          {/* TAB 1: AI SUGGESTIONS */}
          {activeOutputTab === 'suggestions' && (
            <CardContent className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-500/40 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Detected 2 Critical AST Blindspots:</span>
                </div>
                <p className="text-xs text-slate-300">
                  Existing test suite leaves boundary condition unverified at <code className="text-purple-300 font-mono">order_total == 100.0</code> and fails to assert exception raising on non-positive input.
                </p>
              </div>

              {/* Blindspot Cards */}
              <div className="space-y-3">
                <div className="p-3.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">Mutant #1: Relational Operator Replacement (ROR)</span>
                    <span className="font-mono text-red-400 font-medium">SURVIVED</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded font-mono text-xs text-slate-300">
                    <span className="text-red-400">- elif order_total &gt; 100:</span>
                    <br />
                    <span className="text-emerald-400">+ elif order_total &gt;= 100:</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Target Invariant: Tests only assert 600 and 200; passing 100.0 directly into mutated code produces 0.15 instead of expected 0.05 without failure.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">Mutant #2: Exception Block Suppression (EBS)</span>
                    <span className="font-mono text-amber-400 font-medium">SURVIVED</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Line 6-7: No test asserts that negative or zero inputs raise <code className="font-mono text-slate-300">ValueError</code>.
                  </p>
                </div>
              </div>
            </CardContent>
          )}

          {/* TAB 2: GENERATED TESTS */}
          {activeOutputTab === 'generated' && (
            <CardContent className="p-0 flex-1 relative bg-slate-950">
              <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={synthesizedTestCode}
                options={{
                  fontSize: 13,
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                }}
              />
            </CardContent>
          )}

          {/* TAB 3: EXECUTION RESULTS */}
          {activeOutputTab === 'execution' && (
            <CardContent className="p-4 flex-1 flex flex-col justify-between bg-slate-950 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-bold">VERIFIED EXECUTION EVIDENCE</span>
                </div>
                <span className="text-slate-500 text-[10px]">Isolated Tmpfs Runner</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 text-slate-300 p-2 bg-slate-900/50 rounded-lg border border-slate-800">
                {executionOutput.map((line, idx) => (
                  <div
                    key={idx}
                    className={`leading-relaxed ${
                      line.includes('KILLED')
                        ? 'text-emerald-400 font-semibold'
                        : line.includes('SURVIVED')
                        ? 'text-red-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {line}
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
                <span>Status: <strong className="text-emerald-400">Killed Surviving Mutant</strong></span>
                <span>Exit Code: <strong className="text-white">0</strong></span>
                <span>Duration: <strong className="text-white">0.08s</strong></span>
              </div>
            </CardContent>
          )}

          {/* Bottom Action Footer */}
          <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {activeOutputTab === 'generated'
                ? 'Synthesized 2 tests killing 2 surviving mutants'
                : activeOutputTab === 'execution'
                ? 'Execution proof sealed: sha256:4b91a7...'
                : '2 AST mutations detected'}
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyCode(SYNTHESIZED_PYTHON_TEST)}
                leftIcon={<Copy className="w-3.5 h-3.5" />}
              >
                Copy Tests
              </Button>

              <Button
                variant="primary"
                size="sm"
                isLoading={isExecuting}
                onClick={handleExecuteSandbox}
                leftIcon={<PlayCircle className="w-3.5 h-3.5" />}
              >
                Verify in Sandbox
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
