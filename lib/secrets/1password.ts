/**
 * 1Password CLI Integration
 *
 * Ce module gère la récupération sécurisée des secrets depuis 1Password CLI (op).
 *
 * Architecture de sécurité :
 * - Tous les secrets sont stockés dans 1Password (vault "CoreMatch")
 * - Pas de secrets en clair dans .env ou code
 * - Cache en mémoire pour performances (invalide au restart)
 * - Fallback vers variables d'environnement en développement uniquement
 *
 * @see https://developer.1password.com/docs/cli/
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Cache en mémoire des secrets (invalide au restart du serveur)
 * Évite les appels répétés à `op` CLI
 */
const secretsCache = new Map<string, { value: string; timestamp: number }>();

/**
 * TTL du cache : 5 minutes
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Configuration des secrets 1Password
 */
export const SECRETS_CONFIG = {
  SUPABASE_SERVICE_ROLE_KEY: {
    reference: 'op://CoreMatch/Supabase Service Role/password',
    vault: 'CoreMatch',
    item: 'Supabase Service Role',
    field: 'password',
  },
  SUPABASE_URL: {
    reference: 'op://CoreMatch/Supabase URL/password',
    vault: 'CoreMatch',
    item: 'Supabase URL',
    field: 'password',
  },
  MCP_AUTH_HEADER: {
    reference: 'op://CoreMatch/MCP Auth Header/password',
    vault: 'CoreMatch',
    item: 'MCP Auth Header',
    field: 'password',
  },
  OPENAI_API_KEY: {
    reference: 'op://CoreMatch/OpenAI API Key/password',
    vault: 'CoreMatch',
    item: 'OpenAI API Key',
    field: 'password',
  },
  GEMINI_API_KEY: {
    reference: 'op://CoreMatch/Gemini API Key/password',
    vault: 'CoreMatch',
    item: 'Gemini API Key',
    field: 'password',
  },
  ANTHROPIC_API_KEY: {
    reference: 'op://CoreMatch/Anthropic API Key/password',
    vault: 'CoreMatch',
    item: 'Anthropic API Key',
    field: 'password',
  },
  VA_API_KEY: {
    reference: 'op://CoreMatch/Landing AI Vision Agent/password',
    vault: 'CoreMatch',
    item: 'Landing AI Vision Agent',
    field: 'password',
  },
  AZURE_DI_ENDPOINT: {
    reference: 'op://CoreMatch/Azure Document Intelligence/endpoint',
    vault: 'CoreMatch',
    item: 'Azure Document Intelligence',
    field: 'endpoint',
  },
  AZURE_DI_API_KEY: {
    reference: 'op://CoreMatch/Azure Document Intelligence/api_key',
    vault: 'CoreMatch',
    item: 'Azure Document Intelligence',
    field: 'api_key',
  },
} as const;

export type SecretKey = keyof typeof SECRETS_CONFIG;

/**
 * Vérifie si 1Password CLI est installé et authentifié
 */
export async function check1PasswordCLI(): Promise<{ installed: boolean; authenticated: boolean; error?: string }> {
  try {
    // Vérifier si `op` est installé
    await execAsync('op --version');

    // Vérifier si l'utilisateur est authentifié
    try {
      await execAsync('op whoami');
      return { installed: true, authenticated: true };
    } catch (authError) {
      return {
        installed: true,
        authenticated: false,
        error: 'Not authenticated. Run: op signin'
      };
    }
  } catch (installError) {
    return {
      installed: false,
      authenticated: false,
      error: '1Password CLI not installed. Download from: https://developer.1password.com/docs/cli/get-started/'
    };
  }
}

/**
 * Récupère un secret depuis 1Password CLI
 *
 * @param secretKey - Nom du secret (voir SECRETS_CONFIG)
 * @param options.skipCache - Ignorer le cache et forcer la récupération
 * @param options.fallbackToEnv - Utiliser process.env en cas d'échec (dev seulement)
 * @returns La valeur du secret
 * @throws Error si le secret n'est pas accessible
 */
