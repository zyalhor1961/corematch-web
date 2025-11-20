/**
 * Configurable Logger for Graph Orchestration
 *
 * Allows control over logging verbosity without hard-coded console.log statements
 */

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  verbose: 5,
};

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || (process.env.LOG_LEVEL as LogLevel) || 'info',
      prefix: config.prefix || '[Graph]',
      timestamp: config.timestamp ?? false,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: string, message: string): string {
    const parts: string[] = [];

    if (this.config.timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    if (this.config.prefix) {
      parts.push(this.config.prefix);
    }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);

    return parts.join(' ');
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  verbose(message: string, ...args: any[]): void {
    if (this.shouldLog('verbose')) {
      console.log(this.formatMessage('verbose', message), ...args);
    }
  }

  /**
   * Create a child logger with a different prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix} ${prefix}`,
    });
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Default logger instance
export const logger = new Logger();

// Factory for creating loggers
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}
