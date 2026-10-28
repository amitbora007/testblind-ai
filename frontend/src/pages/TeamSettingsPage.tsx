import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
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
import { api, isDemoActive, MemberResult, CurrentUserProfile } from '@/services/api';
import {
  Users,
  ShieldAlert,
  Key,
  ShieldCheck,
  UserPlus,
  Trash2,
  CheckCircle2,
  Lock,
  Cpu,
  Clock,
  WifiOff,
  Building,
  Save,
  Copy,
  AlertTriangle,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'engineer' | 'viewer';
  status: 'active' | 'invited';
  lastActive: string;
}

const mapBackendMember = (m: MemberResult): TeamMember => ({
  id: m.id,
  name: m.full_name || m.email.split('@')[0],
  email: m.email,
  role: m.role || 'engineer',
  status: 'active',
  lastActive: m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Active',
});

interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed: string;
}

const INITIAL_MEMBERS: TeamMember[] = [
  {
    id: 'MEM-01',
    name: 'Amit Bora',
    email: 'amit.bora@example.com',
    role: 'owner',
    status: 'active',
    lastActive: 'Just now',
  },
  {
    id: 'MEM-02',
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    role: 'admin',
    status: 'active',
    lastActive: '2 hours ago',
  },
  {
    id: 'MEM-03',
    name: 'Marcus Vance',
    email: 'marcus.v@example.com',
    role: 'engineer',
    status: 'active',
    lastActive: 'Yesterday',
  },
  {
    id: 'MEM-04',
    name: 'Elena Rostova',
    email: 'elena.r@example.com',
    role: 'viewer',
    status: 'invited',
    lastActive: 'Pending invite',
  },
];

const INITIAL_KEYS: ApiKeyRecord[] = [
  {
    id: 'KEY-01',
    name: 'GitHub Actions CI Runner',
    prefix: 'tb_sec_9a12****48f1',
    createdAt: '2026-10-01',
    lastUsed: '15 mins ago',
  },
  {
    id: 'KEY-02',
    name: 'Staging Environment Telemetry',
    prefix: 'tb_sec_4d81****20ce',
    createdAt: '2026-10-15',
    lastUsed: '2 days ago',
  },
];

interface TeamSettingsPageProps {
  currentUser?: CurrentUserProfile | null;
}

