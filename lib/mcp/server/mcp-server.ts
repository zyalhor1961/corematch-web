/**
 * Corematch MCP Server
 *
 * Serveur MCP standalone qui expose les tools d'analyse CV via le protocol MCP.
 *
 * Tools disponibles:
 * - analyze_cv: Analyser un CV contre un JobSpec
 * - get_candidates: Lister les candidats d'un projet
 *
 * Auth: Supporte Bearer token (Supabase) et ApiKey (MCP API Keys)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Tools
import { analyzeCV, type AnalyzeCVArgs } from './tools/analyze-cv';
import { getCandidates, type GetCandidatesArgs } from './tools/get-candidates';

// Middleware
import { authMiddleware, extractAuthHeader } from './middleware/auth-middleware';

/**
 * Démarrer le serveur MCP Corematch
 */
export async function startMCPServer() {
  // IMPORTANT: Utiliser console.error pour les logs car console.log pollue stdout (protocole MCP)
  console.error('🚀 Starting Corematch MCP Server...\n');

  // =========================================================================
  // Créer serveur MCP
  // =========================================================================

  const server = new Server(
    {
      name: 'corematch-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // =========================================================================
  // Handler: tools/list - Lister les tools disponibles
  // =========================================================================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'analyze_cv',
          description:
            'Analyser un CV contre un JobSpec. Retourne recommendation, score, strengths, weaknesses, et coût.',
          inputSchema: {
            type: 'object',
            properties: {
              candidateId: {
                type: 'string',
                description: 'ID du candidat (UUID)',
              },
              projectId: {
                type: 'string',
                description: 'ID du projet de recrutement (UUID)',
              },
              mode: {
                type: 'string',
                enum: ['eco', 'balanced', 'premium'],
                description:
                  'Mode d\'analyse: eco (rapide, 1 provider), balanced (2-3 providers), premium (3 providers + arbiter)',
                default: 'balanced',
              },
              forceReanalysis: {
                type: 'boolean',
                description: 'Forcer réanalyse (ignore cache)',
                default: false,
              },
            },
            required: ['candidateId', 'projectId'],
          },
        },
        {
          name: 'get_candidates',
          description:
            'Lister les candidats d\'un projet avec leurs statuts d\'analyse. Retourne liste paginée.',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'ID du projet de recrutement (UUID)',
              },
              limit: {
                type: 'number',
                description: 'Nombre de candidats à retourner (défaut: 50)',
                default: 50,
              },
              offset: {
                type: 'number',
                description: 'Offset pour pagination (défaut: 0)',
                default: 0,
              },
              status: {
                type: 'string',
                enum: ['all', 'analyzed', 'pending'],
                description: 'Filtrer par statut (défaut: all)',
                default: 'all',
              },
            },
            required: ['projectId'],
          },
        },
      ],
    };
  });

  // =========================================================================
  // Handler: tools/call - Exécuter un tool
  // =========================================================================

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error(`\n📞 Tool call: ${name}`);
    console.error(`   Args: ${JSON.stringify(args, null, 2)}`);

    try {
      // =====================================================================
      // 1. Authentification
      // =====================================================================

      // Note: MCP SDK ne passe pas encore meta/auth, utiliser env var temporairement
      const authHeader = process.env.MCP_AUTH_HEADER || undefined;
      const context = await authMiddleware(authHeader);

      console.error(`✅ Auth: ${context.authUser?.type}:${context.authUser?.id}`);

      // =====================================================================
      // 2. Router vers le bon tool
      // =====================================================================

      let result: any;

      switch (name) {
        case 'analyze_cv':
          result = await analyzeCV(args as any, context.authUser);
          break;

        case 'get_candidates':
          result = await getCandidates(args as any, context.authUser);
          break;

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      // =====================================================================
      // 3. Retourner résultat au format MCP
      // =====================================================================

      console.error(`✅ Tool ${name} completed successfully\n`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.error(`❌ Tool ${name} failed:`, error);

      // Erreurs MCP spécifiques
      if (error instanceof McpError) {
        throw error;
      }

      // Erreurs custom avec codes
      if (error.message.startsWith('AUTH_REQUIRED')) {
        throw new McpError(ErrorCode.InvalidRequest, error.message);
      }

      if (
        error.message.startsWith('PERMISSION_DENIED') ||
        error.message.startsWith('ACCESS_DENIED')
      ) {
        throw new McpError(ErrorCode.InvalidRequest, error.message);
      }

      if (
        error.message.startsWith('CANDIDATE_NOT_FOUND') ||
        error.message.startsWith('PROJECT_NOT_FOUND')
      ) {
        throw new McpError(ErrorCode.InvalidRequest, error.message);
      }

      // Erreur générique
      throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
    }
  });

  // =========================================================================
  // Démarrer serveur avec transport stdio
  // =========================================================================

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('✅ Corematch MCP Server running');
  console.error('   Waiting for requests via stdio...\n');
}

/**
 * Gérer shutdown graceful
 */
process.on('SIGINT', () => {
  console.error('\n👋 Shutting down Corematch MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n👋 Shutting down Corematch MCP Server...');
  process.exit(0);
});
