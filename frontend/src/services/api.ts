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

export interface IncidentResult {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  severity: string;
  raw_traceback: string;
  expected_behavior?: string | null;
  actual_behavior?: string | null;
  reproduction_steps?: string | null;
  source_files: string[];
  buggy_code?: string | null;
  corrected_code?: string | null;
  fault_module?: string | null;
  fault_line?: number | null;
  hypothesis?: string | null;
  missing_details?: string | null;
  assumptions?: string | null;
  uncertainty_score?: number | null;
  repro_code?: string | null;
  verification_state: string;
  fixed_commit_hash?: string | null;
  evidence_hash?: string | null;
  state_a_stdout?: string | null;
  state_a_stderr?: string | null;
  state_b_stdout?: string | null;
  state_b_stderr?: string | null;
  generated_test_id?: string | null;
  created_at: string;
}

export interface IncidentVerifyResult {
  incident_id: string;
  verification_state: string;
  state_a_result: string;
  state_b_result: string;
  reproduction_proven: boolean;
  fix_proven: boolean;
  evidence_hash: string;
  duration_ms: number;
  state_a_stdout: string;
  state_a_stderr: string;
  state_b_stdout: string;
  state_b_stderr: string;
  details: string;
}

export interface IncidentPromoteResult {
  test_case_id: string;
  incident_id: string;
  project_id: string;
  name: string;
  file_path: string;
  status: string;
  evidence_hash: string;
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