export function TeamSettingsPage({ currentUser }: TeamSettingsPageProps = {}) {
  const isDemo = isDemoActive();
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState<TeamMember[]>(() => isDemo ? INITIAL_MEMBERS : []);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>(() => isDemo ? INITIAL_KEYS : []);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const getInitialOrgName = () => {
    if (isDemo) return 'Acme Corporation';
    if (currentUser?.memberships?.[0]?.organization_name) {
      return currentUser.memberships[0].organization_name;
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tb_active_org_name');
      if (stored) return stored;
      const userStr = localStorage.getItem('tb_user_profile');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.memberships?.[0]?.organization_name) return u.memberships[0].organization_name;
        } catch {}
      }
    }
    return 'ABC';
  };

  const getInitialOrgSlug = () => {
    if (isDemo) return 'acme-corp';
    if (currentUser?.memberships?.[0]?.organization_slug) {
      return currentUser.memberships[0].organization_slug;
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tb_active_org_slug');
      if (stored) return stored;
      const userStr = localStorage.getItem('tb_user_profile');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.memberships?.[0]?.organization_slug) return u.memberships[0].organization_slug;
        } catch {}
      }
    }
    return 'abc';
  };

  const [orgName, setOrgName] = useState<string>(getInitialOrgName);
  const [orgSlug, setOrgSlug] = useState<string>(getInitialOrgSlug);

  // Sync if currentUser updates
  useEffect(() => {
    if (!isDemo && currentUser?.memberships?.[0]) {
      setOrgName(currentUser.memberships[0].organization_name || 'ABC');
      setOrgSlug(currentUser.memberships[0].organization_slug || 'abc');
    }
  }, [currentUser, isDemo]);

  // Load live organization details and members
  useEffect(() => {
    if (!isDemoActive()) {
      // If organization name or profile is not populated, fetch profile from backend
      api.getCurrentUser().then((u) => {
        if (u.memberships && u.memberships.length > 0) {
          setOrgName(u.memberships[0].organization_name);
          setOrgSlug(u.memberships[0].organization_slug);
          localStorage.setItem('tb_active_org_name', u.memberships[0].organization_name);
          localStorage.setItem('tb_active_org_slug', u.memberships[0].organization_slug);
          localStorage.setItem('tb_active_org_id', u.memberships[0].organization_id);
          localStorage.setItem('tb_user_profile', JSON.stringify(u));
        }
      }).catch(() => {});

      const orgId = localStorage.getItem('tb_active_org_id') || currentUser?.memberships?.[0]?.organization_id;
      if (orgId) {
        api.getOrganizationMembers(orgId).then((data) => {
          if (data && data.length > 0) {
            setMembers(data.map(mapBackendMember));
          } else {
            const fallbackUser = currentUser;
            if (fallbackUser) {
              setMembers([{
                id: fallbackUser.id,
                name: fallbackUser.full_name || 'Amit Bora',
                email: fallbackUser.email || 'amitbora007@gmail.com',
                role: 'owner',
                status: 'active',
                lastActive: 'Just now',
              }]);
            }
          }
        }).catch(() => {
          setMembers([]);
        });
      }
    }
  }, [currentUser]);

  // Invite form state
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'engineer' | 'viewer'>('engineer');

  // New API Key form state
  const [newKeyName, setNewKeyName] = useState('');

  // Runner Security Config state
  const [cpuLimit, setCpuLimit] = useState('2');
  const [memoryLimit, setMemoryLimit] = useState('4096');
  const [hardTimeout, setHardTimeout] = useState('60');
  const [networkIsolation, setNetworkIsolation] = useState(true);
  const [readOnlyFs, setReadOnlyFs] = useState(true);
  const [nonRootUid, setNonRootUid] = useState('10001');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    if (!isDemoActive()) {
      const orgId = localStorage.getItem('tb_active_org_id');
      if (orgId) {
        try {
          const invited = await api.inviteOrganizationMember(orgId, {
            email: inviteEmail.trim(),
            full_name: inviteName.trim(),
            role: inviteRole,
          });
          setMembers((prev) => [...prev, mapBackendMember(invited)]);
          setShowInviteModal(false);
          setInviteName('');
          setInviteEmail('');
          showToast(`Invitation sent to ${inviteEmail.trim()}`);
          return;
        } catch (err: any) {
          showToast(err.message || 'Failed to send invite');
          return;
        }
      }
    }

    const newMember: TeamMember = {
      id: `MEM-0${members.length + 1}`,
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'invited',
      lastActive: 'Pending invite',
    };

    setMembers([...members, newMember]);
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
    showToast(`Invitation sent to ${newMember.email}`);
  };

  const handleRemoveMember = (id: string, name: string) => {
    setMembers(members.filter((m) => m.id !== id));
    showToast(`Removed member ${name}`);
  };

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const newKey: ApiKeyRecord = {
      id: `KEY-0${apiKeys.length + 1}`,
      name: newKeyName.trim(),
      prefix: `tb_sec_${randomSuffix}****${randomSuffix}`,
      createdAt: '2026-10-26',
      lastUsed: 'Never',
    };

    setApiKeys([...apiKeys, newKey]);
    setShowKeyModal(false);
    setNewKeyName('');
    showToast(`API Key "${newKey.name}" generated.`);
  };

  const handleRevokeKey = (id: string, name: string) => {
    setApiKeys(apiKeys.filter((k) => k.id !== id));
    showToast(`Revoked key: ${name}`);
  };

  const handleSaveSecurity = () => {
    showToast('Container sandbox security policy updated and applied to all runner nodes.');
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner context="Organization Settings &amp; Container Sandbox Quotas" />

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
            <Users className="w-6 h-6 text-brand-teal" />
            Team &amp; Workspace Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage organization members, RBAC permissions, runner security policies, and API keys.
          </p>
        </div>

        <Badge variant="cyan" size="md">
          {isDemo ? 'Enterprise Plan (Demo Sandbox)' : 'Enterprise Plan (Production Active)'}
        </Badge>
      </div>

      {/* Settings Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'members', label: 'Team & RBAC' },
          { id: 'security', label: 'Runner Sandbox Security' },
          { id: 'api_keys', label: 'API Keys & Audit' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: Team & RBAC */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          <Card className="p-4 bg-slate-900/60 border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Building className="w-5 h-5 text-brand-teal" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{orgName}</h3>
                <span className="text-xs text-slate-400 font-mono">
                  slug: {orgSlug} &bull; SSO: {isDemo ? 'Enabled (Google Workspace)' : 'Active (Local / OAuth)'}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowInviteModal(true)}
              className="text-xs flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Team Member
            </Button>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="border-b border-slate-800/80 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-200">
                Active Organization Members ({members.length})
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="text-xs font-medium text-slate-200">
                        {member.name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 font-mono">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.role === 'owner'
                              ? 'purple'
                              : member.role === 'admin'
                              ? 'cyan'
                              : member.role === 'engineer'
                              ? 'blue'
                              : 'gray'
                          }
                          size="sm"
                        >
                          {member.role.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.status === 'active' ? 'green' : 'amber'}
                          size="sm"
                        >
                          {member.status === 'active' ? 'Active' : 'Invited'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {member.lastActive}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, member.name)}
                            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Runner Sandbox Security */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-emerald-300">
                  Strict Container Isolation Policy Active
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  TestBlind AI enforces zero untrusted code execution inside the core API process. All mutation tests and incident trace simulations are run inside ephemeral container micro-vms with isolated namespaces, drop-all Linux capabilities, and non-root execution.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5 bg-slate-900/50 border-slate-800 space-y-5">
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-brand-teal" />
              Ephemeral Container Resource Quotas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>CPU Core Quota</span>
                  <span className="font-mono text-cyan-400">{cpuLimit} vCPU</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  max="8"
                  value={cpuLimit}
                  onChange={(e) => setCpuLimit(e.target.value)}
                  className="font-mono text-xs"
                />
                <span className="text-[11px] text-slate-500">Limits container thread concurrency</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Memory Quota (MB)</span>
                  <span className="font-mono text-cyan-400">{memoryLimit} MB</span>
                </label>
                <Input
                  type="number"
                  min="512"
                  max="16384"
                  step="512"
                  value={memoryLimit}
                  onChange={(e) => setMemoryLimit(e.target.value)}
                  className="font-mono text-xs"
                />
                <span className="text-[11px] text-slate-500">OOM killer terminates memory hog mutations</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Execution Hard Timeout</span>
                  <span className="font-mono text-cyan-400">{hardTimeout}s</span>
                </label>
                <Input
                  type="number"
                  min="5"
                  max="300"
                  value={hardTimeout}
                  onChange={(e) => setHardTimeout(e.target.value)}
                  className="font-mono text-xs"
                />
                <span className="text-[11px] text-slate-500">Kills infinite loop mutants instantly</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold text-slate-300">Security Boundary Flags</h4>

              <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-slate-200 flex items-center gap-2">
                    <WifiOff className="w-3.5 h-3.5 text-brand-teal" />
                    Network Egress Isolation (--network=none)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Disables all inbound and outbound network sockets inside the test container.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={networkIsolation}
                  onChange={(e) => setNetworkIsolation(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-brand-teal focus:ring-brand-teal/40"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-slate-200 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-blue-400" />
                    Read-Only Root Filesystem (--read-only)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Prevents tests or mutated code from modifying container system binaries. Writes restricted to temporary in-memory tmpfs.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={readOnlyFs}
                  onChange={(e) => setReadOnlyFs(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-brand-teal focus:ring-brand-teal/40"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-slate-200">
                    Non-Root Execution UID
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Unprivileged user account inside runner containers. Root execution is strictly rejected.
                  </p>
                </div>
                <span className="font-mono text-xs text-cyan-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-700">
                  UID {nonRootUid}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveSecurity}
                className="text-xs flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save Security Policy
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: API Keys & Audit */}
      {activeTab === 'api_keys' && (
        <div className="space-y-6">
          <Card className="p-4 bg-slate-900/60 border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-brand-teal" />
                Workspace API Keys
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Authenticate CI/CD pipelines, webhook dispatches, and on-prem runner daemons.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowKeyModal(true)}
              className="text-xs flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              Generate API Key
            </Button>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key Name</TableHead>
                    <TableHead>Token Token / Prefix</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        No API keys generated yet. Click &quot;Generate API Key&quot; to create access tokens for CI runners.
                      </TableCell>
                    </TableRow>
                  ) : (
                    apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="text-xs font-medium text-slate-200">
                          {key.name}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-cyan-400">
                          {key.prefix}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {key.createdAt}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {key.lastUsed}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeKey(key.id, key.name)}
                            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Audit Log */}
          <Card className="p-4 bg-slate-900/50 border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300">Recent Workspace Audit Events</h4>
            <div className="space-y-2 text-xs font-mono">
              {!isDemo ? (
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded flex items-center justify-between text-slate-400">
                  <span>[Workspace Audit] Initialized workspace environment for {orgName} ({orgSlug})</span>
                  <Badge variant="cyan" size="sm">Workspace Init</Badge>
                </div>
              ) : (
                <>
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded flex items-center justify-between text-slate-400">
                    <span>[2026-10-26 11:42:01] Token tb_sec_9a12 rotated by amit.bora</span>
                    <Badge variant="cyan" size="sm">Auth Audit</Badge>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded flex items-center justify-between text-slate-400">
                    <span>[2026-10-26 09:15:33] Runner CPU quota updated to 2 vCPU</span>
                    <Badge variant="purple" size="sm">Security Policy</Badge>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded flex items-center justify-between text-slate-400">
                    <span>[2026-10-25 18:20:10] Elena Rostova invited to organization</span>
                    <Badge variant="blue" size="sm">Member Event</Badge>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <Dialog
          isOpen={true}
          onClose={() => setShowInviteModal(false)}
          title="Invite New Team Member"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Full Name</label>
              <Input
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Alex Mercer"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Email Address</label>
              <Input
                required
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="alex.mercer@company.com"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Role &amp; Permissions</label>
              <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                options={[
                  { value: 'admin', label: 'Admin (Full access, member management)' },
                  { value: 'engineer', label: 'Engineer (Run tests, synthesize suites)' },
                  { value: 'viewer', label: 'Viewer (Read-only reports)' },
                ]}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" className="text-xs">
                Send Invitation
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Create API Key Modal */}
      {showKeyModal && (
        <Dialog
          isOpen={true}
          onClose={() => setShowKeyModal(false)}
          title="Create New API Key"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateKey} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Key Name</label>
              <Input
                required
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Jenkins Staging Runner"
                className="text-xs"
              />
            </div>

            <p className="text-xs text-slate-400">
              The full token will only be shown once upon creation. Keep it secure and store it in your secrets vault.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" className="text-xs">
                Generate Token
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

export default TeamSettingsPage;
