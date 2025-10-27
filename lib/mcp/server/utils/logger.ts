/**
 * Logger utilitaire avec masquage PII pour production
 */

const isProd = process.env.NODE_ENV === 'production';

/**
 * Masque les identifiants sensibles
 */
export function maskId(id: string): string {
  if (!isProd) return id; // En dev, montrer tout

  // Garder 4 premiers + 4 derniers caractères
  if (id.length <= 12) return '***masked***';
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

/**
 * Log avec masquage automatique des PII
 */
export function logMcp(
  tool: string,
  level: 'info' | 'error' | 'warn',
  message: string,
  data?: Record<string, any>
) {
  const maskedData = data
    ? Object.entries(data).reduce((acc, [key, value]) => {
        // Masquer les IDs
        if (key.includes('Id') || key === 'id') {
          acc[key] = typeof value === 'string' ? maskId(value) : value;
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>)
    : undefined;

  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (maskedData) {
    logFn(`[${tool}] ${message}`, maskedData);
  } else {
    logFn(`[${tool}] ${message}`);
  }
}