  // Incident Analysis & Verification Methods
  async getProjectIncidents(projectId: string): Promise<IncidentResult[]> {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/incidents`, {
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async createIncident(projectId: string, data: any): Promise<IncidentResult> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/incidents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create incident' }));
      throw new Error(err.detail || 'Failed to create incident');
    }
    return await res.json();
  },

  async getIncident(incidentId: string): Promise<IncidentResult> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Incident not found');
    }
    return await res.json();
  },

  async updateIncident(incidentId: string, data: any): Promise<IncidentResult> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update incident' }));
      throw new Error(err.detail || 'Failed to update incident');
    }
    return await res.json();
  },

  async analyzeIncident(incidentId: string): Promise<IncidentResult> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/analyze`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Analysis failed' }));
      throw new Error(err.detail || 'Analysis failed');
    }
    return await res.json();
  },

  async verifyIncidentDualState(
    incidentId: string,
    data?: { candidate_test_code?: string; buggy_code?: string; corrected_code?: string; fixed_commit?: string }
  ): Promise<IncidentVerifyResult> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Verification failed' }));
      throw new Error(err.detail || 'Verification failed');
    }
    return await res.json();
  },

  async promoteIncidentTest(
    incidentId: string,
    data?: { name?: string; file_path?: string; test_code?: string }
  ): Promise<IncidentPromoteResult> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/promote`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Promotion failed' }));
      throw new Error(err.detail || 'Promotion failed');
    }
    return await res.json();
  },

  async exportIncidentTest(incidentId: string): Promise<string> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/export`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Export failed');
    }
    return await res.text();
  },

  // --- Phase 9: Unified Regression Protection ---
  async getProjectTestCases(projectId: string, params?: Record<string, any>): Promise<TestCaseResult[]> {
    try {
      const qs = new URLSearchParams(params || {}).toString();
      const url = `${API_BASE}/projects/${projectId}/test-cases${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async createTestCase(projectId: string, data: any): Promise<TestCaseResult> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/test-cases`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create test case' }));
      throw new Error(err.detail || 'Failed to create test case');
    }
    return await res.json();
  },

  async getTestCase(testCaseId: string): Promise<TestCaseResult> {
    const res = await fetch(`${API_BASE}/test-cases/${testCaseId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Test case not found');
    return await res.json();
  },

  async reviewTestCase(testCaseId: string, review_status: string): Promise<TestCaseResult> {
    const res = await fetch(`${API_BASE}/test-cases/${testCaseId}/review`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ review_status }),
    });
    if (!res.ok) throw new Error('Failed to update review status');
    return await res.json();
  },

  async runTestCase(testCaseId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/test-cases/${testCaseId}/run`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Test execution failed');
    return await res.json();
  },

  async checkDuplicateTestCase(projectId: string, code: string): Promise<any> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/test-cases/duplicate-check`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return { is_duplicate: false };
    return await res.json();
  },

  async exportTestCase(testCaseId: string): Promise<string> {
    const res = await fetch(`${API_BASE}/test-cases/${testCaseId}/export`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Export failed');
    return await res.text();
  },

  async getProjectExecutionRuns(projectId: string, params?: Record<string, any>): Promise<any> {
    try {
      const qs = new URLSearchParams(params || {}).toString();
      const url = `${API_BASE}/projects/${projectId}/execution-runs${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async getExecutionRun(runId: string): Promise<ExecutionRunResult> {
    const res = await fetch(`${API_BASE}/execution-runs/${runId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Execution run not found');
    return await res.json();
  },

  async getExecutionRunLogs(runId: string): Promise<{ stdout_log?: string; stderr_log?: string }> {
    const res = await fetch(`${API_BASE}/execution-runs/${runId}/logs`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Logs not found');
    return await res.json();
  },

  async getUnifiedReport(projectId?: string): Promise<UnifiedReportResult> {
    const qs = projectId ? `?project_id=${projectId}` : '';
    const res = await fetch(`${API_BASE}/reports/unified${qs}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch unified report');
    return await res.json();
  },

  async exportReport(format: 'csv' | 'json', projectId?: string): Promise<string> {
    const qs = new URLSearchParams({ format, ...(projectId ? { project_id: projectId } : {}) }).toString();
    const res = await fetch(`${API_BASE}/reports/export?${qs}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Export failed');
    return await res.text();
  },

  async getAiInsights(projectId?: string): Promise<AiInsightItem[]> {
    try {
      const qs = projectId ? `?project_id=${projectId}` : '';
      const res = await fetch(`${API_BASE}/ai-insights${qs}`, { headers: getHeaders() });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async getCiContract(): Promise<CiContractResult> {
    const res = await fetch(`${API_BASE}/ci/contract`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch CI contract');
    return await res.json();
  },

  async getGithubActionsWorkflowTemplate(): Promise<string> {
    const res = await fetch(`${API_BASE}/ci/workflow-template`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch workflow template');
    return await res.text();
  },
};

export interface TestCaseResult {
  id: string;
  project_id: string;
  name: string;
  file_path: string;
  function_name: string;
  framework: string;
  code: string;
  status: string;
  mutation_kill_count: number;
  is_flaky: boolean;
  last_run_at?: string | null;
  repository_name?: string | null;
  branch?: string | null;
  commit_sha?: string | null;
  test_type: string;
  source_incident_id?: string | null;
  source_mutation_id?: string | null;
  review_status: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  verification_status: string;
  evidence_hash?: string | null;
  evidence_details?: Record<string, any>;
  execution_history?: Array<Record<string, any>>;
  code_hash?: string | null;
  gap_resolved: boolean;
  gap_details?: string | null;
  created_at: string;
}

export interface ExecutionRunResult {
  id: string;
  project_id: string;
  trigger: string;
  trigger_label?: string | null;
  branch: string;
  commit_hash?: string | null;
  status: string;
  duration_ms: number;
  tests_passed: number;
  tests_failed: number;
  tests_skipped: number;
  tests_blocked: number;
  total_tests: number;
  started_at?: string | null;
  completed_at?: string | null;
  error_details?: string | null;
  associated_test_ids?: string[];
  associated_finding_ids?: string[];
  stdout_log?: string | null;
  stderr_log?: string | null;
  created_at: string;
}

export interface UnifiedReportResult {
  generated_at: string;
  organization_id: string;
  project_id?: string | null;
  mutation_effectiveness: {
    overall_score: number;
    total_mutants: number;
    killed_mutants: number;
    survived_mutants: number;
    timed_out_mutants: number;
    operators: Record<string, { total: number; killed: number; rate: number }>;
    surviving_mutations: Array<{
      id: string;
      file_path: string;
      line_number: number;
      operator: string;
      original_code: string;
      mutated_code: string;
      missing_boundary?: string | null;
    }>;
  };
  test_generation: {
    total_tests: number;
    verified_tests: number;
    approved_tests: number;
    pending_review: number;
    rejected_tests: number;
    mutation_killers: number;
    incident_regressions: number;
    resolved_gaps: number;
  };
  execution_history: {
    total_runs: number;
    passed_runs: number;
    failed_runs: number;
    average_duration_ms: number;
  };
  recurring_incidents: Array<{
    module: string;
    count: number;
    verified_fixed: number;
  }>;
}

export interface AiInsightItem {
  id: string;
  type: string;
  severity: string;
  target_file: string;
  line_number: number;
  title: string;
  description: string;
  suggested_fix?: string | null;
  evidence: Record<string, any>;
  uncertainty: {
    score: number;
    level: string;
    factors: string[];
  };
  verification_state: string;
  calibration_disclaimer: string;
}

export interface CiContractResult {
  version: string;
  auth_schemes: string[];
  endpoints: Record<string, string>;
  integrations: Array<{
    name: string;
    status: string;
    auth_method: string;
    description: string;
    documentation: string;
  }>;
}

