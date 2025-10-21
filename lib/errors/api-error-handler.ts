import { NextResponse } from 'next/server';
import { AppError, ErrorType, ERROR_MESSAGES } from './error-types';
import { logSecurityEvent } from '../auth/middleware';

/**
 * Gestionnaire centralisé d'erreurs pour les APIs
 */
export class ApiErrorHandler {
  /**
   * Traite une erreur et retourne une réponse API appropriée
   */
  static handleError(error: unknown, userId?: string, route?: string): NextResponse {
    let appError: AppError;

    // Convertir l'erreur en AppError si nécessaire
    if (error instanceof AppError) {
      appError = error;
    } else if (error instanceof Error) {
      // Détecter le type d'erreur automatiquement
      appError = this.categorizeError(error);
    } else {
      // Erreur inconnue
      appError = new AppError(ErrorType.INTERNAL_ERROR, String(error));
    }

    // Logger l'erreur pour le monitoring
    this.logError(appError, userId, route);

    // Retourner la réponse API
    return NextResponse.json(
      appError.toJSON(),
      { status: appError.statusCode }
    );
  }

  /**
   * Catégorise automatiquement une erreur générique
   */
  private static categorizeError(error: Error): AppError {
    const message = error.message.toLowerCase();

    // Erreurs de base de données
    if (message.includes('duplicate') || message.includes('unique constraint')) {
      return new AppError(ErrorType.DUPLICATE_RESOURCE, error.message);
    }

    if (message.includes('not found') || message.includes('no rows')) {
      return new AppError(ErrorType.RESOURCE_NOT_FOUND, error.message);
    }

    // Erreurs de validation
    if (message.includes('validation') || message.includes('invalid')) {
      return new AppError(ErrorType.VALIDATION_ERROR, error.message);
    }

    // Erreurs d'authentification
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return new AppError(ErrorType.AUTH_REQUIRED, error.message);
    }

    if (message.includes('forbidden') || message.includes('access denied')) {
      return new AppError(ErrorType.ACCESS_DENIED, error.message);
    }

    // Erreurs de fichiers
    if (message.includes('file') && message.includes('size')) {
      return new AppError(ErrorType.FILE_TOO_LARGE, error.message);
    }

    if (message.includes('file') && (message.includes('type') || message.includes('format'))) {
      return new AppError(ErrorType.FILE_INVALID_TYPE, error.message);
    }

    // Par défaut, erreur interne
    return new AppError(ErrorType.INTERNAL_ERROR, error.message);
  }

  /**
   * Log l'erreur pour le monitoring et debugging
   */
  private static logError(error: AppError, userId?: string, route?: string) {
    // Log standard pour debugging
    console.error('[API_ERROR]', {
      ...error.toLogFormat(),
      userId,
      route
    });

    // Log de sécurité si applicable
    if (userId && route && this.isSecurityRelevant(error.type)) {
      logSecurityEvent({
        type: this.getSecurityEventType(error.type),
        userId,
        route,
        details: `${error.type}: ${error.message}`
      });
    }

    // TODO: En production, envoyer à un service de monitoring
    // Exemples: Sentry, LogRocket, Datadog, etc.
    if (process.env.NODE_ENV === 'production') {
      // await sendToMonitoringService(error);
    }
  }

  /**
   * Détermine si l'erreur est pertinente pour la sécurité
   */
  private static isSecurityRelevant(errorType: ErrorType): boolean {
    const securityTypes = [
      ErrorType.AUTH_REQUIRED,
      ErrorType.AUTH_INVALID,
      ErrorType.ACCESS_DENIED,
      ErrorType.RATE_LIMIT_EXCEEDED
    ];
    return securityTypes.includes(errorType);
  }

  /**
   * Convertit le type d'erreur en type d'événement de sécurité
   */
  private static getSecurityEventType(errorType: ErrorType): 'AUTH_FAILURE' | 'ACCESS_DENIED' | 'SUSPICIOUS_ACTIVITY' {
    switch (errorType) {
      case ErrorType.AUTH_REQUIRED:
      case ErrorType.AUTH_INVALID:
        return 'AUTH_FAILURE';
      case ErrorType.ACCESS_DENIED:
        return 'ACCESS_DENIED';
      default:
        return 'SUSPICIOUS_ACTIVITY';
    }
  }
}

/**
 * Validateurs spécifiques pour différents types de données
 */
export class ValidationHelper {
  /**
   * Valide un fichier uploadé
   */
  static validateFile(file: File, options: {
    maxSizeBytes?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}): void {
    const {
      maxSizeBytes = 10 * 1024 * 1024, // 10MB par défaut
      allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      allowedExtensions = ['.pdf', '.doc', '.docx']
    } = options;

    // ===== SECURITY CHECK 1: Validate file name =====
    // Reject files with suspicious characters or patterns
    const fileName = file.name;

    // Check for null bytes (common attack vector)
    if (fileName.includes('\0')) {
      throw new AppError(
        ErrorType.FILE_INVALID_TYPE,
        'File name contains null bytes (security violation)'
      );
    }

    // Check for path traversal attempts
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      throw new AppError(
        ErrorType.FILE_INVALID_TYPE,
        'File name contains path traversal characters (security violation)'
      );
    }

