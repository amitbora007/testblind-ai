/**
 * TestBlind AI — API Client Service
 * Interacts with FastAPI backend under /api/v1
 */

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Default auth headers for demo / authenticated requests
function getHeaders(orgId?: string): HeadersInit {
  const token = localStorage.getItem('tb_auth_token') || 'demo_token';
  const org = orgId || localStorage.getItem('tb_active_org_id') || '00000000-0000-0000-0000-000000000000';
  return {
    'Authorization': `Bearer ${token}`,
    'X-Organization-ID': org,
    'Content-Type': 'application/json',
  };
}

export interface GitHubStatusResponse {
  configured: boolean;
  connected: boolean;
  account?: string | null;
  installation_id?: string | null;
  permissions: string[];
  setup_instructions?: string | null;
}

export interface ZipUploadResult {
  repository_id: string;
  project_id: string;
  repo_type: string;
  filename: string;
  file_size_bytes: number;
  detected_language: string;
  detected_languages: string[];
  detected_test_runner: string;
  suggested_test_command: string;
  total_files: number;
  source_files: number;
  test_files: number;
  config_files: string[];
  file_manifest: string[];
  message: string;
}

export interface CodeLabAnalyzeResult {
  language: string;
  ast_nodes_count: number;
  functions: Array<{ name: string; line: number; args: string[]; docstring?: string | null }>;
  branches_count: number;
  mutation_candidates: Array<{
    id: string;
    line_number: number;
    operator_type: string;
    original_operator: string;
    mutated_operator: string;
    original_snippet: string;
    mutated_snippet: string;
    description: string;
  }>;
  suggestions: Array<{
    title: string;
    description: string;
    category: string;
    target_line?: number | null;
    severity: string;
  }>;
  is_executable: boolean;
}

export interface CodeLabSynthesizeResult {
  synthesized_test_code: string;
  target_mutant: Record<string, any>;
  rationale: string;
  assertion_type: string;
  is_executable: boolean;
}

export interface CodeLabExecuteResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  mutant_status: string;
  execution_hash: string;
  is_executable: boolean;
  verified: boolean;
  baseline_passed: boolean;
  mutant_killed: boolean;
}

export interface ProjectResult {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  framework: string;
  default_branch: string;
}

export interface ScanJobResult {
  id: string;
  project_id: string;
  status: string;
  trigger: string;
  branch: string;
  commit_hash?: string | null;
  total_mutants: number;
  killed_mutants: number;
  surviving_mutants: number;
  mutation_score: number;
  duration_seconds: number;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface MutationResult {
  id: string;
  scan_job_id: string;
  file_path: string;
  line_number: number;
  operator: string;
  original_code: string;
  mutated_code: string;
  status: string;
  killing_test_name?: string | null;
  synthesized_test_code?: string | null;
  verification_status?: string | null;
  evidence_hash?: string | null;
  explanation?: string | null;
  missing_boundary?: string | null;
}

export interface SynthesizeMutationResult {
  mutation_id: string;
  synthesized_test_code: string;
  verification_status: string;
  verified: boolean;
  baseline_passed: boolean;
  mutant_killed: boolean;
  evidence_hash: string;
  duration_ms: number;
  explanation: string;
  missing_boundary: string;
  recommended_action: string;
  details: string;
}

export interface PromoteMutationResult {
  test_case_id: string;
  project_id: string;
  name: string;
  file_path: string;
  status: string;
  mutation_kill_count: number;
  message: string;
}

export const api = {
  // GitHub Integration
  async getGitHubStatus(): Promise<GitHubStatusResponse> {
    try {
      const res = await fetch(`${API_BASE}/integrations/github/status`, {
        headers: getHeaders(),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch {
      // Graceful offline fallback
      return {
        configured: false,
        connected: false,
        permissions: [],
        setup_instructions:
          'Backend is currently offline or GitHub App credentials are not configured in environment (.env). Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable live sync.',
      };
    }
  },

  // Repository ZIP Upload
  async uploadRepositoryZip(projectId: string, file: File): Promise<ZipUploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('tb_auth_token') || 'demo_token';
    const org = localStorage.getItem('tb_active_org_id') || '00000000-0000-0000-0000-000000000000';

    const res = await fetch(`${API_BASE}/projects/${projectId}/repositories/upload-zip`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Organization-ID': org,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }

    return await res.json();
  },

  // Code Lab Analyze
  async analyzeCodeLab(
    sourceCode: string,
    language: string,
    existingTests?: string,
    expectedBehavior?: string
  ): Promise<CodeLabAnalyzeResult> {
    const res = await fetch(`${API_BASE}/codelab/analyze`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        source_code: sourceCode,
        language,
        existing_tests: existingTests,
        expected_behavior: expectedBehavior,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'AST Analysis failed' }));
      throw new Error(err.detail || 'AST Analysis failed');
    }

    return await res.json();
  },

  // Code Lab Synthesize
  async synthesizeCodeLab(
    sourceCode: string,
    language: string,
    targetMutation?: any,
    expectedBehavior?: string
  ): Promise<CodeLabSynthesizeResult> {
    const res = await fetch(`${API_BASE}/codelab/synthesize`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        source_code: sourceCode,
        language,
        target_mutation: targetMutation,
        expected_behavior: expectedBehavior,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Synthesis failed' }));
      throw new Error(err.detail || 'Synthesis failed');
    }

    return await res.json();
  },

  // Code Lab Execute
  async executeCodeLab(
    sourceCode: string,
    testCode: string,
    language: string
  ): Promise<CodeLabExecuteResult> {
    const res = await fetch(`${API_BASE}/codelab/execute`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        source_code: sourceCode,
        test_code: testCode,
        language,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Sandbox execution failed' }));
      throw new Error(err.detail || 'Sandbox execution failed');
    }

    return await res.json();
  },

  // Project Listing
  async getProjects(): Promise<ProjectResult[]> {
    try {
      const res = await fetch(`${API_BASE}/projects`, {
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  // Scan Jobs
  async getProjectScanJobs(projectId: string): Promise<ScanJobResult[]> {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/scan-jobs`, {
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async triggerScanJobSync(projectId: string, branch: string = 'main'): Promise<ScanJobResult> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/scan-jobs/sync`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        branch,
        trigger: 'manual',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Scan job failed' }));
      throw new Error(err.detail || 'Scan job failed');
    }
    return await res.json();
  },

  async getScanJobMutations(
    jobId: string,
    operator?: string,
    status?: string
  ): Promise<MutationResult[]> {
    try {
      let url = `${API_BASE}/scan-jobs/${jobId}/mutations`;
      const params = new URLSearchParams();
      if (operator && operator !== 'all') params.append('operator', operator);
      if (status && status !== 'all') params.append('status', status);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async getScanJobFindings(jobId: string): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/scan-jobs/${jobId}/findings`, {
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async synthesizeMutationTest(jobId: string, mutationId: string): Promise<SynthesizeMutationResult> {
    const res = await fetch(`${API_BASE}/scan-jobs/${jobId}/mutations/${mutationId}/synthesize`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Synthesis failed' }));
      throw new Error(err.detail || 'Synthesis failed');
    }
    return await res.json();
  },

  async promoteMutationTest(
    jobId: string,
    mutationId: string,
    name?: string,
    testCode?: string
  ): Promise<PromoteMutationResult> {
    const res = await fetch(`${API_BASE}/scan-jobs/${jobId}/mutations/${mutationId}/promote`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, test_code: testCode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Promotion failed' }));
      throw new Error(err.detail || 'Promotion failed');
    }
    return await res.json();
  },
};
