/**
 * Client HTTP pour le proxy MCP
 *
 * Remplace les appels directs à supabaseAdmin
 * par des requêtes HTTP vers /api/mcp-proxy
 */

export interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  cv_url: string | null;
  score: number | null;
  evaluation_result: any | null;
  consent_mcp: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  requirements: string | null;
  job_spec_config: any | null;
}

export class McpProxyClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    // En mode MCP local, appeler l'app Next.js
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    this.apiKey = apiKey || process.env.MCP_AUTH_HEADER || '';
  }

  private async request(method: 'GET' | 'POST', endpoint: string, body?: any) {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'UNKNOWN_ERROR' }));
      throw new Error(`MCP Proxy Error: ${error.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Récupérer les candidats d'un projet
   */
  async getCandidates(projectId: string): Promise<Candidate[]> {
    const result = await this.request('GET', `/api/mcp-proxy?action=get_candidates&projectId=${projectId}`);
    return result.candidates || [];
  }

  /**
   * Récupérer un candidat spécifique
   */
  async getCandidate(candidateId: string): Promise<Candidate> {
    const result = await this.request('GET', `/api/mcp-proxy?action=get_candidate&candidateId=${candidateId}`);
    return result.candidate;
  }

  /**
   * Récupérer les détails d'un projet
   */
  async getProject(projectId: string): Promise<Project> {
    const result = await this.request('GET', `/api/mcp-proxy?action=get_project&projectId=${projectId}`);
    return result.project;
  }

  /**
   * Sauvegarder une analyse de CV
   */
  async saveAnalysis(candidateId: string, analysis: any): Promise<void> {
    await this.request('POST', '/api/mcp-proxy', {
      action: 'save_analysis',
      candidateId,
      analysis,
    });
  }
}

/**
 * Instance singleton du client
 */
let _clientInstance: McpProxyClient | null = null;

export function getMcpProxyClient(): McpProxyClient {
  if (!_clientInstance) {
    _clientInstance = new McpProxyClient();
  }
  return _clientInstance;
}
