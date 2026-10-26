import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { DemoModeBanner } from '@/components/common/DemoModeBanner';
import {
  FolderGit2,
  GitBranch,
  Search,
  PlusCircle,
  FileCode2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  branch: string;
  language: string;
  testHarness: string;
  totalTests: number;
  mutationScore: number;
  lastRun: string;
  status: 'active' | 'syncing' | 'idle';
}

const INITIAL_PROJECTS: ProjectRecord[] = [
  {
    id: 'proj_core_api',
    name: 'core-auth-service',
    description: 'Stateless JWT auth service, rate limiting, and RBAC policy enforcement.',
    repoUrl: 'github.com/acme-corp/core-auth-service',
    branch: 'main',
    language: 'Python',
    testHarness: 'pytest 8.2',
    totalTests: 420,
    mutationScore: 84,
    lastRun: '12 mins ago',
    status: 'active',
  },
  {
    id: 'proj_payment_ledger',
    name: 'payment-ledger-engine',
    description: 'Double-entry accounting ledger and idempotent webhook payment processors.',
    repoUrl: 'github.com/acme-corp/payment-ledger',
    branch: 'release/v2.1',
    language: 'Python',
    testHarness: 'pytest 8.2',
    totalTests: 512,
    mutationScore: 91,
    lastRun: '1 hour ago',
    status: 'active',
  },
  {
    id: 'proj_billing_frontend',
    name: 'client-dashboard-spa',
    description: 'React TypeScript enterprise subscription portal and usage metering graphs.',
    repoUrl: 'github.com/acme-corp/billing-dashboard',
    branch: 'main',
    language: 'TypeScript',
    testHarness: 'vitest 1.6',
    totalTests: 238,
    mutationScore: 72,
    lastRun: '4 hours ago',
    status: 'active',
  },
  {
    id: 'proj_telemetry_worker',
    name: 'stream-ingest-worker',
    description: 'High-throughput Kafka / Redis pubsub event streamer and audit writer.',
    repoUrl: 'github.com/acme-corp/stream-ingest',
    branch: 'develop',
    language: 'Go',
    testHarness: 'go test',
    totalTests: 80,
    mutationScore: 66,
    lastRun: 'Yesterday',
    status: 'idle',
  },
];

export interface ProjectsPageProps {
  onSelectProject?: (projId: string) => void;
  onNavigateToUpload?: () => void;
  onNavigateToGapDiscovery?: () => void;
}

