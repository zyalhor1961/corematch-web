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

    // Vérifier la taille
    if (file.size > maxSizeBytes) {
      throw new AppError(
        ErrorType.FILE_TOO_LARGE,
        `File size ${file.size} bytes exceeds maximum ${maxSizeBytes} bytes`
      );
    }

    // Vérifier le type MIME
    if (!allowedTypes.includes(file.type)) {
      throw new AppError(
        ErrorType.FILE_INVALID_TYPE,
        `File type ${file.type} not in allowed types: ${allowedTypes.join(', ')}`
      );
    }

    // Vérifier l'extension
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(extension)) {
      throw new AppError(
        ErrorType.FILE_INVALID_TYPE,
        `File extension ${extension} not in allowed extensions: ${allowedExtensions.join(', ')}`
      );
    }

    // Vérifier que le fichier n'est pas vide
    if (file.size === 0) {
      throw new AppError(
        ErrorType.FILE_CORRUPTED,
        'File is empty'
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