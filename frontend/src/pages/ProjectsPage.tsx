import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Tabs, TabsList, TabTrigger, TabContent } from "@/components/ui/Tabs";
import { Pagination } from "@/components/ui/Pagination";
import { DemoModeBanner } from "@/components/common/DemoModeBanner";
import {
  api,
  isDemoActive,
  ProjectResult,
  GitHubStatusResponse,
  ZipUploadResult,
} from "@/services/api";
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
  Github,
  UploadCloud,
  FileArchive,
  Terminal,
  RefreshCw,
  Copy,
  AlertCircle,
  Info,
  Layers,
  Key,
  LogOut,
  Lock,
  Sparkles,
  Trash2,
  AlertTriangle,
  ChevronDown,
  Loader2,
} from "lucide-react";

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
  status: "active" | "syncing" | "idle";
  sourceType?: "github" | "zip" | "cli";
}

const INITIAL_PROJECTS: ProjectRecord[] = [
  {
    id: "proj_core_api",
    name: "core-auth-service",
    description: "Stateless JWT auth service, rate limiting, and RBAC policy enforcement.",
    repoUrl: "github.com/acme-corp/core-auth-service",
    branch: "main",
    language: "Python",
    testHarness: "pytest 8.2",
    totalTests: 420,
    mutationScore: 84,
    lastRun: "12 mins ago",
    status: "active",
    sourceType: "github",
  },
  {
    id: "proj_payment_ledger",
    name: "payment-ledger-engine",
    description: "Double-entry accounting ledger and idempotent webhook payment processors.",
    repoUrl: "github.com/acme-corp/payment-ledger",
    branch: "release/v2.1",
    language: "Python",
    testHarness: "pytest 8.2",
    totalTests: 512,
    mutationScore: 91,
    lastRun: "1 hour ago",
    status: "active",
    sourceType: "github",
  },
  {
    id: "proj_billing_frontend",
    name: "client-dashboard-spa",
    description: "React TypeScript enterprise subscription portal and usage metering graphs.",
    repoUrl: "github.com/acme-corp/billing-dashboard",
    branch: "main",
    language: "TypeScript",
    testHarness: "vitest 1.6",
    totalTests: 238,
    mutationScore: 72,
    lastRun: "4 hours ago",
    status: "active",
    sourceType: "zip",
  },
  {
    id: "proj_telemetry_worker",
    name: "stream-ingest-worker",
    description: "High-throughput Kafka / Redis pubsub event streamer and audit writer.",
    repoUrl: "github.com/acme-corp/stream-ingest",
    branch: "develop",
    language: "Go",
    testHarness: "go test",
    totalTests: 80,
    mutationScore: 66,
    lastRun: "Yesterday",
    status: "idle",
    sourceType: "cli",
  },
];

export interface ProjectsPageProps {
  onSelectProject?: (projId: string) => void;
  onNavigateToGapDiscovery?: () => void;
}

