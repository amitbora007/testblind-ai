import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
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
  AlertTriangle,
  PlayCircle,
  FileCode2,
  Terminal,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';

export interface IncidentRecord {
  id: string;
  title: string;
  severity: 'P0' | 'P1' | 'P2';
  exceptionType: string;
  faultingModule: string;
  faultingLine: number;
  commitHash: string;
  status: 'reproduced' | 'verified_fixed' | 'unverified';
  createdAt: string;
  rawTraceback: string;
  hypothesis: string;
  reproductionTestCode: string;
}

const MOCK_INCIDENTS: IncidentRecord[] = [
  {
    id: 'INC-401',
    title: 'ZeroDivisionError in invoice prorate calculator on leap year',
    severity: 'P0',
    exceptionType: 'ZeroDivisionError: float division by zero',
    faultingModule: 'src/billing/prorate.py',
    faultingLine: 76,
    commitHash: 'a891f2c',
    status: 'verified_fixed',
    createdAt: '2 hours ago',
    rawTraceback: `Traceback (most recent call last):
  File "app/api/invoices.py", line 142, in generate_prorated_bill
    amount = prorate_calculator.calculate(days_active=0, billing_cycle_days=0)
  File "src/billing/prorate.py", line 76, in calculate
    daily_rate = total_cost / billing_cycle_days
ZeroDivisionError: float division by zero`,
    hypothesis: 'billing_cycle_days evaluates to 0 when user subscribes on the boundary second of a trial cancellation period, causing an unhandled division by zero.',
    reproductionTestCode: `def test_repro_zero_billing_cycle_days_does_not_crash():
    # REPRODUCES INC-401: Must safely return zero or raise explicit domain ValidationError
    from src.billing.prorate import calculate
    res = calculate(days_active=0, billing_cycle_days=0, total_cost=49.00)
    assert res == 0.00`,
  },
  {
    id: 'INC-402',
    title: 'Missing refresh token key crashes auth worker on expired session',
    severity: 'P1',
    exceptionType: 'KeyError: "refresh_token"',
    faultingModule: 'src/auth/session_worker.py',
    faultingLine: 114,
    commitHash: 'c7402b1',
    status: 'reproduced',
    createdAt: 'Yesterday',
    rawTraceback: `Traceback (most recent call last):
  File "src/auth/session_worker.py", line 114, in refresh_active_tokens
    token_str = session_payload["refresh_token"]
KeyError: 'refresh_token'`,
    hypothesis: 'Mobile clients using biometric session resumption omit refresh_token dictionary key when payload structure was upgraded in v2.4.',
    reproductionTestCode: `def test_repro_missing_refresh_token_graceful_expiry():
    # REPRODUCES INC-402: Must return HTTP 401 SessionExpired instead of uncaught KeyError
    from src.auth.session_worker import refresh_active_tokens
    status, payload = refresh_active_tokens({"user_id": "usr_99", "device": "ios"})
    assert status == 401
    assert payload["error"] == "session_expired"`,
  },
  {
    id: 'INC-403',
    title: 'Duplicate webhook event charge on concurrent Stripe retry',
    severity: 'P0',
    exceptionType: 'IntegrityError: duplicate key value violates unique constraint',
    faultingModule: 'src/payments/webhook_handler.py',
    faultingLine: 53,
    commitHash: 'e102f9a',
    status: 'unverified',
    createdAt: '3 days ago',
    rawTraceback: `psycopg2.errors.UniqueViolation: duplicate key value violates unique constraint "uq_payment_event_id"
DETAIL: Key (event_id)=(evt_charge_success_99) already exists.`,
    hypothesis: 'Stripe delivers identical webhook events within 15 milliseconds across separate API server workers without distributed Redis locking.',
    reproductionTestCode: `def test_repro_concurrent_duplicate_webhook_charge():
    # REPRODUCES INC-403: Concurrent delivery of identical event_id must be idempotent
    from src.payments.webhook_handler import process_webhook
    res1 = process_webhook(event_id="evt_charge_success_99")
    res2 = process_webhook(event_id="evt_charge_success_99")
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert ledger.count(event_id="evt_charge_success_99") == 1`,
  },
];

