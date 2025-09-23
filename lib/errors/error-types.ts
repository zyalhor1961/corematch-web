/**
 * Types d'erreurs standardisés pour l'application CoreMatch
 */

export enum ErrorType {
  // Erreurs d'authentification
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  ACCESS_DENIED = 'ACCESS_DENIED',

  // Erreurs de validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_FORMAT = 'INVALID_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Erreurs de fichiers
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_INVALID_TYPE = 'FILE_INVALID_TYPE',
  FILE_CORRUPTED = 'FILE_CORRUPTED',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  // Erreurs de données
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  INVALID_OPERATION = 'INVALID_OPERATION',

  // Erreurs système
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Erreurs métier
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  ORGANIZATION_LIMIT_REACHED = 'ORGANIZATION_LIMIT_REACHED',
  PROJECT_LIMIT_REACHED = 'PROJECT_LIMIT_REACHED',
}

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  userMessage: string; // Message friendly pour l'utilisateur
  details?: string;
  field?: string; // Champ concerné pour les erreurs de validation
  code?: string;
  statusCode: number;
}

/**
 * Messages d'erreur standardisés et traduits
 */
export const ERROR_MESSAGES: Record<ErrorType, ErrorDetails> = {
  // Authentification
  [ErrorType.AUTH_REQUIRED]: {
    type: ErrorType.AUTH_REQUIRED,
    message: 'Authentication required',
    userMessage: 'Vous devez être connecté pour effectuer cette action',
    statusCode: 401
  },
  [ErrorType.AUTH_INVALID]: {
    type: ErrorType.AUTH_INVALID,
    message: 'Invalid authentication credentials',
    userMessage: 'Vos identifiants de connexion sont invalides',
    statusCode: 401
  },
  [ErrorType.AUTH_EXPIRED]: {
    type: ErrorType.AUTH_EXPIRED,
    message: 'Authentication session expired',
    userMessage: 'Votre session a expiré, veuillez vous reconnecter',
    statusCode: 401
  },
  [ErrorType.ACCESS_DENIED]: {
    type: ErrorType.ACCESS_DENIED,
    message: 'Access denied to this resource',
    userMessage: 'Vous n\'avez pas l\'autorisation d\'accéder à cette ressource',
    statusCode: 403
  },

  // Validation
  [ErrorType.VALIDATION_ERROR]: {
    type: ErrorType.VALIDATION_ERROR,
    message: 'Validation error',
    userMessage: 'Les données fournies ne sont pas valides',
    statusCode: 400
  },
  [ErrorType.INVALID_FORMAT]: {
    type: ErrorType.INVALID_FORMAT,
    message: 'Invalid format provided',
    userMessage: 'Le format fourni n\'est pas valide',
    statusCode: 400
  },
  [ErrorType.MISSING_REQUIRED_FIELD]: {
    type: ErrorType.MISSING_REQUIRED_FIELD,
    message: 'Required field is missing',
    userMessage: 'Un champ obligatoire est manquant',
    statusCode: 400
  },

  // Fichiers
  [ErrorType.FILE_TOO_LARGE]: {
    type: ErrorType.FILE_TOO_LARGE,
    message: 'File size exceeds maximum allowed',
    userMessage: 'Le fichier est trop volumineux (maximum 10 MB)',
    statusCode: 413
  },
  [ErrorType.FILE_INVALID_TYPE]: {
    type: ErrorType.FILE_INVALID_TYPE,
    message: 'File type not supported',
    userMessage: 'Ce type de fichier n\'est pas supporté. Formats acceptés : PDF, DOC, DOCX',
    statusCode: 415
  },
  [ErrorType.FILE_CORRUPTED]: {
    type: ErrorType.FILE_CORRUPTED,
    message: 'File appears to be corrupted',
    userMessage: 'Le fichier semble être corrompu. Veuillez essayer avec un autre fichier',
    statusCode: 422
  },
  [ErrorType.FILE_UPLOAD_FAILED]: {
    type: ErrorType.FILE_UPLOAD_FAILED,
    message: 'File upload failed',
    userMessage: 'L\'upload du fichier a échoué. Veuillez réessayer',
    statusCode: 500
  },
  [ErrorType.FILE_NOT_FOUND]: {
    type: ErrorType.FILE_NOT_FOUND,
    message: 'File not found',
    userMessage: 'Le fichier demandé est introuvable',
    statusCode: 404
  },

  // Données
  [ErrorType.RESOURCE_NOT_FOUND]: {
    type: ErrorType.RESOURCE_NOT_FOUND,
    message: 'Resource not found',
    userMessage: 'La ressource demandée est introuvable',
    statusCode: 404
  },
  [ErrorType.DUPLICATE_RESOURCE]: {
    type: ErrorType.DUPLICATE_RESOURCE,
    message: 'Resource already exists',
    userMessage: 'Cette ressource existe déjà',
    statusCode: 409
  },
  [ErrorType.INVALID_OPERATION]: {
    type: ErrorType.INVALID_OPERATION,
    message: 'Invalid operation',
    userMessage: 'Cette opération n\'est pas autorisée dans le contexte actuel',
    statusCode: 422
  },

  // Système
  [ErrorType.INTERNAL_ERROR]: {
    type: ErrorType.INTERNAL_ERROR,
    message: 'Internal server error',
    userMessage: 'Une erreur interne s\'est produite. Notre équipe technique a été notifiée',
    statusCode: 500
  },
  [ErrorType.SERVICE_UNAVAILABLE]: {
    type: ErrorType.SERVICE_UNAVAILABLE,
    message: 'Service temporarily unavailable',
    userMessage: 'Le service est temporairement indisponible. Veuillez réessayer dans quelques minutes',
    statusCode: 503
  },
  [ErrorType.RATE_LIMIT_EXCEEDED]: {
    type: ErrorType.RATE_LIMIT_EXCEEDED,
    message: 'Rate limit exceeded',
    userMessage: 'Trop de requêtes effectuées. Veuillez patienter avant de réessayer',
    statusCode: 429
  },

  // Métier
  [ErrorType.QUOTA_EXCEEDED]: {
    type: ErrorType.QUOTA_EXCEEDED,
    message: 'Quota exceeded',
    userMessage: 'Vous avez atteint la limite de votre forfait. Veuillez upgrader votre plan',
    statusCode: 402
  },
  [ErrorType.ORGANIZATION_LIMIT_REACHED]: {
    type: ErrorType.ORGANIZATION_LIMIT_REACHED,
    message: 'Organization limit reached',
    userMessage: 'Limite d\'organisations atteinte pour votre forfait',
    statusCode: 402
  },
  [ErrorType.PROJECT_LIMIT_REACHED]: {
    type: ErrorType.PROJECT_LIMIT_REACHED,
    message: 'Project limit reached',
    userMessage: 'Limite de projets atteinte pour votre organisation',
    statusCode: 402
  }
};

/**
 * Classe d'erreur personnalisée pour l'application
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly userMessage: string;
  public readonly statusCode: number;
  public readonly details?: string;
  public readonly field?: string;
  public readonly timestamp: string;

  constructor(
    type: ErrorType,
    details?: string,
    field?: string,
    cause?: Error
  ) {
    const errorInfo = ERROR_MESSAGES[type];
    super(errorInfo.message);

    this.name = 'AppError';
    this.type = type;
    this.userMessage = errorInfo.userMessage;
    this.statusCode = errorInfo.statusCode;
    this.details = details;
    this.field = field;
    this.timestamp = new Date().toISOString();

    if (cause) {
      this.cause = cause;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Retourne un objet JSON sérialisable pour l'API
   */
  toJSON() {
    return {
      error: {
        type: this.type,
        message: this.message,
        userMessage: this.userMessage,
        details: this.details,
        field: this.field,
        timestamp: this.timestamp,
        statusCode: this.statusCode
      }
    };
  }

  /**
   * Retourne un objet pour les logs
   */
  toLogFormat() {
    return {
      type: this.type,
      message: this.message,
      details: this.details,
      field: this.field,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}