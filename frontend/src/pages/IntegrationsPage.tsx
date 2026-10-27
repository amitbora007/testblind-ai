import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { DemoModeBanner } from '@/components/common/DemoModeBanner';
import {
  Plug,
  Github,
  GitBranch,
  MessageSquare,
  Ticket,
  Terminal,
  CheckCircle2,
  Copy,
  ExternalLink,
  Settings,
  RefreshCw,
  Shield,
  Key,
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  category: 'vcs' | 'ci_cd' | 'chat' | 'issue_tracker' | 'cli';
  description: string;
  status: 'connected' | 'disconnected';
  lastSync?: string;
  configFields: { label: string; key: string; placeholder: string; value: string }[];
}

const INITIAL_INTEGRATIONS: Integration[] = [
  {
    id: 'github',
    name: 'GitHub Actions & Check Runs',
    category: 'ci_cd',
    description: 'Post PR status checks, inline comments on surviving mutants, and automated regression verification gate.',
    status: 'connected',
    lastSync: '10 mins ago',
    configFields: [
      { label: 'GitHub App Installation ID', key: 'appId', placeholder: '48921045', value: '48921045' },
      { label: 'Target Repositories', key: 'repos', placeholder: 'org/repo1, org/repo2', value: 'acme-corp/core-auth, acme-corp/billing' },
      { label: 'PR Comment Behavior', key: 'behavior', placeholder: 'summary | inline_diff', value: 'inline_diff' },
    ],
  },
  {
    id: 'gitlab',
    name: 'GitLab CI/CD (Planned — Unimplemented)',
    category: 'ci_cd',
    description: 'Block merge requests when mutation score drops below target threshold or flakiness spikes. (Planned post-v1.0).',
    status: 'disconnected',
    configFields: [
      { label: 'GitLab Host URL', key: 'host', placeholder: 'https://gitlab.com or internal domain', value: '' },
      { label: 'Project Access Token', key: 'token', placeholder: 'glpat-...', value: '' },
      { label: 'Pipeline Failure Threshold (%)', key: 'threshold', placeholder: '75', value: '75' },
    ],
  },
  {
    id: 'slack',
    name: 'Slack Alerts',
    category: 'chat',
    description: 'Receive real-time notifications for surviving mutants, flaky test alerts, and container run summaries.',
    status: 'connected',
    lastSync: '25 mins ago',
    configFields: [
      { label: 'Incoming Webhook URL', key: 'webhook', placeholder: 'https://hooks.slack.com/services/...', value: 'https://hooks.slack.com/services/T00/B00/X89' },
      { label: 'Notification Channel', key: 'channel', placeholder: '#qa-testblind-alerts', value: '#test-alerts' },
      { label: 'Notify On', key: 'events', placeholder: 'all | failures_only', value: 'failures_only' },
    ],
  },
  {
    id: 'jira',
    name: 'Jira Software',
    category: 'issue_tracker',
    description: 'Automatically file Jira bug tickets for unhandled incident reproductions and surviving test gaps.',
    status: 'disconnected',
    configFields: [
      { label: 'Jira Cloud Domain', key: 'domain', placeholder: 'your-domain.atlassian.net', value: '' },
      { label: 'Service Account Email', key: 'email', placeholder: 'ci-bot@company.com', value: '' },
      { label: 'API Token', key: 'apiToken', placeholder: 'Jira API Token', value: '' },
      { label: 'Default Project Key', key: 'projectKey', placeholder: 'QA or ENG', value: 'QA' },
    ],
  },
];

