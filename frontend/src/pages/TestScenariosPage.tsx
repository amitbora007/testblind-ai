import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Dialog } from '@/components/ui/Dialog';
import { DemoModeBanner } from '@/components/common/DemoModeBanner';
import { isDemoActive } from '@/services/api';
import {
  GitFork,
  PlayCircle,
  PlusCircle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ListOrdered,
  FileText,
  Search,
} from 'lucide-react';

export interface ScenarioItem {
  id: string;
  name: string;
  associatedReq: string;
  stepsCount: number;
  duration: string;
  status: 'passed' | 'failed' | 'verified';
  statusLabel: string;
  aiConfidence: string;
  description: string;
  steps: string[];
}

const MOCK_SCENARIOS: ScenarioItem[] = [
  {
    id: 'SC-1023',
    name: 'User Login & Multi-Factor Auth Flow',
    associatedReq: 'REQ-55',
    stepsCount: 5,
    duration: '1m 20s',
    status: 'passed',
    statusLabel: 'Passed (Green Check)',
    aiConfidence: '98%',
    description: 'Validates credential hash verification, TOTP validation, and session token generation.',
    steps: [
      '1. POST /api/v1/auth/login with valid user credentials',
      '2. Assert HTTP 200 and require_totp=true in payload',
      '3. POST /api/v1/auth/totp/verify with cryptographic pin',
      '4. Assert Set-Cookie SameSite=Lax and JWT structure',
      '5. Verify rate limiter resets on successful authentication',
    ],
  },
  {
    id: 'SC-1022',
    name: 'Checkout Mutation Barrier',
    associatedReq: 'REQ-12',
    stepsCount: 4,
    duration: '45s',
    status: 'verified',
    statusLabel: 'Verified Execution',
    aiConfidence: '96%',
    description: 'Boundary checks for zero item carts, loyalty coupon multipliers, and tax rounding invariants.',
    steps: [
      '1. Initialize cart with 0 items -> Assert checkout disabled',
      '2. Add single boundary item ($100.00) -> Assert 5% tier applied',
      '3. Apply concurrent promotion coupon -> Verify idempotency',
      '4. Charge simulated card -> Verify atomic ledger row',
    ],
  },
  {
    id: 'SC-1021',
    name: 'Incident-401 Repro Suite: Leap Year Invoices',
    associatedReq: 'REQ-89',
    stepsCount: 3,
    duration: '30s',
    status: 'verified',
    statusLabel: 'Verified Execution',
    aiConfidence: '94%',
    description: 'Guarantees zero-division does not reoccur when prorating 0-day boundary billing cycles.',
    steps: [
      '1. Simulate user subscribing on final second of trial',
      '2. Execute prorate_calculator with days_active=0, billing_cycle_days=0',
      '3. Assert amount == $0.00 and no unhandled exception raised',
    ],
  },
  {
    id: 'SC-1020',
    name: 'Session Token Expiry & Biometric Resumption',
    associatedReq: 'REQ-44',
    stepsCount: 4,
    duration: '1m 05s',
    status: 'passed',
    statusLabel: 'Passed (Green Check)',
    aiConfidence: '91%',
    description: 'Asserts token rotation and invalidation of stale refresh tokens across distributed workers.',
    steps: [
      '1. Issue initial session token pair (access + refresh)',
      '2. Fast-forward virtual clock past access token exp',
      '3. POST /api/v1/auth/refresh -> Assert new pair issued',
      '4. Attempt replay with old refresh token -> Assert HTTP 401',
    ],
  },
];