    // Check for suspicious extensions that could be double-extensions
    // e.g., "malware.exe.pdf" or "virus.js.doc"
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jar', '.app', '.sh', '.ps1', '.msi', '.dll'];
    for (const ext of suspiciousExtensions) {
      if (fileName.toLowerCase().includes(ext)) {
        throw new AppError(
          ErrorType.FILE_INVALID_TYPE,
          `File name contains suspicious extension ${ext} (security violation)`
        );
      }
    }

    // Check filename length (prevent buffer overflow attacks)
    if (fileName.length > 255) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'File name too long (max 255 characters)'
      );
    }

    // Check for hidden files or system files
    if (fileName.startsWith('.') || fileName.startsWith('~')) {
      throw new AppError(
        ErrorType.FILE_INVALID_TYPE,
        'Hidden or system files are not allowed'
      );
    }

    // ===== SECURITY CHECK 2: Validate file size =====
    // Reject empty files
    if (file.size === 0) {
      throw new AppError(
        ErrorType.FILE_CORRUPTED,
        'File is empty'
      );
    }

    // Reject files that are too large
    if (file.size > maxSizeBytes) {
      throw new AppError(
        ErrorType.FILE_TOO_LARGE,
        `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB`
      );
    }

    // Reject suspiciously small files (could be malformed)
    if (file.size < 100) { // Less than 100 bytes is suspicious for a CV
      throw new AppError(
        ErrorType.FILE_CORRUPTED,
        'File is too small to be a valid document (potential security issue)'
      );
    }

    // ===== SECURITY CHECK 3: Validate MIME type =====
    // Reject files without a MIME type
    if (!file.type || file.type === '') {
      throw new AppError(
        ErrorType.FILE_INVALID_TYPE,
        'File has no MIME type (security violation)'
      );
    }

    // Verify MIME type is in allowed list
    if (!allowedTypes.includes(file.type)) {
      throw new AppError(
        ErrorType.FILE_INVALID_TYPE,
        `File type ${file.type} is not allowed. Only PDF, DOC, and DOCX files are accepted`
      );
    }

    // ===== SECURITY CHECK 4: Validate file extension =====
    const lastDotIndex = fileName.lastIndexOf('.');

    // File must have an extension
    if (lastDotIndex === -1) {
      throw new AppError(
        ErrorType.FILE_INVALID_TYPE,
        'File has no extension'
      );
    }

    const extension = fileName.toLowerCase().substring(lastDotIndex);

    // Extension must be in allowed list
    if (!allowedExtensions.includes(extension)) {
      throw new AppError(
        ErrorType.FILE_INVALID_TYPE,
        `File extension ${extension} is not allowed. Only .pdf, .doc, and .docx files are accepted`
      );
    }

    // ===== SECURITY CHECK 5: Cross-validate MIME type and extension =====
    // Ensure MIME type matches the file extension
    const mimeExtensionMap: { [key: string]: string[] } = {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    };

    const expectedExtensions = mimeExtensionMap[file.type];
    if (expectedExtensions && !expectedExtensions.includes(extension)) {
      throw new AppError(
        ErrorType.FILE_INVALID_TYPE,
        `File extension ${extension} does not match MIME type ${file.type} (potential file spoofing)`
      );
    }
  }

  /**
   * Valide les données d'un projet
   */
  static validateProjectData(data: any): void {
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new AppError(
        ErrorType.MISSING_REQUIRED_FIELD,
        'Project name is required',
        'name'
      );
    }

    if (data.name.length > 255) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Project name must be less than 255 characters',
        'name'
      );
    }

    if (!data.orgId || typeof data.orgId !== 'string') {
      throw new AppError(
        ErrorType.MISSING_REQUIRED_FIELD,
        'Organization ID is required',
        'orgId'
      );
    }

    // Valider le format UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(data.orgId)) {
      throw new AppError(
        ErrorType.INVALID_FORMAT,
        'Organization ID must be a valid UUID',
        'orgId'
      );
    }
  }

  /**
   * Valide une adresse email
   */
  static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError(
        ErrorType.INVALID_FORMAT,
        'Invalid email format',
        'email'
      );
    }
  }
}

/**
 * Helper pour créer des réponses d'erreur rapides
 */
export const ErrorResponses = {
  authRequired: () => ApiErrorHandler.handleError(new AppError(ErrorType.AUTH_REQUIRED)),
  accessDenied: () => ApiErrorHandler.handleError(new AppError(ErrorType.ACCESS_DENIED)),
  notFound: (resource?: string) => ApiErrorHandler.handleError(
    new AppError(ErrorType.RESOURCE_NOT_FOUND, resource ? `${resource} not found` : undefined)
  ),
  validation: (details?: string, field?: string) => ApiErrorHandler.handleError(
    new AppError(ErrorType.VALIDATION_ERROR, details, field)
  ),
  fileTooLarge: () => ApiErrorHandler.handleError(new AppError(ErrorType.FILE_TOO_LARGE)),
  fileInvalidType: () => ApiErrorHandler.handleError(new AppError(ErrorType.FILE_INVALID_TYPE)),
  internal: (details?: string) => ApiErrorHandler.handleError(
    new AppError(ErrorType.INTERNAL_ERROR, details)
  )
};