export async function getSecret(
  secretKey: SecretKey,
  options: { skipCache?: boolean; preferEnv?: boolean } = {}
): Promise<string> {
  const { skipCache = false, preferEnv = true } = options;

  // Vérifier le cache
  if (!skipCache) {
    const cached = secretsCache.get(secretKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.value;
    }
  }

  const config = SECRETS_CONFIG[secretKey];
  if (!config) {
    throw new Error(`Unknown secret: ${secretKey}`);
  }

  // 1. Essayer d'abord les variables d'environnement (Vercel/production)
  // For SUPABASE_URL, also check NEXT_PUBLIC_SUPABASE_URL
  const envValue = process.env[secretKey] ||
    (secretKey === 'SUPABASE_URL' ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined);

  if (preferEnv && envValue) {
    console.log(`[1Password] Using environment variable for ${secretKey}`);
    // Mettre en cache
    secretsCache.set(secretKey, { value: envValue, timestamp: Date.now() });
    return envValue;
  }

  // 2. Fallback vers 1Password CLI (dev local only)
  // Skip 1Password in production environments (Vercel, etc.)
  const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';

  if (isProduction) {
    throw new Error(
      `Secret ${secretKey} not found in environment variables. Required in production: ${secretKey}${secretKey === 'SUPABASE_URL' ? ' or NEXT_PUBLIC_SUPABASE_URL' : ''}`
    );
  }

  // Only try 1Password in development
  try {
    console.log(`[1Password] Reading from 1Password vault for ${secretKey}...`);
    const { stdout } = await execAsync(`op read "${config.reference}"`);
    const value = stdout.trim();
    console.log(`[1Password] ✓ Successfully read from 1Password for ${secretKey}`);

    if (!value) {
      throw new Error(`Empty value for secret: ${secretKey}`);
    }

    // Mettre en cache
    secretsCache.set(secretKey, { value, timestamp: Date.now() });

    return value;
  } catch (error) {
    throw new Error(
      `Failed to get secret ${secretKey}: Not found in environment variables and 1Password failed (${error instanceof Error ? error.message : 'Unknown error'})`
    );
  }
}

/**
 * Récupère plusieurs secrets en parallèle
 *
 * @param secretKeys - Liste des clés à récupérer
 * @returns Objet avec tous les secrets
 */
export async function getSecrets<K extends SecretKey>(
  secretKeys: K[]
): Promise<Record<K, string>> {
  const results = await Promise.all(
    secretKeys.map(async (key) => {
      try {
        const value = await getSecret(key);
        return { key, value, error: null };
      } catch (error) {
        return { key, value: null, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    })
  );

  const secrets: Partial<Record<K, string>> = {};
  const errors: string[] = [];

  for (const result of results) {
    if (result.error) {
      errors.push(`${result.key}: ${result.error}`);
    } else if (result.value) {
      secrets[result.key] = result.value;
    }
  }

  if (errors.length > 0) {
    throw new Error(`Failed to get secrets:\n${errors.join('\n')}`);
  }

  return secrets as Record<K, string>;
}

/**
 * Invalide le cache (utile pour rotation des secrets)
 */
export function invalidateCache(secretKey?: SecretKey): void {
  if (secretKey) {
    secretsCache.delete(secretKey);
  } else {
    secretsCache.clear();
  }
}

/**
 * Récupère tous les secrets nécessaires pour Supabase
 */
export async function getSupabaseSecrets(): Promise<{
  url: string;
  serviceRoleKey: string;
}> {
  const secrets = await getSecrets(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  return {
    url: secrets.SUPABASE_URL,
    serviceRoleKey: secrets.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/**
 * Récupère tous les secrets nécessaires pour MCP
 */
export async function getMCPSecrets(): Promise<{
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  mcpAuthHeader: string;
}> {
  const secrets = await getSecrets(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MCP_AUTH_HEADER']);
  return {
    supabaseUrl: secrets.SUPABASE_URL,
    supabaseServiceRoleKey: secrets.SUPABASE_SERVICE_ROLE_KEY,
    mcpAuthHeader: secrets.MCP_AUTH_HEADER,
  };
}

/**
 * Récupère tous les secrets pour les providers IA
 */
export async function getAIProviderSecrets(): Promise<{
  openai?: string;
  gemini?: string;
  anthropic?: string;
}> {
  const secrets: Record<string, string | undefined> = {};

  // Récupérer chaque secret individuellement (certains peuvent être optionnels)
  for (const key of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY'] as const) {
    try {
      secrets[key] = await getSecret(key);
    } catch (error) {
      // Les clés IA sont optionnelles
      console.warn(`[1Password] ${key} not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    openai: secrets.OPENAI_API_KEY,
    gemini: secrets.GEMINI_API_KEY,
    anthropic: secrets.ANTHROPIC_API_KEY,
  };
}

/**
 * Utilitaire pour logger les erreurs de secrets de manière sécurisée
 * (ne jamais logger la valeur réelle)
 */
export function logSecretError(secretKey: string, error: unknown): void {
  const sanitizedError = error instanceof Error
    ? error.message.substring(0, 100)
    : 'Unknown error';

  console.error(`[1Password Security] Failed to access secret ${secretKey}: ${sanitizedError}`);
}