export function TestScenariosPage() {
  const [scenarios, setScenarios] = useState<ScenarioItem[]>(() => isDemoActive() ? MOCK_SCENARIOS : []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioItem | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);

  // New scenario form
  const [newName, setNewName] = useState('');
  const [newReq, setNewReq] = useState('REQ-');

  const filteredScenarios = scenarios.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.associatedReq.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRunScenario = (id: string) => {
    setRunningScenarioId(id);
    setTimeout(() => {
      setRunningScenarioId(null);
    }, 1200);
  };

  const handleCreateScenario = () => {
    if (!newName.trim()) return;

    const newScen: ScenarioItem = {
      id: `SC-${1024 + scenarios.length}`,
      name: newName.trim(),
      associatedReq: newReq.trim() || 'REQ-99',
      stepsCount: 3,
      duration: '45s',
      status: 'verified',
      statusLabel: 'Verified Execution',
      aiConfidence: '95%',
      description: 'End-to-end regression scenario initialized.',
      steps: [
        '1. Initialize isolated container sandbox',
        '2. Mount target test fixtures',
        '3. Assert scenario invariants and exit code 0',
      ],
    };

    setScenarios([newScen, ...scenarios]);
    setIsNewModalOpen(false);
    setNewName('');
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner message="DEMO MODE — Workflow scenarios organizing individual unit and integration tests into verifiable end-to-end regression sequences." />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Test Scenarios</h2>
          <p className="text-xs text-slate-400">
            Composite test sequences linked to functional requirements and verified across isolated sandboxes.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<PlusCircle className="w-4 h-4" />}
          onClick={() => setIsNewModalOpen(true)}
        >
          Create Scenario
        </Button>
      </div>

      {/* Search Input */}
      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
        <Input
          placeholder="Search scenarios by name, ID, or requirement (e.g. REQ-55)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4 text-slate-400" />}
        />
      </div>

      {/* Scenarios Grid */}
      {scenarios.length === 0 ? (
        <Card className="p-12 text-center text-slate-400 space-y-4 bg-slate-900/40 border-dashed border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-blue-950/60 border border-blue-500/30 text-blue-400 mx-auto flex items-center justify-center">
            <GitFork className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">No Test Scenarios Defined</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Configure multi-step user journey regression scenarios to verify end-to-end workflows in isolated sandboxes.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={() => setIsNewModalOpen(true)}
            >
              New Scenario
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredScenarios.map((scen) => (
            <Card key={scen.id} className="flex flex-col justify-between hover:border-slate-600 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-400">{scen.id}</span>
                      <Badge variant="outline" size="sm">
                        {scen.associatedReq}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm text-white mt-1">{scen.name}</CardTitle>
                  </div>

                  <StatusPill status={scen.status} label={scen.statusLabel} />
                </div>

                <p className="text-xs text-slate-400 mt-2">{scen.description}</p>
              </CardHeader>

              <CardContent className="py-2">
                <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <ListOrdered className="w-3.5 h-3.5 text-blue-400" />
                      <span>Workflow Steps ({scen.stepsCount})</span>
                    </span>
                    <span className="font-mono text-[11px] text-purple-300">
                      Confidence: {scen.aiConfidence}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono truncate">
                    {scen.steps[0]}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{scen.duration}</span>
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedScenario(scen)}
                  >
                    Inspect Steps
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={runningScenarioId === scen.id}
                    onClick={() => handleRunScenario(scen.id)}
                    leftIcon={<PlayCircle className="w-3.5 h-3.5" />}
                  >
                    Run Suite
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Scenario Detail Dialog */}
      <Dialog
        isOpen={Boolean(selectedScenario)}
        onClose={() => setSelectedScenario(null)}
        title={selectedScenario ? `${selectedScenario.id}: ${selectedScenario.name}` : ''}
        description={selectedScenario ? `Requirement: ${selectedScenario.associatedReq}` : ''}
        maxWidth="md"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setSelectedScenario(null)}>
            Close
          </Button>
        }
      >
        {selectedScenario && (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">Ordered Execution Steps:</span>
              <div className="space-y-1.5 p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-200">
                {selectedScenario.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* New Scenario Modal */}
      <Dialog
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Create New Test Scenario"
        description="Compose multiple assertions and boundary checks into an executable sequence."
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsNewModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateScenario}>
              Create Scenario
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label="Scenario Name *"
            placeholder="e.g. Distributed Order Payment Settlement"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            label="Associated Requirement Code"
            placeholder="e.g. REQ-99"
            value={newReq}
            onChange={(e) => setNewReq(e.target.value)}
          />
        </div>
      </Dialog>
    </div>
  );
}