export function ProjectsPage({
  onSelectProject,
  onNavigateToUpload,
  onNavigateToGapDiscovery,
}: ProjectsPageProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>(INITIAL_PROJECTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);

  // Form state for creating new project
  const [newProjectName, setNewProjectName] = useState('');
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [newBranch, setNewBranch] = useState('main');
  const [newLanguage, setNewLanguage] = useState('Python');
  const [formError, setFormError] = useState('');

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLang =
      selectedLanguage === 'all' || p.language.toLowerCase() === selectedLanguage.toLowerCase();
    return matchesSearch && matchesLang;
  });

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      setFormError('Project name is required.');
      return;
    }
    const newRecord: ProjectRecord = {
      id: `proj_${Date.now()}`,
      name: newProjectName.trim(),
      description: 'Repository connected with automated AST mutation scanning enabled.',
      repoUrl: newRepoUrl.trim() || `github.com/organization/${newProjectName.trim()}`,
      branch: newBranch.trim() || 'main',
      language: newLanguage,
      testHarness: newLanguage === 'Python' ? 'pytest' : newLanguage === 'TypeScript' ? 'vitest' : 'go test',
      totalTests: 0,
      mutationScore: 0,
      lastRun: 'Just created',
      status: 'active',
    };

    setProjects([newRecord, ...projects]);
    setIsNewProjectDialogOpen(false);
    setNewProjectName('');
    setNewRepoUrl('');
    setFormError('');
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner message="DEMO MODE — Active projects catalog with live simulated AST mutation scores and branch configurations." />

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Active Projects</h2>
          <p className="text-xs text-slate-400">
            Manage tracked codebases, target branches, and mutation testing configurations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {onNavigateToUpload && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<GitBranch className="w-3.5 h-3.5 text-blue-400" />}
              onClick={onNavigateToUpload}
            >
              Connect Repo / ZIP
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
            onClick={() => setIsNewProjectDialogOpen(true)}
          >
            New Project
          </Button>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Total Tracked Projects</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">
            {projects.length}
          </span>
          <span className="text-[11px] text-emerald-400 font-medium">All clusters healthy</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Total Ingested Tests</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">
            {projects.reduce((sum, p) => sum + p.totalTests, 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-blue-400 font-medium">Across 4 runtimes</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Avg Mutation Score</span>
          <span className="text-2xl font-bold text-purple-300 font-mono mt-1 block">78.2%</span>
          <span className="text-[11px] text-purple-400 font-medium">+5.4% this sprint</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Sandboxed Runner Quota</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">100% Isolated</span>
          <span className="text-[11px] text-slate-400 font-medium">Docker / gVisor</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search projects by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full sm:w-44 text-xs"
          >
            <option value="all">All Languages</option>
            <option value="python">Python</option>
            <option value="typescript">TypeScript</option>
            <option value="go">Go</option>
          </Select>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProjects.map((project) => (
          <Card
            key={project.id}
            className="flex flex-col justify-between hover:border-slate-600 transition-all group"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-500/30 text-blue-400 shrink-0">
                    <FolderGit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <GitBranch className="w-3 h-3 text-slate-500" />
                      <span className="font-mono text-slate-300">{project.branch}</span>
                      <span>•</span>
                      <span className="text-slate-500 font-mono text-[11px]">{project.repoUrl}</span>
                    </div>
                  </div>
                </div>

                <Badge
                  variant={project.status === 'active' ? 'success' : 'default'}
                  size="sm"
                >
                  {project.status}
                </Badge>
              </div>

              <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                {project.description}
              </p>
            </CardHeader>

            <CardContent className="py-2">
              <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Language</span>
                  <span className="font-semibold text-slate-200">{project.language}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Test Cases</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {project.totalTests}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Mutation Score</span>
                  <span className="font-mono font-bold text-purple-300">
                    {project.mutationScore}%
                  </span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2 flex items-center justify-between text-xs text-slate-400">
              <span>Last analyzed: {project.lastRun}</span>
              <div className="flex items-center gap-2">
                {onNavigateToGapDiscovery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-400 hover:text-white"
                    onClick={onNavigateToGapDiscovery}
                  >
                    Run Gaps <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <Card className="p-8 text-center text-slate-400 space-y-2">
          <p className="text-sm font-semibold text-slate-200">No matching projects found</p>
          <p className="text-xs text-slate-500">Try adjusting your search query or language filter.</p>
        </Card>
      )}

      {/* New Project Modal Dialog */}
      <Dialog
        isOpen={isNewProjectDialogOpen}
        onClose={() => setIsNewProjectDialogOpen(false)}
        title="Connect New Codebase"
        description="Provide repository metadata or select local archive to initialize mutation matrix."
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsNewProjectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateProject}>
              Initialize Project
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Project Name *"
            placeholder="e.g. order-processing-service"
            value={newProjectName}
            onChange={(e) => {
              setNewProjectName(e.target.value);
              setFormError('');
            }}
            error={formError}
          />

          <Input
            label="Repository URL (GitHub / GitLab)"
            placeholder="github.com/organization/repo-name"
            value={newRepoUrl}
            onChange={(e) => setNewRepoUrl(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Target Branch"
              defaultValue="main"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
            />

            <Select
              label="Primary Language"
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
            >
              <option value="Python">Python (pytest)</option>
              <option value="TypeScript">TypeScript (vitest/jest)</option>
              <option value="Go">Go (testing)</option>
            </Select>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Isolated Execution Sandbox Default</span>
            </div>
            <p>
              New projects default to ephemeral container sandboxing with dropped privileges and no network egress.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