export function IncidentAnalysisPage() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>(MOCK_INCIDENTS);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord>(MOCK_INCIDENTS[0]);
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);

  // New incident form
  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState<'P0' | 'P1' | 'P2'>('P1');
  const [newTraceback, setNewTraceback] = useState('');

  // Dual state verification simulation
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState<boolean | null>(true);

  const handleCreateIncident = () => {
    if (!newTitle.trim()) return;

    const newRecord: IncidentRecord = {
      id: `INC-${400 + incidents.length + 1}`,
      title: newTitle.trim(),
      severity: newSeverity,
      exceptionType: 'RuntimeError: unhandled application defect',
      faultingModule: 'src/api/handler.py',
      faultingLine: 34,
      commitHash: 'head',
      status: 'reproduced',
      createdAt: 'Just now',
      rawTraceback: newTraceback || 'Exception traceback parsed from logs.',
      hypothesis: 'AI Hypothesis: Invariant violated on unexpected parameter null state.',
      reproductionTestCode: `def test_repro_${Date.now()}():\n    # Reproduction test\n    pass`,
    };

    setIncidents([newRecord, ...incidents]);
    setSelectedIncident(newRecord);
    setIsIntakeModalOpen(false);
    setNewTitle('');
    setNewTraceback('');
  };

  const handleRunDualStateVerification = () => {
    setIsVerifying(true);
    setVerificationPassed(null);
    setTimeout(() => {
      setIsVerifying(false);
      setVerificationPassed(true);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner message="DEMO MODE — Incident-to-Regression pipeline converting production tracebacks into dual-state verified tests." />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Incident-to-Regression Test Generation</h2>
          <p className="text-xs text-slate-400">
            Ingest production stack traces, formulate invariant hypotheses, and generate dual-state verified tests.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<PlusCircle className="w-4 h-4" />}
          onClick={() => setIsIntakeModalOpen(true)}
        >
          Intake Incident
        </Button>
      </div>

      {/* Split View: Left List / Right Dual-State Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: INCIDENT LIST (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            Tracked Incidents ({incidents.length})
          </h3>

          <div className="space-y-2.5">
            {incidents.map((inc) => {
              const isSelected = selectedIncident.id === inc.id;

              return (
                <Card
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-card-elevated border-blue-500/60 shadow-glow-primary/20'
                      : 'hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-400">{inc.id}</span>
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

                  <h4 className="text-xs font-semibold text-white mt-1.5 line-clamp-2">
                    {inc.title}
                  </h4>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800">
                    <span className="font-mono">{inc.faultingModule}:{inc.faultingLine}</span>
                    <span>{inc.createdAt}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL & DUAL-STATE VERIFICATION (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="p-5 space-y-5">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-blue-400">
                    {selectedIncident.id}
                  </span>
                  <Badge variant={selectedIncident.severity === 'P0' ? 'danger' : 'warning'}>
                    Severity {selectedIncident.severity}
                  </Badge>
                  <StatusPill
                    status={
                      selectedIncident.status === 'verified_fixed'
                        ? 'verified'
                        : selectedIncident.status === 'reproduced'
                        ? 'failed'
                        : 'skipped'
                    }
                    label={
                      selectedIncident.status === 'verified_fixed'
                        ? 'Verified on Fixed Code'
                        : selectedIncident.status === 'reproduced'
                        ? 'Reproduced on Buggy'
                        : 'Pending Reproduction'
                    }
                  />
                </div>
                <h3 className="text-base font-bold text-white mt-1">{selectedIncident.title}</h3>
              </div>

              <span className="font-mono text-xs text-slate-400">
                Commit: <code className="text-slate-200">{selectedIncident.commitHash}</code>
              </span>
            </div>

            {/* Parsed Traceback */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Extracted Call Stack Traceback:</span>
              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-red-300 overflow-x-auto leading-relaxed">
                {selectedIncident.rawTraceback}
              </pre>
            </div>

            {/* Root Cause Hypothesis Card */}
            <div className="p-3.5 rounded-lg bg-purple-950/40 border border-purple-500/40 space-y-1">
              <span className="text-xs font-semibold text-purple-300 block">
                AI Root Cause & Invariant Hypothesis:
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedIncident.hypothesis}
              </p>
            </div>

            {/* AI Generated Reproduction Test */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">
                Synthesized Reproduction Test (pytest):
              </span>
              <pre className="p-3 rounded-lg bg-slate-950 border border-blue-500/30 font-mono text-[11px] text-blue-200 overflow-x-auto leading-relaxed">
                {selectedIncident.reproductionTestCode}
              </pre>
            </div>

            {/* DUAL-STATE VERIFICATION RUNNER */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Dual-State Verification Pipeline</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isVerifying}
                  onClick={handleRunDualStateVerification}
                  leftIcon={<PlayCircle className="w-3.5 h-3.5" />}
                >
                  Run Dual Verification
                </Button>
              </div>

              {/* Side-by-side states */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                {/* State A: Buggy Code */}
                <div className="p-3 rounded-lg bg-slate-900 border border-red-500/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-red-300">State A: Buggy Codebase</span>
                    <XCircle className="w-4 h-4 text-red-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Expectation: Test MUST FAIL replicating incident traceback.
                  </p>
                  <div className="font-mono text-[10px] text-red-400 bg-slate-950 p-1.5 rounded">
                    Outcome: FAILED (Exit Code 1) — Defect Reproduced
                  </div>
                </div>

                {/* State B: Corrected Code */}
                <div className="p-3 rounded-lg bg-slate-900 border border-emerald-500/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-300">State B: Fixed Codebase</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Expectation: Test MUST PASS all assertions cleanly.
                  </p>
                  <div className="font-mono text-[10px] text-emerald-400 bg-slate-950 p-1.5 rounded">
                    Outcome: PASSED (Exit Code 0) — Invariant Verified
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Cryptographic Run Hash: <code className="text-slate-300">sha256:d89f2a41</code></span>
                <Button variant="secondary" size="sm">
                  Lock & Promote to Regression Library
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Intake Incident Modal */}
      <Dialog
        isOpen={isIntakeModalOpen}
        onClose={() => setIsIntakeModalOpen(false)}
        title="Intake Production Incident Report"
        description="Paste stack traces, exception logs, and failure details for automated reproduction synthesis."
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
        <div className="space-y-4">
          <Input
            label="Incident Title *"
            placeholder="e.g. TypeError on user signup with international phone format"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Severity"
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value as any)}
            >
              <option value="P0">P0 — Outage / High Priority</option>
              <option value="P1">P1 — Critical Customer Defect</option>
              <option value="P2">P2 — Non-blocking Bug</option>
            </Select>

            <Input
              label="Associated Commit / Branch"
              placeholder="e.g. main or v2.4.1"
              defaultValue="main"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Raw Stacktrace & Application Logs *
            </label>
            <textarea
              value={newTraceback}
              onChange={(e) => setNewTraceback(e.target.value)}
              className="w-full h-32 bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none resize-none leading-relaxed"
              placeholder="Paste traceback from Sentry, Datadog, CloudWatch, or server logs..."
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