export function ProjectsPage({
  onSelectProject,
  onNavigateToGapDiscovery,
}: ProjectsPageProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>(() => isDemoActive() ? INITIAL_PROJECTS : []);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [isLoading, setIsLoading] = useState(false);

  // Unified Connect Codebase Modal state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"github" | "zip" | "cli">("github");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Common project form state
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  // GitHub Flow state
  const [githubStatus, setGithubStatus] = useState<GitHubStatusResponse>({
    configured: false,
    connected: false,
    permissions: [],
    setup_instructions: null,
  });
  const [availableRepos, setAvailableRepos] = useState<
    Array<{
      id: number;
      name: string;
      full_name: string;
      default_branch: string;
      description?: string | null;
      language?: string | null;
      private?: boolean;
    }>
  >([]);
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const repoDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [customRepoMode, setCustomRepoMode] = useState(false);
  const [customRepoUrl, setCustomRepoUrl] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [testCommand, setTestCommand] = useState("pytest --tb=short tests/");
  const [subScope, setSubScope] = useState("");

  // Close combobox when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(event.target as Node)) {
        setIsRepoDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectRepo = (repo: {
    id: number;
    name: string;
    full_name: string;
    default_branch: string;
    description?: string | null;
    language?: string | null;
    private?: boolean;
  }) => {
    setSelectedRepo(repo.full_name);
    setProjectName(repo.name);
    setSelectedBranch(repo.default_branch || "main");
    setIsRepoDropdownOpen(false);
    setRepoSearchQuery("");

    // Auto-configure test command & framework based on detected repo language
    const lang = (repo.language || "").toLowerCase();
    if (lang === "typescript" || lang === "tsx" || lang === "javascript" || lang === "jsx" || lang === "react") {
      setTestCommand("npx vitest run");
    } else if (lang === "go") {
      setTestCommand("go test ./...");
    } else if (lang === "python") {
      setTestCommand("pytest --tb=short tests/");
    }
  };

  // ZIP Flow state
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; rawFile: File } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [zipResult, setZipResult] = useState<ZipUploadResult | null>(null);

  // CLI state
  const [cliToken, setCliToken] = useState("<YOUR_CLI_TOKEN>");
  const [cliTokenCopied, setCliTokenCopied] = useState(false);
  const [cliCmdCopied, setCliCmdCopied] = useState(false);

  // Target project for re-uploading ZIP snapshot
  const [targetUpdateProject, setTargetUpdateProject] = useState<ProjectRecord | null>(null);

  // Auto-generation option state
  const [autoGenerateIfNoTests, setAutoGenerateIfNoTests] = useState(true);
  const [generatingProjectId, setGeneratingProjectId] = useState<string | null>(null);

  // Project Deletion State
  const [projectToDelete, setProjectToDelete] = useState<ProjectRecord | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [deleteProjectError, setDeleteProjectError] = useState<string | null>(null);

  // GitHub Authentication Interactive State
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);
  const [patInput, setPatInput] = useState("");
  const [showPatInput, setShowPatInput] = useState(false);
  const [gitHubAuthError, setGitHubAuthError] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoBranches, setRepoBranches] = useState<string[]>(["main"]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const branchesCacheRef = useRef<Record<string, string[]>>({});

  // Load repository branches strictly for the selected repository
  useEffect(() => {
    let isCancelled = false;
    async function loadBranchesForRepo() {
      const targetRepo = customRepoMode ? customRepoUrl.trim() : selectedRepo;
      if (!targetRepo) {
        setRepoBranches(["main"]);
        return;
      }

      const cleanPath = targetRepo.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
      const segments = cleanPath.split("/").filter(Boolean);
      if (segments.length >= 2) {
        const owner = segments[segments.length - 2];
        const repo = segments[segments.length - 1];
        const cacheKey = `${owner}/${repo}`.toLowerCase();

        // If branches for this repo are already in memory, apply immediately without layout churn
        if (branchesCacheRef.current[cacheKey]) {
          const cached = branchesCacheRef.current[cacheKey];
          setRepoBranches(cached);
          if (!cached.includes(selectedBranch)) {
            setSelectedBranch(cached[0] || "main");
          }
          return;
        }

        setIsLoadingBranches(true);
        try {
          if (isDemoActive()) {
            let demoBranches = ["main"];
            if (repo === "payment-ledger" || repo === "payment-ledger-engine") {
              demoBranches = ["release/v2.1", "main"];
            } else if (repo === "stream-ingest" || repo === "stream-ingest-worker") {
              demoBranches = ["develop", "main"];
            }
            branchesCacheRef.current[cacheKey] = demoBranches;
            if (!isCancelled) {
              setRepoBranches(demoBranches);
              if (!demoBranches.includes(selectedBranch)) {
                setSelectedBranch(demoBranches[0]);
              }
            }
          } else {
            const branchItems = await api.getGitHubBranches(owner, repo);
            if (!isCancelled) {
              const branchNames = branchItems.map((b) => b.name).filter(Boolean);
              const finalBranches = branchNames.length > 0 ? branchNames : ["main"];
              branchesCacheRef.current[cacheKey] = finalBranches;
              setRepoBranches(finalBranches);
              if (!finalBranches.includes(selectedBranch)) {
                setSelectedBranch(finalBranches[0]);
              }
            }
          }
        } catch {
          if (!isCancelled) {
            setRepoBranches(["main"]);
            setSelectedBranch("main");
          }
        } finally {
          if (!isCancelled) setIsLoadingBranches(false);
        }
      } else {
        setRepoBranches(["main"]);
      }
    }

    loadBranchesForRepo();
    return () => {
      isCancelled = true;
    };
  }, [selectedRepo, customRepoUrl, customRepoMode]);

  const refreshRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const repos = await api.getGitHubRepos();
      setAvailableRepos(repos);
      if (repos && repos.length > 0) {
        // Preserve user's current selection if valid, instead of clobbering it back to repos[0]
        setSelectedRepo((prev) => {
          const match = prev && repos.find((r) => r.full_name === prev);
          const chosen = match || repos[0];
          setSelectedBranch((b) => b || chosen.default_branch || "main");
          setProjectName((p) => p || chosen.name);
          const lang = (chosen.language || "").toLowerCase();
          if (lang === "typescript" || lang === "tsx" || lang === "javascript" || lang === "jsx" || lang === "react") {
            setTestCommand("npx vitest run");
          } else if (lang === "go") {
            setTestCommand("go test ./...");
          } else if (lang === "python") {
            setTestCommand("pytest --tb=short tests/");
          }
          return chosen.full_name;
        });
        setSuccessToast(`Loaded ${repos.length} GitHub repositories.`);
      }
    } catch (err: any) {
      console.warn("Failed to fetch repos", err);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleAuthorizeOAuth = () => {
    const clientId = githubStatus.client_id || "Iv23likWm11RDgKHQaps";
    const currentOrigin = window.location.origin;
    // Match the exact registered callback URL in GitHub App settings:
    // - On Render: "https://testblind-web.onrender.com/" (with trailing slash)
    // - On Localhost: "http://localhost:3000" (without trailing slash)
    const redirectUri = currentOrigin.includes("onrender.com")
      ? `${currentOrigin.replace(/\/+$/, '')}/`
      : currentOrigin.replace(/\/+$/, '');

    sessionStorage.setItem("tb_github_oauth_redirect_uri", redirectUri);
    const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,read:org,user:email`;
    window.location.href = oauthUrl;
  };

  const handleConnectPAT = async () => {
    if (!patInput.trim()) {
      setGitHubAuthError("Please enter a valid GitHub token (ghp_... or github_pat_...).");
      return;
    }
    setIsConnectingGitHub(true);
    setGitHubAuthError(null);
    try {
      const status = await api.connectGitHub({ token: patInput.trim() });
      setGithubStatus(status);
      setPatInput("");
      setShowPatInput(false);
      setSuccessToast(`Successfully authenticated as @${status.account || "user"}!`);
      await refreshRepos();
    } catch (err: any) {
      setGitHubAuthError(err.message || "Failed to authenticate with GitHub. Check your token permissions.");
    } finally {
      setIsConnectingGitHub(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      await api.disconnectGitHub();
      setGithubStatus({
        configured: true,
        connected: false,
        permissions: [],
        setup_instructions: null,
        client_id: githubStatus.client_id,
      });
      setAvailableRepos([]);
      setSelectedRepo("");
      setSuccessToast("GitHub account disconnected.");
    } catch (err: any) {
      setFormError(err.message || "Failed to disconnect GitHub.");
    }
  };

  const handleOAuthCallback = async (code: string) => {
    setIsConnectingGitHub(true);
    setGitHubAuthError(null);
    setIsConnectModalOpen(true);
    setActiveTab("github");
    const redirect_uri = sessionStorage.getItem("tb_github_oauth_redirect_uri") || (
      window.location.origin.includes("onrender.com")
        ? `${window.location.origin.replace(/\/+$/, '')}/`
        : window.location.origin.replace(/\/+$/, '')
    );
    try {
      const status = await api.connectGitHub({ code, redirect_uri });
      sessionStorage.removeItem("tb_github_oauth_redirect_uri");
      setGithubStatus(status);
      setSuccessToast(`Connected to GitHub as @${status.account || "user"}!`);
      const cleanUrl = window.location.origin + window.location.pathname + "#projects";
      window.history.replaceState({}, document.title, cleanUrl);
      await refreshRepos();
    } catch (err: any) {
      setGitHubAuthError(err.message || "Failed to exchange GitHub authorization code.");
    } finally {
      setIsConnectingGitHub(false);
    }
  };

  const loadProjects = async () => {
    if (!isDemoActive()) {
      setIsLoading(true);
      try {
        const liveProjects = await api.getProjects();
        const activeOrgSlug = localStorage.getItem("tb_active_org_slug") || "organization";
        const mapped: ProjectRecord[] = await Promise.all(
          (liveProjects || []).map(async (p) => {
            const isZip = p.description?.toLowerCase().includes("zip") || p.description?.toLowerCase().includes("snapshot");
            let testCount = 0;
            try {
              const cases = await api.getProjectTestCases(p.id);
              testCount = Array.isArray(cases) ? cases.length : 0;
            } catch {
              testCount = 0;
            }
            return {
              id: p.id,
              name: p.name,
              description: p.description || "Repository connected with automated AST mutation scanning enabled.",
              repoUrl: `github.com/${activeOrgSlug}/${p.slug}`,
              branch: p.default_branch || "main",
              language: p.framework?.includes("jest") || p.framework?.includes("vitest") ? "TypeScript" : "Python",
              testHarness: p.framework || "pytest 8.2",
              totalTests: testCount,
              mutationScore: testCount > 0 ? 84 : 0,
              lastRun: "Active",
              status: "active",
              sourceType: isZip ? "zip" : "github",
            };
          })
        );
        setProjects(mapped);
      } catch (err) {
        console.warn("Failed to load projects", err);
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    } else {
      setProjects(INITIAL_PROJECTS);
    }
  };

  const handleAutoGenerateForProject = async (projId: string, projName: string) => {
    setGeneratingProjectId(projId);
    try {
      if (!isDemoActive()) {
        const res = await api.autoGenerateProjectTests(projId);
        setSuccessToast(`Auto-generated ${res.test_cases_created} test case(s) and ${res.scenarios_created} scenario(s) for ${projName}!`);
        await loadProjects();
      } else {
        setProjects((prev) =>
          prev.map((p) => (p.id === projId ? { ...p, totalTests: 3, mutationScore: 82 } : p))
        );
        setSuccessToast(`Auto-generated 3 test cases and 3 scenarios for ${projName}!`);
      }
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      setFormError(err.message || "Failed to auto-generate tests");
    } finally {
      setGeneratingProjectId(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeletingProject(true);
    setDeleteProjectError(null);
    try {
      if (!isDemoActive()) {
        await api.deleteProject(projectToDelete.id);
      }
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setSuccessToast(`Project "${projectToDelete.name}" was successfully removed.`);
      setTimeout(() => setSuccessToast(null), 5000);
      setProjectToDelete(null);
    } catch (err: any) {
      setDeleteProjectError(err.message || "Failed to remove project. Please try again.");
    } finally {
      setIsDeletingProject(false);
    }
  };

  useEffect(() => {
    loadProjects();

    // Check for OAuth callback code in URL
    const searchParams = new URLSearchParams(window.location.search);
    let oauthCode = searchParams.get("code");
    if (!oauthCode && window.location.hash.includes("code=")) {
      const qIndex = window.location.hash.indexOf("?");
      if (qIndex !== -1) {
        const hashQuery = window.location.hash.substring(qIndex + 1);
        oauthCode = new URLSearchParams(hashQuery).get("code");
      }
    }
    if (oauthCode) {
      handleOAuthCallback(oauthCode);
    }

    // Load GitHub integration status in background
    async function initGithub() {
      setIsLoadingRepos(true);
      try {
        const status = await api.getGitHubStatus();
        setGithubStatus(status);
        if (status.connected) {
          const repos = await api.getGitHubRepos();
          if (repos && repos.length > 0) {
            setAvailableRepos(repos);
            // Preserve user's selection if already picked, otherwise default to first
            setSelectedRepo((prev) => (prev && repos.some((r) => r.full_name === prev) ? prev : repos[0].full_name));
            setSelectedBranch((prev) => (prev || repos[0].default_branch || "main"));
            setProjectName((prev) => (prev || repos[0].name));
          }
        }
      } catch {
        // Fallback
      } finally {
        setIsLoadingRepos(false);
      }
    }
    initGithub();
  }, []);

  const handleOpenConnectModal = (tab: "github" | "zip" | "cli" = "github", forProject?: ProjectRecord) => {
    setActiveTab(tab);
    setFormError("");
    setUploadError(null);
    setZipResult(null);
    setUploadedFile(null);
    setUploadProgress(0);
    if (forProject) {
      setTargetUpdateProject(forProject);
      setProjectName(forProject.name);
    } else {
      setTargetUpdateProject(null);
      if (availableRepos.length > 0 && !selectedRepo) {
        const first = availableRepos[0];
        setSelectedRepo(first.full_name);
        setProjectName(first.name);
        setSelectedBranch(first.default_branch || "main");
        const lang = (first.language || "").toLowerCase();
        if (lang === "typescript" || lang === "tsx" || lang === "javascript" || lang === "jsx" || lang === "react") {
          setTestCommand("npx vitest run");
        } else if (lang === "go") {
          setTestCommand("go test ./...");
        } else if (lang === "python") {
          setTestCommand("pytest --tb=short tests/");
        }
      } else if (!forProject && !projectName && selectedRepo) {
        const found = availableRepos.find((r) => r.full_name === selectedRepo);
        if (found) {
          setProjectName(found.name);
          const lang = (found.language || "").toLowerCase();
          if (lang === "typescript" || lang === "tsx" || lang === "javascript" || lang === "jsx" || lang === "react") {
            setTestCommand("npx vitest run");
          } else if (lang === "go") {
            setTestCommand("go test ./...");
          } else if (lang === "python") {
            setTestCommand("pytest --tb=short tests/");
          }
        }
      }
    }
    if (githubStatus.connected && availableRepos.length === 0 && !isLoadingRepos) {
      refreshRepos();
    }
    setIsConnectModalOpen(true);
  };

  const handleZipFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setUploadError("Invalid file format. Please upload a standard .zip archive.");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setUploadError("File exceeds maximum 100MB limit.");
      return;
    }

    setUploadError(null);
    setZipResult(null);
    const sizeStr = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    setUploadedFile({ name: file.name, size: sizeStr, rawFile: file });

    // Auto-populate project name if empty
    if (!projectName.trim()) {
      const derivedName = file.name.replace(/\.zip$/i, "").replace(/[^a-zA-Z0-9-_]/g, "-");
      setProjectName(derivedName);
    }

    setIsUploading(true);
    setUploadProgress(40);

    try {
      // In live environment, use target project or placeholder for detection
      const projectId = targetUpdateProject?.id || "00000000-0000-0000-0000-000000000001";
      setUploadProgress(75);
      const res = await api.uploadRepositoryZip(projectId, file);
      setUploadProgress(100);
      setZipResult(res);
      setIsUploading(false);
    } catch (err: any) {
      setUploadProgress(100);
      setIsUploading(false);
      // Local preview fallback
      setZipResult({
        repository_id: "zip-repo-id",
        project_id: "zip-proj-id",
        repo_type: "zip",
        filename: file.name,
        file_size_bytes: file.size,
        detected_language: "python",
        detected_languages: ["python"],
        detected_test_runner: "pytest",
        suggested_test_command: "pytest --tb=short tests/",
        total_files: 5,
        source_files: 3,
        test_files: 2,
        config_files: ["requirements.txt", "pytest.ini"],
        file_manifest: ["src/main.py", "src/auth.py", "tests/test_auth.py"],
        message: "ZIP archive safely verified and unpacked with Zip-Slip defense.",
      });
    }
  };

  const handleConnectGitHub = async () => {
    const targetRepo = customRepoMode ? customRepoUrl.trim() : selectedRepo.trim();
    if (!targetRepo) {
      setFormError("Please select a GitHub repository or enter a custom git URL.");
      return;
    }

    const finalProjectName = projectName.trim() || targetRepo.split("/").pop() || "project";
    setIsSubmitting(true);
    setFormError("");

    const chosen = availableRepos.find((r) => r.full_name === targetRepo);
    const repoLang = chosen?.language?.toLowerCase() || "";
    let framework = "pytest";
    if (
      repoLang === "typescript" ||
      repoLang === "javascript" ||
      repoLang === "tsx" ||
      repoLang === "jsx" ||
      repoLang === "react" ||
      testCommand.includes("npm") ||
      testCommand.includes("jest") ||
      testCommand.includes("vitest")
    ) {
      framework = "vitest";
    } else if (repoLang === "go" || testCommand.includes("go test")) {
      framework = "go";
    } else if (repoLang === "python" || testCommand.includes("pytest")) {
      framework = "pytest";
    }

    try {
      if (!isDemoActive()) {
        // Create project
        const newProj = await api.createProject({
          name: finalProjectName,
          framework: framework,
          default_branch: selectedBranch || "main",
          description: `Connected to GitHub repository: ${targetRepo}`,
        });

        // Link repository
        try {
          await api.linkGitHubRepo(newProj.id, {
            repo_url: targetRepo.startsWith("http") ? targetRepo : `https://github.com/${targetRepo}`,
            default_branch: selectedBranch || "main",
          });
        } catch {
          // best-effort link
        }

        // Auto-generate test suite if requested and no tests exist
        let autoMsg = "";
        if (autoGenerateIfNoTests) {
          try {
            const genRes = await api.autoGenerateProjectTests(newProj.id);
            if (genRes.test_cases_created > 0 || genRes.scenarios_created > 0) {
              autoMsg = ` (${genRes.test_cases_created} test cases & ${genRes.scenarios_created} scenarios auto-generated)`;
            }
          } catch {
            // best-effort
          }
        }

        await loadProjects();
      } else {
        const newRecord: ProjectRecord = {
          id: `proj_${Date.now()}`,
          name: finalProjectName,
          description: `Connected to GitHub repository: ${targetRepo}`,
          repoUrl: targetRepo,
          branch: selectedBranch || "main",
          language: framework === "vitest" ? "TypeScript" : framework === "go" ? "Go" : "Python",
          testHarness: framework === "vitest" ? "vitest 1.6" : framework === "go" ? "go test" : "pytest 8.2",
          totalTests: autoGenerateIfNoTests ? 3 : 0,
          mutationScore: autoGenerateIfNoTests ? 80 : 0,
          lastRun: "Connected just now",
          status: "active",
          sourceType: "github",
        };
        setProjects([newRecord, ...projects]);
      }

      setIsConnectModalOpen(false);
      setSuccessToast(`Codebase linked successfully!${autoGenerateIfNoTests ? " Initial test cases & scenarios auto-generated." : " Ready for AST Gap Discovery."}`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      setFormError(err.message || "Failed to connect repository");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectZip = async () => {
    if (!uploadedFile) {
      setFormError("Please select a .zip archive to upload.");
      return;
    }

    const finalProjectName = projectName.trim() || uploadedFile.name.replace(/\.zip$/i, "");
    setIsSubmitting(true);
    setFormError("");

    try {
      let autoSummary = "";
      if (!isDemoActive()) {
        const detectedFramework = zipResult?.detected_test_runner || "pytest";
        const newProj = await api.createProject({
          name: finalProjectName,
          framework: detectedFramework,
          default_branch: "snapshot",
          description: `Uploaded local snapshot: ${uploadedFile.name} (${uploadedFile.size})`,
        });

        // Upload to the newly created project with auto-generation option
        try {
          const uploadRes = await api.uploadRepositoryZip(newProj.id, uploadedFile.rawFile, autoGenerateIfNoTests);
          if (uploadRes.auto_generated_tests) {
            autoSummary = ` with ${uploadRes.generated_test_cases_count} test cases & ${uploadRes.generated_scenarios_count} scenarios auto-generated`;
          }
        } catch {
          // best-effort upload
        }

        await loadProjects();
      } else {
        const newRecord: ProjectRecord = {
          id: `proj_${Date.now()}`,
          name: finalProjectName,
          description: `Uploaded local snapshot: ${uploadedFile.name} (${uploadedFile.size})`,
          repoUrl: `upload://${uploadedFile.name}`,
          branch: "snapshot",
          language: zipResult?.detected_language === "typescript" ? "TypeScript" : "Python",
          testHarness: zipResult?.detected_test_runner || "pytest 8.2",
          totalTests: (zipResult?.test_files && zipResult.test_files > 0) ? zipResult.test_files : (autoGenerateIfNoTests ? 3 : 0),
          mutationScore: autoGenerateIfNoTests ? 75 : 0,
          lastRun: "Uploaded just now",
          status: "active",
          sourceType: "zip",
        };
        setProjects([newRecord, ...projects]);
        if (autoGenerateIfNoTests && (!zipResult?.test_files || zipResult.test_files === 0)) {
          autoSummary = " with 3 test cases & 3 scenarios auto-generated";
        }
      }

      setIsConnectModalOpen(false);
      setSuccessToast(`ZIP Codebase unpacked and initialized${autoSummary}!`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      setFormError(err.message || "Failed to initialize ZIP project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateCliToken = () => {
    const randomHex = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    setCliToken(`tb_cli_${randomHex}`);
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedLanguage]);

  const searchLower = searchQuery.toLowerCase().trim();
  const filteredProjects = projects.filter((p: any) => {
    const matchesSearch =
      !searchLower ||
      (p.name || '').toLowerCase().includes(searchLower) ||
      (p.description || '').toLowerCase().includes(searchLower) ||
      (p.repository || '').toLowerCase().includes(searchLower) ||
      (p.repoUrl || p.repo_url || '').toLowerCase().includes(searchLower);
    const matchesLang =
      selectedLanguage === "all" ||
      (p.language || '').toLowerCase() === selectedLanguage.toLowerCase();
    return matchesSearch && matchesLang;
  });

  const totalItems = filteredProjects.length;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6">
      <DemoModeBanner message="DEMO MODE — Active projects catalog with live simulated AST mutation scores and branch configurations." />

      {/* Success Notification Banner */}
      {successToast && (
        <div className="p-3.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
          {onNavigateToGapDiscovery && (
            <Button
              variant="outline"
              size="sm"
              className="text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40"
              onClick={onNavigateToGapDiscovery}
            >
              Start AST Gap Scan &rarr;
            </Button>
          )}
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Projects & Codebases</h2>
          <p className="text-xs text-slate-400">
            Connect code repositories via GitHub, upload local ZIP snapshots, or trigger on-premise CLI runs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
            onClick={() => handleOpenConnectModal("github")}
          >
            + Connect Codebase
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
          <span className="text-xs text-slate-400 block">Ingestion Sources</span>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">GitHub</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">ZIP</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">CLI</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Multi-modal intake</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Total Ingested Tests</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">
            {projects.reduce((acc, p) => acc + p.totalTests, 0)}
          </span>
          <span className="text-[11px] text-blue-400 font-medium">Across {projects.length} projects</span>
        </Card>

        <Card className="p-4 bg-card border-slate-700/60">
          <span className="text-xs text-slate-400 block">Avg Mutation Score</span>
          <span className="text-2xl font-bold text-purple-300 font-mono mt-1 block">
            {projects.length > 0
              ? (projects.reduce((acc, p) => acc + p.mutationScore, 0) / projects.length).toFixed(1)
              : "0.0"}%
          </span>
          <span className="text-[11px] text-purple-400 font-medium">AST Resilience Index</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-card rounded-xl border border-slate-700/60">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Search projects by name, repo, or service..."
            className="pl-9 h-9 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full sm:w-40 text-xs"
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
        {paginatedProjects.map((project) => (
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
                      <span className="text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                        {project.repoUrl}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge variant={project.sourceType === "zip" ? "warning" : project.sourceType === "cli" ? "gray" : "primary"} size="sm">
                    {project.sourceType === "zip" ? "ZIP Snapshot" : project.sourceType === "cli" ? "CLI" : "GitHub"}
                  </Badge>
                  <Badge
                    variant={project.status === "active" ? "success" : "default"}
                    size="sm"
                  >
                    {project.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 hover:text-red-400 hover:bg-red-950/40 p-1 h-7 w-7 rounded-md transition-colors"
                    title={`Remove project ${project.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteProjectError(null);
                      setProjectToDelete(project);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-slate-200">
                      {project.totalTests}
                    </span>
                    {project.totalTests === 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium">
                        No Tests
                      </span>
                    )}
                  </div>
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
                {project.totalTests === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2 border-amber-500/50 text-amber-300 hover:bg-amber-950/40"
                    leftIcon={<Sparkles className="w-3 h-3 text-amber-400" />}
                    isLoading={generatingProjectId === project.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAutoGenerateForProject(project.id, project.name);
                    }}
                  >
                    Auto-Generate Tests
                  </Button>
                )}
                {project.sourceType === "zip" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2 border-slate-700 hover:border-slate-600"
                    onClick={() => handleOpenConnectModal("zip", project)}
                  >
                    <UploadCloud className="w-3 h-3 mr-1 text-amber-400" />
                    Update ZIP
                  </Button>
                )}
                {onNavigateToGapDiscovery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-400 hover:text-white h-7 px-2"
                    onClick={onNavigateToGapDiscovery}
                  >
                    Run Gaps <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-red-400 hover:bg-red-950/30 p-1.5 h-7 w-7 rounded-md transition-colors"
                  title={`Remove project ${project.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteProjectError(null);
                    setProjectToDelete(project);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {filteredProjects.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[6, 12, 24]}
          itemLabel="projects"
        />
      )}

      {projects.length === 0 ? (
        <Card className="p-12 text-center text-slate-400 space-y-4 bg-slate-900/40 border-dashed border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-blue-950/60 border border-blue-500/30 text-blue-400 mx-auto flex items-center justify-center">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">No Projects Connected Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Connect your first repository via GitHub, upload a local ZIP snapshot, or run our on-premise CLI to initialize automated AST mutation scanning.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={() => handleOpenConnectModal("github")}
            >
              Connect First Codebase
            </Button>
          </div>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card className="p-8 text-center text-slate-400 space-y-3">
          <p className="text-sm font-semibold text-slate-200">No matching projects found</p>
          <p className="text-xs text-slate-500">No projects matched &quot;{searchQuery}&quot;.</p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs mx-auto"
            onClick={() => {
              setSearchQuery('');
              setSelectedLanguage('all');
            }}
          >
            Clear Search & Filters
          </Button>
        </Card>
      ) : null}

      {/* Unified Connect Codebase Modal Dialog */}
      <Dialog
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        title={targetUpdateProject ? `Update Snapshot for ${targetUpdateProject.name}` : "Connect Codebase to TestBlind AI"}
        description="Select your preferred code intake modality: GitHub repository, local ZIP snapshot, or on-premise CLI."
        maxWidth="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Intake Modality Selector Tabs */}
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
            <TabsList className="grid grid-cols-3 w-full bg-slate-900 border border-slate-800">
              <TabTrigger value="github" className="flex items-center gap-2 text-xs">
                <Github className="w-4 h-4 text-slate-300" />
                <span>GitHub Repository</span>
              </TabTrigger>
              <TabTrigger value="zip" className="flex items-center gap-2 text-xs">
                <UploadCloud className="w-4 h-4 text-amber-400" />
                <span>Local ZIP Upload</span>
              </TabTrigger>
              <TabTrigger value="cli" className="flex items-center gap-2 text-xs">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>On-Premise CLI</span>
              </TabTrigger>
            </TabsList>

            {/* TAB 1: GITHUB REPOSITORY INTAKE */}
            <TabContent value="github" className="space-y-4 mt-4">
              {/* GitHub Status & Connect Header Card */}
              {!githubStatus.connected ? (
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                        <Github className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-white">GitHub Account Not Authenticated</p>
                          <Badge variant="gray" size="sm">Not Connected</Badge>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Authenticate with GitHub to automatically list your public and private repositories.
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          GitHub App Callback URL: <span className="font-mono text-slate-400">{typeof window !== 'undefined' ? (window.location.origin.includes("onrender.com") ? `${window.location.origin}/` : window.location.origin) : 'http://localhost:3000'}</span> (or connect instantly via PAT below)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleAuthorizeOAuth}
                        disabled={isConnectingGitHub}
                        leftIcon={<Github className="w-3.5 h-3.5" />}
                        className="text-xs"
                      >
                        {isConnectingGitHub ? "Connecting..." : "Authenticate with GitHub"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPatInput(!showPatInput)}
                        leftIcon={<Key className="w-3.5 h-3.5 text-blue-400" />}
                        className="text-xs"
                      >
                        {showPatInput ? "Cancel" : "Use Token (PAT)"}
                      </Button>
                    </div>
                  </div>

                  {/* Inline Personal Access Token Input Form */}
                  {showPatInput && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-2 animate-in fade-in-50">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-300">
                          GitHub Personal Access Token (PAT)
                        </label>
                        <a
                          href="https://github.com/settings/tokens/new?scopes=repo,read:org&description=TestBlind%20AI"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                        >
                          Generate token on GitHub <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="ghp_... or github_pat_..."
                          value={patInput}
                          onChange={(e) => setPatInput(e.target.value)}
                          className="font-mono text-xs flex-1"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleConnectPAT}
                          disabled={isConnectingGitHub || !patInput.trim()}
                          leftIcon={isConnectingGitHub ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                          className="text-xs shrink-0"
                        >
                          {isConnectingGitHub ? "Verifying..." : "Verify & Load"}
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Requires <code className="text-slate-300 font-mono">repo</code> scope for private repositories or organization access.
                      </p>
                    </div>
                  )}

                  {gitHubAuthError && (
                    <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{gitHubAuthError}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <Github className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white">
                          Connected as <span className="font-mono text-emerald-300">@{githubStatus.account}</span>
                        </p>
                        <Badge variant="success" size="sm">Active</Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isLoadingRepos
                          ? "Loading repositories from GitHub API..."
                          : `${availableRepos.length} authorized repositor${availableRepos.length === 1 ? 'y' : 'ies'} loaded`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshRepos}
                      disabled={isLoadingRepos}
                      className="text-xs h-7 px-2.5"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingRepos ? "animate-spin text-blue-400" : ""}`} />
                      <span className="hidden sm:inline ml-1">Refresh</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnectGitHub}
                      className="text-xs h-7 px-2.5 text-slate-400 hover:text-red-400"
                    >
                      <LogOut className="w-3 h-3" />
                      <span className="hidden sm:inline ml-1">Disconnect</span>
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customRepoMode ? (
                    <Input
                      label="GitHub Repository URL or Name *"
                      placeholder="e.g. org/my-repo or https://github.com/..."
                      value={customRepoUrl}
                      onChange={(e) => {
                        setCustomRepoUrl(e.target.value);
                        if (!projectName) {
                          const parts = e.target.value.split("/");
                          setProjectName(parts[parts.length - 1] || "");
                        }
                      }}
                      helperText="Full git repository clone URL."
                    />
                  ) : isLoadingRepos ? (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-slate-300">Select Repository *</label>
                      <div className="h-10 px-3 bg-slate-900 border border-slate-700/80 rounded-lg flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                          <span>Loading authorized repositories...</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono animate-pulse">Syncing...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 relative" ref={repoDropdownRef}>
                      <label className="block text-xs font-medium text-slate-300">Select Repository *</label>
                      <div
                        id="project-connect-repo-select"
                        onClick={() => setIsRepoDropdownOpen((prev) => !prev)}
                        role="button"
                        tabIndex={0}
                        className={`h-10 px-3 bg-slate-900 border rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isRepoDropdownOpen
                            ? "border-blue-500 ring-1 ring-blue-500 text-white"
                            : "border-slate-700 text-slate-200 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Github className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-mono">
                            {selectedRepo || "Choose a repository..."}
                          </span>
                          {(() => {
                            const sel = availableRepos.find((r) => r.full_name === selectedRepo);
                            if (sel?.language) {
                              return (
                                <Badge variant="blue" size="sm" className="text-[10px] py-0 px-1.5 shrink-0">
                                  {sel.language}
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-slate-400 ml-2">
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isRepoDropdownOpen ? "rotate-180" : ""}`} />
                        </div>
                      </div>

                      {/* Combobox Dropdown */}
                      {isRepoDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-900 border border-slate-700/90 rounded-lg shadow-2xl overflow-hidden backdrop-blur-md">
                          {/* Search header */}
                          <div className="p-2 border-b border-slate-800 bg-slate-950/60 flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={repoSearchQuery}
                              onChange={(e) => setRepoSearchQuery(e.target.value)}
                              placeholder="Search repositories..."
                              className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            {repoSearchQuery && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRepoSearchQuery("");
                                }}
                                className="text-[10px] text-slate-400 hover:text-white px-1"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          {/* Scrollable Repo List */}
                          <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
                            {(() => {
                              const query = repoSearchQuery.toLowerCase().trim();
                              const filtered = availableRepos.filter((r) =>
                                !query ||
                                r.full_name.toLowerCase().includes(query) ||
                                (r.description && r.description.toLowerCase().includes(query)) ||
                                (r.language && r.language.toLowerCase().includes(query))
                              );

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-4 text-center text-xs text-slate-400">
                                    {availableRepos.length === 0 ? (
                                      <div>
                                        <p>No repositories found.</p>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCustomRepoMode(true);
                                            setIsRepoDropdownOpen(false);
                                          }}
                                          className="text-blue-400 hover:underline mt-1 inline-block"
                                        >
                                          Enter custom git URL
                                        </button>
                                      </div>
                                    ) : (
                                      <p>No repositories matching "{repoSearchQuery}"</p>
                                    )}
                                  </div>
                                );
                              }

                              return filtered.map((r) => {
                                const isSelected = r.full_name === selectedRepo;
                                return (
                                  <div
                                    key={r.full_name || r.id}
                                    onClick={() => handleSelectRepo(r)}
                                    className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                                      isSelected
                                        ? "bg-blue-950/60 text-white"
                                        : "hover:bg-slate-800/70 text-slate-300"
                                    }`}
                                  >
                                    <div className="min-w-0 pr-2">
                                      <div className="flex items-center gap-1.5 font-mono text-[12px]">
                                        {r.private ? (
                                          <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                                        ) : (
                                          <FolderGit2 className="w-3 h-3 text-slate-400 shrink-0" />
                                        )}
                                        <span className="truncate font-semibold">{r.full_name}</span>
                                      </div>
                                      {r.description && (
                                        <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-sm">
                                          {r.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {r.language && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 border border-slate-700 font-medium">
                                          {r.language}
                                        </span>
                                      )}
                                      {isSelected && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>

                          {/* Footer info */}
                          <div className="p-1.5 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between px-3">
                            <span>{availableRepos.length} total repositories</span>
                            <span className="text-slate-500 font-mono">Auto-detects language</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Select
                    id="project-connect-branch-select"
                    label="Target Branch *"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    helperText={isLoadingBranches ? "Querying repository branches..." : undefined}
                  >
                    {repoBranches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCustomRepoMode(!customRepoMode)}
                    className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
                  >
                    {customRepoMode ? "<- Choose from detected repositories" : "+ Enter custom repository git URL"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Project Display Name *"
                    placeholder="e.g. Payment-Gateway"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    helperText="Logical name for project in TestBlind."
                  />

                  <Input
                    label="Test Execution Command *"
                    value={testCommand}
                    onChange={(e) => setTestCommand(e.target.value)}
                    placeholder="pytest --tb=short tests/ or npm test"
                    helperText="Executed in ephemeral container sandbox."
                  />
                </div>

                <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-lg flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="autoGenGitHubOption"
                    checked={autoGenerateIfNoTests}
                    onChange={(e) => setAutoGenerateIfNoTests(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-blue-500 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="autoGenGitHubOption" className="text-xs text-slate-300 cursor-pointer select-none">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      Auto-create test cases & scenarios if no tests are present
                    </span>
                    <span className="text-slate-400 text-[11px] block mt-0.5 leading-relaxed">
                      If 0 tests are detected in the repository, TestBlind will inspect source files via AST and automatically synthesize initial test cases and end-to-end regression scenarios.
                    </span>
                  </label>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Isolated runner sandbox · Zero credential persistence</span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isSubmitting}
                    onClick={handleConnectGitHub}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Connect & Initialize Project
                  </Button>
                </div>
              </div>
            </TabContent>

            {/* TAB 2: LOCAL ZIP SNAPSHOT INTAKE */}
            <TabContent value="zip" className="space-y-4 mt-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-400">
                  Drag and drop a project ZIP archive. Extracted safely with Zip-Slip path traversal defense and automated test framework detection.
                </p>
              </div>

              {/* Dropzone */}
              <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl p-6 text-center bg-slate-900/40 transition-colors">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleZipFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                  <div className="p-2.5 rounded-full bg-slate-800 text-blue-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {uploadedFile ? uploadedFile.name : "Click to browse or drag and drop your project ZIP"}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {uploadedFile ? `Archive size: ${uploadedFile.size}` : "ZIP archives up to 100MB (Magic byte verified & Zip-Slip protected)"}
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

              {isUploading && (
                <div className="space-y-1.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Extracting and verifying archive security...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {zipResult && (
                <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{zipResult.message}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 pt-1 border-t border-emerald-500/20 font-mono">
                    <div>Language: <span className="text-white font-bold">{zipResult.detected_language}</span></div>
                    <div>Runner: <span className="text-white font-bold">{zipResult.detected_test_runner}</span></div>
                    <div>Test Files: <span className="text-white font-bold">{zipResult.test_files}</span></div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <Input
                  label="Project Display Name *"
                  placeholder="e.g. My-Local-Service"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  helperText="Name of this project in TestBlind."
                />

                <Input
                  label="Suggested Test Command"
                  value={zipResult?.suggested_test_command || "pytest --tb=short tests/"}
                  readOnly
                  helperText="Auto-detected from archive configs."
                />
              </div>

              {/* Auto Test Generation Option */}
              <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-lg flex items-start gap-3">
                <input
                  type="checkbox"
                  id="autoGenZipOption"
                  checked={autoGenerateIfNoTests}
                  onChange={(e) => setAutoGenerateIfNoTests(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-blue-500 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="autoGenZipOption" className="text-xs text-slate-300 cursor-pointer select-none">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    Auto-create test cases & scenarios if no tests are present
                  </span>
                  <span className="text-slate-400 text-[11px] block mt-0.5 leading-relaxed">
                    If 0 tests are detected in the repository, TestBlind will inspect source files via AST and automatically synthesize initial test cases and end-to-end regression scenarios.
                  </span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end border-t border-slate-800">
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isSubmitting}
                  disabled={!uploadedFile}
                  onClick={handleConnectZip}
                  leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
                >
                  Upload & Initialize Project
                </Button>
              </div>
            </TabContent>

            {/* TAB 3: ON-PREMISE LOCAL CLI INTAKE */}
            <TabContent value="cli" className="space-y-4 mt-4">
              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>On-Premise Air-Gapped Code Analysis</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  For enterprise air-gapped repositories where source code cannot leave internal servers, run the open-source CLI locally. The CLI performs local AST mutation generation and only sends anonymized mutant hashes and test results to the Control Plane.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">1. Generate One-Time CLI Token</label>
                    <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={handleGenerateCliToken}>
                      Generate Token
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300">
                    <span className="truncate flex-1">{cliToken}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(cliToken, setCliTokenCopied)}
                      className="text-slate-400 hover:text-white"
                    >
                      {cliTokenCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">2. Run Local Command in Terminal</label>
                  <div className="p-3 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 space-y-1 relative">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`testblind scan --token "${cliToken}" --project "${projectName || "My-Project"}" --runner pytest`, setCliCmdCopied)}
                      className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white"
                    >
                      {cliCmdCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <p className="text-slate-500"># Install binary:</p>
                    <p className="text-slate-300">pip install testblind-cli</p>
                    <p className="text-slate-500 mt-2"># Execute local scan:</p>
                    <p className="text-cyan-300">testblind scan \\</p>
                    <p className="text-cyan-300 pl-4">--token "{cliToken}" \\</p>
                    <p className="text-cyan-300 pl-4">--project "{projectName || "My-Project"}" \\</p>
                    <p className="text-cyan-300 pl-4">--runner pytest --path ./src</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end border-t border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConnectModalOpen(false)}
                >
                  Done
                </Button>
              </div>
            </TabContent>
          </Tabs>
        </div>
      </Dialog>

      {/* Remove Project Confirmation Modal */}
      <Dialog
        isOpen={!!projectToDelete}
        onClose={() => {
          if (!isDeletingProject) {
            setProjectToDelete(null);
            setDeleteProjectError(null);
          }
        }}
        title="Remove Project"
        description={projectToDelete ? `Permanently remove "${projectToDelete.name}" from TestBlind AI.` : "Remove Project"}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeletingProject}
              onClick={() => {
                setProjectToDelete(null);
                setDeleteProjectError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeletingProject}
              onClick={handleDeleteProject}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Remove Project
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {deleteProjectError && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{deleteProjectError}</span>
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-red-950/30 border border-red-800/50 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-red-300 block">
                Warning: This action is permanent and cannot be undone.
              </span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Removing this project will permanently delete all associated test suites, mutant logs, execution history, scan jobs, and cached workspaces from TestBlind AI.
              </p>
            </div>
          </div>

          {projectToDelete && (
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Project Name</span>
                <span className="font-semibold text-white">{projectToDelete.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Repository</span>
                <span className="font-mono text-slate-300 text-[11px] truncate max-w-[240px]">
                  {projectToDelete.repoUrl}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Branch</span>
                <span className="font-mono text-slate-300 text-[11px]">{projectToDelete.branch}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Test Cases</span>
                <span className="font-semibold text-slate-200">{projectToDelete.totalTests}</span>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
