import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabTrigger, TabContent } from '@/components/ui/Tabs';
import { DemoModeBanner } from '@/components/common/DemoModeBanner';
import {
  GitBranch,
  Github,
  UploadCloud,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Terminal,
  RefreshCw,
  FolderTree,
} from 'lucide-react';

export function RepositoriesPage() {
  const [selectedTab, setSelectedTab] = useState('github');

  // GitHub Flow state
  const [selectedRepo, setSelectedRepo] = useState('acme-corp/core-auth-service');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [testCommand, setTestCommand] = useState('pytest --tb=short tests/');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // ZIP Flow state
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractedFiles, setExtractedFiles] = useState<string[]>([]);

  const handleSimulateScan = () => {
    setIsScanning(true);
    setScanResult(null);
    setTimeout(() => {
      setIsScanning(false);
      setScanResult('Repository branch verified. Detected 42 source files, 14 test suites, and 2,410 AST nodes.');
    }, 1200);
  };

  const handleSimulateZipDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setUploadError('Invalid file format. Please upload a standard .zip archive.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setUploadError('File exceeds maximum 100MB limit.');
      return;
    }

    setUploadError(null);
    setUploadedFile({
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    });
    setIsUploading(true);
    setUploadProgress(20);

    setTimeout(() => setUploadProgress(60), 400);
    setTimeout(() => {
      setUploadProgress(100);
      setIsUploading(false);
      setExtractedFiles([
        'src/main.py (Application entry point)',
        'src/auth_service.py (14 functions, 32 branches)',
        'src/token_vault.py (AES encryption helper)',
        'tests/test_auth.py (Existing pytest suite - 8 assertions)',
        'requirements.txt (pytest 8.2, cryptography)',
      ]);
    }, 900);
  };

  return (
    <div className="space-y-6">
      <DemoModeBanner message="DEMO MODE — Dual ingestion pipeline supporting GitHub OAuth App integration and safe client-side ZIP archive inspection." />

      {/* Top Header */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Repository Connection & Ingestion</h2>
        <p className="text-xs text-slate-400">
          Connect your GitHub repositories with automated PR webhooks or upload local project ZIP snapshots.
        </p>
      </div>

      <Tabs defaultValue="github" value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabTrigger value="github" className="flex items-center gap-2">
            <Github className="w-3.5 h-3.5" />
            <span>GitHub Repository</span>
          </TabTrigger>
          <TabTrigger value="zip" className="flex items-center gap-2">
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Local ZIP Upload</span>
          </TabTrigger>
          <TabTrigger value="cli" className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5" />
            <span>On-Prem Local CLI</span>
          </TabTrigger>
        </TabsList>

        {/* 1. GITHUB INTEGRATION TAB */}
        <TabContent value="github" className="mt-4 space-y-4">
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white">
                  <Github className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">GitHub App Connected</h3>
                  <p className="text-xs text-slate-400">Organization: acme-corp (GitHub Enterprise Cloud)</p>
                </div>
              </div>
              <Badge variant="success">Active App</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Select Repository *"
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
              >
                <option value="acme-corp/core-auth-service">acme-corp/core-auth-service</option>
                <option value="acme-corp/payment-ledger">acme-corp/payment-ledger</option>
                <option value="acme-corp/billing-dashboard">acme-corp/billing-dashboard</option>
              </Select>

              <Select
                label="Target Branch *"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="main">main (Default branch)</option>
                <option value="develop">develop (Active integration)</option>
                <option value="release/v2.1">release/v2.1 (Staging)</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Test Execution Command"
                value={testCommand}
                onChange={(e) => setTestCommand(e.target.value)}
                placeholder="e.g. pytest tests/ or npm test"
                helperText="Command executed inside ephemeral container sandbox."
              />

              <Input
                label="Subdirectory Scope (Optional)"
                placeholder="e.g. services/api/"
                defaultValue=""
                helperText="Leave empty to analyze entire repository."
              />
            </div>

            {scanResult && (
              <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{scanResult}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Cloned with read-only short-lived token to ephemeral tmpfs</span>
              </div>

              <Button
                variant="primary"
                size="md"
                isLoading={isScanning}
                onClick={handleSimulateScan}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Verify & Scan AST
              </Button>
            </div>
          </Card>
        </TabContent>

        {/* 2. LOCAL ZIP UPLOAD TAB */}
        <TabContent value="zip" className="mt-4 space-y-4">
          <Card className="p-6 space-y-6">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">Local Codebase Snapshot Upload</h3>
              <p className="text-xs text-slate-400">
                Drag and drop a project ZIP archive. Extracted safely with Zip-Slip path traversal validation.
              </p>
            </div>

            {/* Dropzone */}
            <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl p-8 text-center bg-slate-900/40 transition-colors">
              <input
                type="file"
                accept=".zip"
                onChange={handleSimulateZipDrop}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
                <div className="p-3 rounded-full bg-slate-800 text-blue-400">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Click to browse or drag and drop your project ZIP
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    ZIP archives up to 100MB (Binaries and .git histories are ignored)
                  </p>
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Upload Progress & Extracted Tree */}
            {uploadedFile && (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileArchive className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-white">{uploadedFile.name}</span>
                    <span className="text-slate-500 font-mono">({uploadedFile.size})</span>
                  </div>
                  <span className="text-blue-400 font-mono">{uploadProgress}%</span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>

                {extractedFiles.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs text-slate-300">
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                      <FolderTree className="w-3.5 h-3.5 text-blue-400" />
                      <span>Validated Archive Contents ({extractedFiles.length} files detected):</span>
                    </div>
                    <ul className="space-y-1 font-mono text-[11px] text-slate-300 pl-4 list-disc">
                      {extractedFiles.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Safe extraction target: <code className="font-mono text-slate-300">/tmp/tenant_scratch/</code>
              </span>
              <Button
                variant="primary"
                size="md"
                disabled={!uploadedFile || isUploading}
                onClick={handleSimulateScan}
              >
                Unpack & Begin Mutation Discovery
              </Button>
            </div>
          </Card>
        </TabContent>

        {/* 3. LOCAL CLI TAB */}
        <TabContent value="cli" className="mt-4 space-y-4">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Zero-Upload Local CLI (`testblind-cli`)</h3>
              <p className="text-xs text-slate-400">
                For air-gapped environments or strict confidentiality policies where source code cannot be uploaded.
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
              <p className="text-slate-500"># 1. Install CLI locally</p>
              <p className="text-blue-300">pip install testblind-cli</p>
              <p className="text-slate-500 pt-2"># 2. Run AST mutation testing locally (only anonymized metadata sent to AI)</p>
              <p className="text-emerald-400">testblind scan --local --token=tb_live_9f81a7428e</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">CLI Token Status: Active</span>
              <Button variant="outline" size="sm">
                Generate New CLI Token
              </Button>
            </div>
          </Card>
        </TabContent>
      </Tabs>
    </div>
  );
}
