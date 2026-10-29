import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Dialog } from '@/components/ui/Dialog';
import { DemoModeBanner } from '@/components/common/DemoModeBanner';
import {
  Flame,
  PlusCircle,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  PlayCircle,
  FileCode2,
  Terminal,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ChevronRight,
  RotateCcw,
  Lock,
  Download,
  Copy,
  Check,
  Code2,
  Sparkles,
  Info,
  Clock,
  Hash,
  Database,
  GitPullRequest
} from 'lucide-react';
import { api, isDemoActive, ProjectResult, IncidentResult, IncidentVerifyResult } from '@/services/api';

// Fallback demo records if backend is offline
const DEMO_INCIDENTS: IncidentResult[] = [
  {
    id: 'inc-401-demo',
    project_id: 'demo-proj-001',
    title: 'ZeroDivisionError in invoice prorate calculator on leap year',
    description: 'Customer experienced HTTP 500 when creating mid-cycle subscription change on February 29th.',
    severity: 'P0',
    raw_traceback: `Traceback (most recent call last):
  File "app/api/invoices.py", line 142, in generate_prorated_bill
    amount = prorate_calculator.calculate(days_active=0, billing_cycle_days=0)
  File "src/billing/prorate.py", line 76, in calculate
    daily_rate = total_cost / billing_cycle_days
ZeroDivisionError: float division by zero`,
    expected_behavior: 'Should return 0.00 balance without raising an unhandled exception.',
    actual_behavior: 'Raised uncaught ZeroDivisionError crashing API worker.',
    source_files: ['src/billing/prorate.py'],
    buggy_code: `def calculate(days_active: int, billing_cycle_days: int, total_cost: float = 49.0) -> float:
    daily_rate = total_cost / billing_cycle_days
    return daily_rate * days_active`,
    corrected_code: `def calculate(days_active: int, billing_cycle_days: int, total_cost: float = 49.0) -> float:
    if billing_cycle_days <= 0:
        return 0.0
    daily_rate = total_cost / billing_cycle_days
    return daily_rate * days_active`,
    fault_module: 'src/billing/prorate.py',
    fault_line: 76,
    hypothesis: 'billing_cycle_days evaluates to 0 when user subscribes on the boundary second of trial period, causing an unhandled division by zero.',
    uncertainty_score: 0.12,
    repro_code: `import pytest
from solution import calculate

# REPRODUCES INCIDENT: ZeroDivisionError in invoice prorate calculator
def test_reproduce_calculate_zerodivisionerror():
    # State A (Buggy): Raises ZeroDivisionError
    # State B (Fixed): Returns 0.0 cleanly
    res = calculate(days_active=0, billing_cycle_days=0, total_cost=49.0)
    assert res == 0.0`,
    verification_state: 'verified_fixed',
    fixed_commit_hash: 'a891f2c',
    evidence_hash: '7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d',
    state_a_stdout: 'test_solution.py::test_reproduce_calculate_zerodivisionerror FAILED',
    state_a_stderr: 'ZeroDivisionError: float division by zero\n> daily_rate = total_cost / billing_cycle_days',
    state_b_stdout: 'test_solution.py::test_reproduce_calculate_zerodivisionerror PASSED [100%]\n1 passed in 0.04s',
    state_b_stderr: '',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'inc-402-demo',
    project_id: 'demo-proj-001',
    title: 'Missing refresh token key crashes auth worker on expired session',
    severity: 'P1',
    raw_traceback: `Traceback (most recent call last):
  File "src/auth/session_worker.py", line 114, in refresh_active_tokens
    token_str = session_payload["refresh_token"]
KeyError: 'refresh_token'`,
    source_files: ['src/auth/session_worker.py'],
    buggy_code: `def refresh_active_tokens(session_payload: dict):
    token_str = session_payload["refresh_token"]
    return {"status": "ok", "token": token_str}`,
    fault_module: 'src/auth/session_worker.py',
    fault_line: 114,
    hypothesis: 'Mobile clients using biometric resumption omit refresh_token dictionary key when payload structure was upgraded.',
    uncertainty_score: 0.20,
    repro_code: `import pytest
from solution import refresh_active_tokens

def test_reproduce_refresh_active_tokens_keyerror():
    # Omitting refresh_token triggers KeyError on buggy code
    res = refresh_active_tokens({})
    assert res is not None`,
    verification_state: 'reproduced',
    evidence_hash: '4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
    state_a_stdout: 'test_solution.py::test_reproduce_refresh_active_tokens_keyerror FAILED',
    state_a_stderr: "KeyError: 'refresh_token'",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'inc-403-demo',
    project_id: 'demo-proj-001',
    title: 'IndexError in batch worker on empty webhook event queue',
    severity: 'P2',
    raw_traceback: `Traceback (most recent call last):
  File "src/queue/worker.py", line 52, in pop_next_task
    task = queue_items[0]
IndexError: list index out of range`,
    source_files: ['src/queue/worker.py'],
    hypothesis: 'Worker attempts to peek element 0 without checking if queue_items is non-empty.',
    missing_details: 'Source code for src/queue/worker.py was not provided. Upload snippet to enable test generation.',
    uncertainty_score: 0.88,
    verification_state: 'needs_more_info',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

export function IncidentAnalysisPage() {
  const [projects, setProjects] = useState<ProjectResult[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [incidents, setIncidents] = useState<IncidentResult[]>(() => isDemoActive() ? DEMO_INCIDENTS : []);
  const [selectedIncident, setSelectedIncident] = useState<IncidentResult | null>(() => isDemoActive() ? DEMO_INCIDENTS[0] : null);
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Intake Modal
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formSeverity, setFormSeverity] = useState<'P0' | 'P1' | 'P2'>('P1');
  const [formDescription, setFormDescription] = useState('');
  const [formTraceback, setFormTraceback] = useState('');
  const [formExpected, setFormExpected] = useState('');
  const [formActual, setFormActual] = useState('');
  const [formBuggyCode, setFormBuggyCode] = useState('');
  const [formCorrectedCode, setFormCorrectedCode] = useState('');
  const [formCommit, setFormCommit] = useState('');
  const [formReproSteps, setFormReproSteps] = useState('');

  // Dual State Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<IncidentVerifyResult | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteSuccess, setPromoteSuccess] = useState<string | null>(null);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editableReproCode, setEditableReproCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isExportingPatch, setIsExportingPatch] = useState(false);

  // Initial load
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const fetchedProjects = await api.getProjects();
        if (fetchedProjects && fetchedProjects.length > 0) {
          setProjects(fetchedProjects);
          const firstProj = fetchedProjects[0];
          setSelectedProjectId(firstProj.id);

          const fetchedIncidents = await api.getProjectIncidents(firstProj.id);
          if (fetchedIncidents && fetchedIncidents.length > 0) {
            setIncidents(fetchedIncidents);
            setSelectedIncident(fetchedIncidents[0]);
            setEditableReproCode(fetchedIncidents[0].repro_code || '');
          } else {
            setIncidents(isDemoActive() ? DEMO_INCIDENTS : []);
            setSelectedIncident(isDemoActive() ? DEMO_INCIDENTS[0] : null);
            setEditableReproCode(isDemoActive() ? (DEMO_INCIDENTS[0].repro_code || '') : '');
          }
          setIsLiveBackend(true);
        } else {
          setIsLiveBackend(false);
          setIncidents(isDemoActive() ? DEMO_INCIDENTS : []);
          setSelectedIncident(isDemoActive() ? DEMO_INCIDENTS[0] : null);
          setEditableReproCode(isDemoActive() ? (DEMO_INCIDENTS[0].repro_code || '') : '');
        }
      } catch (err) {
        console.warn('Backend offline; using fallback demo mode', err);
        setIsLiveBackend(false);
        setIncidents(isDemoActive() ? DEMO_INCIDENTS : []);
        setSelectedIncident(isDemoActive() ? DEMO_INCIDENTS[0] : null);
        setEditableReproCode(isDemoActive() ? (DEMO_INCIDENTS[0].repro_code || '') : '');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // When selected incident changes
  const handleSelectIncident = (inc: IncidentResult) => {
    setSelectedIncident(inc);
    setEditableReproCode(inc.repro_code || '');
    setVerifyResult(null);
    setIsEditingCode(false);
  };

  // When project dropdown changes
  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId);
    try {
      const fetched = await api.getProjectIncidents(projectId);
      setIncidents(fetched || []);
      if (fetched && fetched.length > 0) {
        handleSelectIncident(fetched[0]);
      }
    } catch (err) {
      console.warn('Failed to fetch project incidents', err);
    }
  };

  // Intake Incident Submit
  const handleCreateIncident = async () => {
    if (!formTitle.trim() || !formTraceback.trim()) {
      alert('Please provide an incident title and raw traceback / logs.');
      return;
    }

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      severity: formSeverity,
      raw_traceback: formTraceback.trim(),
      expected_behavior: formExpected.trim() || undefined,
      actual_behavior: formActual.trim() || undefined,
      buggy_code: formBuggyCode.trim() || undefined,
      corrected_code: formCorrectedCode.trim() || undefined,
      commit_hash: formCommit.trim() || undefined,
      reproduction_steps: formReproSteps.trim() || undefined,
    };

    if (isLiveBackend && selectedProjectId) {
      try {
        const created = await api.createIncident(selectedProjectId, payload);
        setIncidents([created, ...incidents]);
        handleSelectIncident(created);
        setIsIntakeModalOpen(false);
        resetForm();
      } catch (err: any) {
        alert(`Intake failed: ${err.message || 'Unknown error'}`);
      }
    } else {
      // Demo simulation
      const newInc: IncidentResult = {
        id: `inc-${Date.now().toString().slice(-4)}`,
        project_id: selectedProjectId || 'demo-proj-001',
        title: formTitle,
        description: formDescription,
        severity: formSeverity,
        raw_traceback: formTraceback,
        expected_behavior: formExpected,
        actual_behavior: formActual,
        buggy_code: formBuggyCode,
        corrected_code: formCorrectedCode,
        source_files: ['src/unknown.py'],
        hypothesis: 'Automated hypothesis formulated based on stack frame.',
        repro_code: formBuggyCode
          ? `import pytest\n\ndef test_repro_custom():\n    # Reproduction test\n    pass`
          : undefined,
        verification_state: formBuggyCode ? 'test_generated' : 'needs_more_info',
        missing_details: formBuggyCode ? undefined : 'Source code is required for reproduction test synthesis.',
        uncertainty_score: formBuggyCode ? 0.2 : 0.85,
        created_at: new Date().toISOString(),
      };
      setIncidents([newInc, ...incidents]);
      handleSelectIncident(newInc);
      setIsIntakeModalOpen(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormTraceback('');
    setFormExpected('');
    setFormActual('');
    setFormBuggyCode('');
    setFormCorrectedCode('');
    setFormCommit('');
    setFormReproSteps('');
  };

  // Run Dual-State Verification
  const handleRunDualStateVerification = async () => {
    if (!selectedIncident) return;
    setIsVerifying(true);
    setVerifyResult(null);

    if (isLiveBackend) {
      try {
        const res = await api.verifyIncidentDualState(selectedIncident.id, {
          candidate_test_code: editableReproCode || selectedIncident.repro_code || undefined,
          buggy_code: selectedIncident.buggy_code || undefined,
          corrected_code: selectedIncident.corrected_code || undefined,
        });
        setVerifyResult(res);
        const updated = {
          ...selectedIncident,
          verification_state: res.verification_state,
          evidence_hash: res.evidence_hash,
          state_a_stdout: res.state_a_stdout,
          state_a_stderr: res.state_a_stderr,
          state_b_stdout: res.state_b_stdout,
          state_b_stderr: res.state_b_stderr,
        };
        setSelectedIncident(updated);
        setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } catch (err: any) {
        alert(`Verification failed: ${err.message || 'Execution error'}`);
      } finally {
        setIsVerifying(false);
      }
    } else {
      // Demo simulation
      setTimeout(() => {
        setIsVerifying(false);
        const simResult: IncidentVerifyResult = {
          incident_id: selectedIncident.id,
          verification_state: selectedIncident.corrected_code ? 'verified_fixed' : 'reproduced',
          state_a_result: 'FAILED (Exit code 1) — Defect reproduced [State A RED]',
          state_b_result: selectedIncident.corrected_code
            ? 'PASSED (Exit code 0) — Fix verified [State B GREEN]'
            : 'PENDING — No corrected code supplied',
          reproduction_proven: true,
          fix_proven: Boolean(selectedIncident.corrected_code),
          evidence_hash: 'd89f2a41b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2',
          duration_ms: 182,
          state_a_stdout: 'test_solution.py::test_reproduce FAILED',
          state_a_stderr: 'ZeroDivisionError: float division by zero',
          state_b_stdout: selectedIncident.corrected_code ? 'test_solution.py::test_reproduce PASSED [100%]' : '',
          state_b_stderr: '',
          details: 'Dual-state verification confirmed in container runner.',
        };
        setVerifyResult(simResult);
        const updated = {
          ...selectedIncident,
          verification_state: simResult.verification_state,
          evidence_hash: simResult.evidence_hash,
          state_a_stdout: simResult.state_a_stdout,
          state_a_stderr: simResult.state_a_stderr,
          state_b_stdout: simResult.state_b_stdout,
          state_b_stderr: simResult.state_b_stderr,
        };
        setSelectedIncident(updated);
        setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      }, 1000);
    }
  };

  // Save Code Edits
  const handleSaveCodeEdits = async () => {
    if (!selectedIncident) return;
    if (isLiveBackend) {
      try {
        const updated = await api.updateIncident(selectedIncident.id, {
          repro_code: editableReproCode,
        });
        setSelectedIncident(updated);
        setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        setIsEditingCode(false);
      } catch (err: any) {
        alert(`Failed to save edits: ${err.message}`);
      }
    } else {
      setSelectedIncident({ ...selectedIncident, repro_code: editableReproCode });
      setIsEditingCode(false);
    }
  };

  // Promote to Shared Test Library
  const handlePromoteToSuite = async () => {
    if (!selectedIncident) return;
    setIsPromoting(true);
    if (isLiveBackend) {
      try {
        const res = await api.promoteIncidentTest(selectedIncident.id, {
          name: `test_regression_${selectedIncident.id.replace(/-/g, '_')}`,
          test_code: editableReproCode || selectedIncident.repro_code || undefined,
        });
        setPromoteSuccess(res.message);
        setTimeout(() => setPromoteSuccess(null), 3500);
      } catch (err: any) {
        alert(`Promotion failed: ${err.message}`);
      } finally {
        setIsPromoting(false);
      }
    } else {
      setTimeout(() => {
        setIsPromoting(false);
        setPromoteSuccess('Test promoted to shared regression test library!');
        setTimeout(() => setPromoteSuccess(null), 3000);
      }, 600);
    }
  };

  // Export Test File Download
  const handleExportTest = async () => {
    if (!selectedIncident) return;
    const testContent = editableReproCode || selectedIncident.repro_code || '# No test code available.';
    const blob = new Blob([testContent], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_repro_${selectedIncident.id.slice(0, 8)}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Unified Git Patch
  const handleExportPatch = async () => {
    if (!selectedIncident) return;
    setIsExportingPatch(true);
    try {
      const res = await api.exportIncidentPatch(selectedIncident.id);
      const blob = new Blob([res.patch_content], { type: 'text/x-diff' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.patch_filename || `test_repro_${selectedIncident.id.slice(0, 8)}.patch`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPromoteSuccess(`Unified Git patch downloaded: ${res.patch_filename}`);
    } catch {
      // Fallback client-side patch diff generation
      const filename = `test_repro_${selectedIncident.id.slice(0, 8)}.patch`;
      const testCode = editableReproCode || selectedIncident.repro_code || '# No test code available.';
      const fallbackDiff = `--- /dev/null\n+++ b/tests/test_incident_${selectedIncident.id.slice(0, 8)}.py\n@@ -0,0 +1,${testCode.split('\n').length} @@\n${testCode.split('\n').map(l => '+' + l).join('\n')}\n`;
      const blob = new Blob([fallbackDiff], { type: 'text/x-diff' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPromoteSuccess(`Unified Git patch downloaded: ${filename}`);
    } finally {
      setIsExportingPatch(false);
    }
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Render State Badge
  const renderVerificationPill = (state: string) => {
    switch (state) {
      case 'verified_fixed':
        return <StatusPill status="verified" label="Fix Verified [PASS]" />;
      case 'reproduced':
        return <StatusPill status="failed" label="Reproduction Verified [RED]" />;
      case 'test_generated':
        return <StatusPill status="ai_suggested" label="Test Generated" />;
      case 'needs_more_info':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Needs More Information</span>
          </span>
        );
      case 'failed_to_reproduce':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/60 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Failed to Reproduce</span>
          </span>
        );
      case 'analyzing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-500/30">
            <RotateCcw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            <span>Analyzing</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <span>Submitted</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {!isLiveBackend ? (
        <DemoModeBanner message="DEMO MODE — Operating in simulation mode. Connect to live backend to trigger isolated container execution." />
      ) : (
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">Live Sandbox Runner & PII Redactor Connected</span>
            <span className="text-slate-400">• Dual-State Verification Engine active</span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">
            {incidents.length} incidents tracked
          </span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Flame className="w-5 h-5 text-red-400" />
            Incident-to-Regression Test Generation
          </h2>
          <p className="text-xs text-slate-400">
            Ingest production stack traces, scrub sensitive secrets/PII, synthesize targeted reproduction tests, and verify dual-state proofs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
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

          <Button
            variant="primary"
            size="sm"
            leftIcon={<PlusCircle className="w-4 h-4" />}
            onClick={() => setIsIntakeModalOpen(true)}
          >
            Intake Incident
          </Button>
        </div>
      </div>

      {/* Split View: Left List / Right Dual-State Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: INCIDENT LIST (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tracked Incidents ({incidents.length})
            </h3>
            <span className="text-[11px] text-slate-500">Auto-Sanitized</span>
          </div>

          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {incidents.length === 0 ? (
              <Card className="p-6 text-center text-xs text-slate-400">
                No incidents reported yet. Click "Intake Incident" to ingest a production stack trace.
              </Card>
            ) : (
              incidents.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;

                return (
                  <Card
                    key={inc.id}
                    onClick={() => handleSelectIncident(inc)}
                    className={`p-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-card-elevated border-blue-500/60 shadow-glow-primary/20'
                        : 'hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-400">
                        {inc.id.slice(0, 10)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            inc.severity === 'P0'
                              ? 'danger'
                              : inc.severity === 'P1'
                              ? 'warning'
                              : 'default'
                          }
                          size="sm"
                        >
                          {inc.severity}
                        </Badge>
                      </div>
                    </div>

                    <h4 className="text-xs font-semibold text-white mt-1.5 line-clamp-2">
                      {inc.title}
                    </h4>

                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono truncate max-w-[150px]">
                        {inc.fault_module || 'src/unknown'}:{inc.fault_line || 1}
                      </span>
                      <div>{renderVerificationPill(inc.verification_state)}</div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL & DUAL-STATE VERIFICATION (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedIncident && (
            <Card className="p-5 space-y-5">
              {/* Header info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-400">
                      {selectedIncident.id}
                    </span>
                    <Badge variant={selectedIncident.severity === 'P0' ? 'danger' : 'warning'}>
                      Severity {selectedIncident.severity}
                    </Badge>
                    {renderVerificationPill(selectedIncident.verification_state)}
                    {selectedIncident.uncertainty_score !== null && (
                      <Badge variant="purple" size="sm">
                        Uncertainty: {Math.round((selectedIncident.uncertainty_score || 0) * 100)}%
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white mt-1.5">{selectedIncident.title}</h3>
                  {selectedIncident.description && (
                    <p className="text-xs text-slate-300 mt-1">{selectedIncident.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                    onClick={handleExportTest}
                  >
                    Export .py
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<GitPullRequest className="w-3.5 h-3.5" />}
                    onClick={handleExportPatch}
                    disabled={isExportingPatch}
                  >
                    {isExportingPatch ? 'Exporting...' : 'Export .patch'}
                  </Button>
                </div>
              </div>

              {promoteSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{promoteSuccess}</span>
                </div>
              )}

              {/* Missing Details Alert Banner (when needs_more_info) */}
              {selectedIncident.verification_state === 'needs_more_info' && (
                <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-500/40 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Missing Reproduction Context — Human Input Required</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedIncident.missing_details ||
                      'Source code or reproduction parameters are missing. Provide the buggy module code snippet to generate an executable regression test.'}
                  </p>
                  <p className="text-[11px] text-amber-400/80 font-mono">
                    Policy Notice: TestBlind AI refuses to fabricate ungrounded test suites when source context is missing.
                  </p>
                </div>
              )}

              {/* Parsed Traceback */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-red-400" />
                    Sanitized Stack Traceback & Logs:
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    ✓ PII & Secrets Scrubbed
                  </span>
                </div>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-red-300 overflow-x-auto leading-relaxed">
                  {selectedIncident.raw_traceback}
                </pre>
              </div>

              {/* Root Cause Hypothesis Card */}
              {selectedIncident.hypothesis && (
                <div className="p-3.5 rounded-lg bg-purple-950/30 border border-purple-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      AI Root Cause & Invariant Hypothesis:
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Target: {selectedIncident.fault_module}:{selectedIncident.fault_line}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedIncident.hypothesis}
                  </p>
                  {selectedIncident.assumptions && (
                    <div className="pt-2 text-[11px] text-slate-400 border-t border-purple-900/40">
                      <span className="text-slate-300 font-semibold">Assumptions: </span>
                      {selectedIncident.assumptions}
                    </div>
                  )}
                </div>
              )}

              {/* Buggy vs Corrected Code Snippets */}
              {(selectedIncident.buggy_code || selectedIncident.corrected_code) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {selectedIncident.buggy_code && (
                    <div className="space-y-1">
                      <span className="text-slate-300 font-semibold text-[11px] flex items-center gap-1">
                        <Code2 className="w-3.5 h-3.5 text-red-400" /> Buggy Code Version
                      </span>
                      <pre className="p-2.5 rounded bg-slate-950 border border-red-500/30 font-mono text-[11px] text-red-200 overflow-x-auto">
                        {selectedIncident.buggy_code}
                      </pre>
                    </div>
                  )}

                  {selectedIncident.corrected_code && (
                    <div className="space-y-1">
                      <span className="text-slate-300 font-semibold text-[11px] flex items-center gap-1">
                        <Code2 className="w-3.5 h-3.5 text-emerald-400" /> Corrected Code Version
                      </span>
                      <pre className="p-2.5 rounded bg-slate-950 border border-emerald-500/30 font-mono text-[11px] text-emerald-200 overflow-x-auto">
                        {selectedIncident.corrected_code}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* AI Generated Reproduction Test */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-blue-400" />
                    Targeted Reproduction Test (pytest):
                  </span>
                  <div className="flex items-center gap-2">
                    {isEditingCode ? (
                      <Button variant="secondary" size="sm" onClick={handleSaveCodeEdits}>
                        Save Code
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-slate-400 hover:text-white"
                        onClick={() => setIsEditingCode(true)}
                      >
                        Edit Test
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-slate-400 hover:text-white"
                      onClick={() => handleCopyCode(editableReproCode || selectedIncident.repro_code || '')}
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {isEditingCode ? (
                  <textarea
                    value={editableReproCode}
                    onChange={(e) => setEditableReproCode(e.target.value)}
                    className="w-full h-44 bg-slate-950 border border-blue-500/50 rounded-lg p-3 text-xs text-blue-200 font-mono focus:outline-none resize-none leading-relaxed"
                  />
                ) : (
                  <pre className="p-3.5 rounded-lg bg-slate-950 border border-blue-500/30 font-mono text-xs text-blue-200 overflow-x-auto leading-relaxed">
                    {editableReproCode || selectedIncident.repro_code || '# No reproduction test generated yet.'}
                  </pre>
                )}
              </div>

              {/* DUAL-STATE VERIFICATION RUNNER */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Dual-State Sandbox Verification Pipeline
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Gate 1: Must FAIL on buggy code | Gate 2: Must PASS on corrected code
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isVerifying}
                    disabled={!selectedIncident.buggy_code}
                    onClick={handleRunDualStateVerification}
                    leftIcon={<PlayCircle className="w-3.5 h-3.5" />}
                  >
                    Run Dual Verification
                  </Button>
                </div>

                {/* Side-by-side states */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  {/* State A: Buggy Code */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-red-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-300">State A: Buggy Codebase</span>
                      <XCircle className="w-4 h-4 text-red-400" />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Requirement: Test MUST FAIL replicating incident traceback.
                    </p>
                    <div className="font-mono text-[10px] text-red-400 bg-slate-950 p-2 rounded overflow-x-auto">
                      {selectedIncident.state_a_stdout || selectedIncident.state_a_stderr ? (
                        <>
                          {selectedIncident.state_a_stdout && <div>{selectedIncident.state_a_stdout}</div>}
                          {selectedIncident.state_a_stderr && <div className="text-red-300">{selectedIncident.state_a_stderr}</div>}
                        </>
                      ) : (
                        <span className="text-slate-500">Awaiting State A execution</span>
                      )}
                    </div>
                  </div>

                  {/* State B: Corrected Code */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-emerald-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-300">State B: Fixed Codebase</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Requirement: Test MUST PASS cleanly with exit code 0.
                    </p>
                    <div className="font-mono text-[10px] text-emerald-400 bg-slate-950 p-2 rounded overflow-x-auto">
                      {selectedIncident.state_b_stdout ? (
                        <div>{selectedIncident.state_b_stdout}</div>
                      ) : selectedIncident.corrected_code ? (
                        <span className="text-slate-500">Awaiting State B execution</span>
                      ) : (
                        <span className="text-slate-500">No corrected code provided</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Evidence Hash and Promotion Bar */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] truncate max-w-sm">
                    <Hash className="w-3.5 h-3.5 text-slate-500" />
                    <span>Evidence Hash: </span>
                    <span className="text-slate-300">
                      {selectedIncident.evidence_hash || 'Unverified'}
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={isPromoting}
                    disabled={selectedIncident.verification_state !== 'verified_fixed' && selectedIncident.verification_state !== 'reproduced'}
                    onClick={handlePromoteToSuite}
                    leftIcon={<Lock className="w-3.5 h-3.5" />}
                  >
                    Lock & Promote to Shared Library
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {!selectedIncident && (
            <Card className="p-12 text-center text-slate-400 space-y-4 bg-slate-900/40 border-dashed border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-400 mx-auto flex items-center justify-center">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">No Incident Selected</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Select an incident from the queue on the left, or click "Intake Incident" to submit a production stack trace and generate reproduction tests.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                  onClick={() => setIsIntakeModalOpen(true)}
                >
                  Intake Incident
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Intake Incident Modal */}
      <Dialog
        isOpen={isIntakeModalOpen}
        onClose={() => setIsIntakeModalOpen(false)}
        title="Intake Production Incident Report"
        description="Paste stack traces, exception logs, and failure details. Credentials and PII are automatically scrubbed."
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={() => setIsIntakeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateIncident}>
              Parse & Synthesize Repro
            </Button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Input
            label="Incident Title *"
            placeholder="e.g. ZeroDivisionError in invoice prorate calculator on leap year"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Severity *"
              value={formSeverity}
              onChange={(e) => setFormSeverity(e.target.value as any)}
            >
              <option value="P0">P0 — Outage / High Priority</option>
              <option value="P1">P1 — Critical Customer Defect</option>
              <option value="P2">P2 — Non-blocking Bug</option>
            </Select>

            <Input
              label="Associated Commit / Branch"
              placeholder="e.g. main or a891f2c"
              value={formCommit}
              onChange={(e) => setFormCommit(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Raw Stacktrace & Error Logs *
            </label>
            <textarea
              value={formTraceback}
              onChange={(e) => setFormTraceback(e.target.value)}
              className="w-full h-28 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none resize-none leading-relaxed"
              placeholder="Paste traceback from Sentry, Datadog, CloudWatch, or terminal logs..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Buggy Source Code (Optional)
              </label>
              <textarea
                value={formBuggyCode}
                onChange={(e) => setFormBuggyCode(e.target.value)}
                className="w-full h-24 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none resize-none leading-relaxed"
                placeholder="def calculate(days, total):\n    return total / days"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Corrected Source Code (Optional)
              </label>
              <textarea
                value={formCorrectedCode}
                onChange={(e) => setFormCorrectedCode(e.target.value)}
                className="w-full h-24 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none resize-none leading-relaxed"
                placeholder="if days <= 0: return 0.0\nreturn total / days"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Expected Behavior"
              placeholder="Should return 0.00 balance"
              value={formExpected}
              onChange={(e) => setFormExpected(e.target.value)}
            />

            <Input
              label="Actual Behavior"
              placeholder="Raised ZeroDivisionError"
              value={formActual}
              onChange={(e) => setFormActual(e.target.value)}
            />
          </div>

          <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Sensitive data protection: AWS keys, GitHub tokens, Bearer tokens, passwords, and emails are scrubbed before storage.
            </span>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