export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [activeConfig, setActiveConfig] = useState<Integration | null>(null);
  const [cliToken, setCliToken] = useState<string>('<YOUR_CLI_TOKEN>');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleGenerateToken = () => {
    const randomHex = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const newToken = `tb_runner_${randomHex}`;
    setCliToken(newToken);
    navigator.clipboard.writeText(newToken);
    setToastMessage('New CLI runner token generated and copied to clipboard.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopyCliInstall = () => {
    const cmd = `curl -fsSL https://get.testblind.ai | sh && testblind auth --token ${cliToken}`;
    navigator.clipboard.writeText(cmd);
    setToastMessage('CLI install command copied to clipboard.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggleConnection = (id: string) => {
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStatus = item.status === 'connected' ? 'disconnected' : 'connected';
          return {
            ...item,
            status: newStatus,
            lastSync: newStatus === 'connected' ? 'Just now' : undefined,
          };
        }
        return item;
      })
    );
    setToastMessage('Integration status updated.');
    setTimeout(() => setToastMessage(null), 3000);
    setActiveConfig(null);
  };

  const handleTestConnection = () => {
    setIsTestingConnection(true);
    setTimeout(() => {
      setIsTestingConnection(false);
      setToastMessage('Connection verified successfully! Webhook endpoint responded with HTTP 200 OK.');
      setTimeout(() => setToastMessage(null), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner context="External Tooling &amp; Webhook Integration Fabric" />

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
            <Plug className="w-6 h-6 text-brand-teal" />
            Integrations &amp; CI/CD Fabric
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect version control, issue tracking, Slack alerts, and on-premises testblind-cli runners.
          </p>
        </div>
      </div>

      {/* CLI Runner Card */}
      <Card className="p-4 sm:p-5 bg-slate-900/60 border-slate-800 min-w-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Terminal className="w-5 h-5 text-brand-teal shrink-0" />
              <h3 className="text-sm sm:text-base font-semibold text-slate-100 break-words">
                On-Premises testblind-cli Runner Agent
              </h3>
              <Badge variant="purple" size="sm">Airgapped Ready</Badge>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Run mutation analysis and incident verification directly inside your firewalled VPC or local machine with zero source code leaving your boundary.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateToken}
              className="text-xs flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-brand-teal" />
              {cliToken === '<YOUR_CLI_TOKEN>' ? 'Generate Token' : 'Rotate Token'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCopyCliInstall}
              className="text-xs flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Install Command
            </Button>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs min-w-0 overflow-hidden">
          <span className="text-cyan-400 break-all select-all min-w-0">
            curl -fsSL https://get.testblind.ai | sh &amp;&amp; testblind auth --token {cliToken}
          </span>
          <span className="text-[11px] text-slate-500 shrink-0">SHA-256 Verified Binary</span>
        </div>
      </Card>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        {integrations.map((item) => (
          <Card key={item.id} className="p-4 sm:p-5 bg-slate-900/50 border-slate-800 flex flex-col justify-between min-w-0 overflow-hidden">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center">
                    {item.id === 'github' && <Github className="w-5 h-5 text-slate-100" />}
                    {item.id === 'gitlab' && <GitBranch className="w-5 h-5 text-amber-400" />}
                    {item.id === 'slack' && <MessageSquare className="w-5 h-5 text-emerald-400" />}
                    {item.id === 'jira' && <Ticket className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{item.name}</h3>
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">
                      {item.category.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <Badge
                  variant={item.status === 'connected' ? 'green' : 'gray'}
                  size="sm"
                >
                  {item.status === 'connected' ? 'Connected' : 'Not Connected'}
                </Badge>
              </div>

              <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                {item.description}
              </p>

              {item.lastSync && (
                <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                  <RefreshCw className="w-3 h-3 text-emerald-400" />
                  <span>Last synchronized: {item.lastSync}</span>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveConfig(item)}
                className="text-xs flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                Configure
              </Button>

              <Button
                variant={item.status === 'connected' ? 'outline' : 'primary'}
                size="sm"
                onClick={() => handleToggleConnection(item.id)}
                className="text-xs"
              >
                {item.status === 'connected' ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Integration Configuration Dialog */}
      {activeConfig && (
        <Dialog
          isOpen={true}
          onClose={() => setActiveConfig(null)}
          title={`Configure ${activeConfig.name}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Configure connection credentials and webhook settings for {activeConfig.name}. Sensitive tokens are encrypted at rest with AES-256.
            </p>

            <div className="space-y-3">
              {activeConfig.configFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">{field.label}</label>
                  <Input
                    defaultValue={field.value}
                    placeholder={field.placeholder}
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                {isTestingConnection ? 'Verifying...' : 'Test Connection'}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveConfig(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleToggleConnection(activeConfig.id);
                  }}
                  className="text-xs"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default IntegrationsPage;
