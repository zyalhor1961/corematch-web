/**
 * Gestionnaire d'erreurs côté client pour l'application CoreMatch
 */

import { ErrorType } from './error-types';

export interface ClientError {
  type: ErrorType | string;
  message: string;
  userMessage: string;
  details?: string;
  field?: string;
  statusCode?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ClientError;
  message?: string;
}

/**
 * Gestionnaire centralisé d'erreurs côté client
 */
export class ClientErrorHandler {
  /**
   * Traite une réponse fetch et extrait les erreurs
   */
  static async handleFetchResponse<T = any>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();

      if (!response.ok) {
        // La réponse contient une erreur
        const error = this.extractErrorFromResponse(data, response.status);
        return {
          success: false,
          error
        };
      }

      // Réponse réussie
      return {
        success: true,
        data: data.data || data,
        message: data.message
      };

    } catch (parseError) {
      // Erreur de parsing JSON
      return {
        success: false,
        error: {
          type: ErrorType.INTERNAL_ERROR,
          message: 'Invalid response format',
          userMessage: 'Erreur de communication avec le serveur',
          details: parseError instanceof Error ? parseError.message : 'JSON parse error',
          statusCode: response.status
        }
      };
    }
  }

  /**
   * Extrait les informations d'erreur d'une réponse API
   */
  private static extractErrorFromResponse(data: any, statusCode: number): ClientError {
    // Format d'erreur standardisé (notre nouveau système)
    if (data.error && typeof data.error === 'object') {
      return {
        type: data.error.type || this.getErrorTypeFromStatus(statusCode),
        message: data.error.message || 'Unknown error',
        userMessage: data.error.userMessage || this.getDefaultUserMessage(statusCode),
        details: data.error.details,
        field: data.error.field,
        statusCode
      };
    }

    // Format d'erreur simple (string)
    if (typeof data.error === 'string') {
      return {
        type: this.getErrorTypeFromStatus(statusCode),
        message: data.error,
        userMessage: this.getUserFriendlyMessage(data.error, statusCode),
        statusCode
      };
    }

    // Message d'erreur dans une autre propriété
    if (data.message) {
      return {
        type: this.getErrorTypeFromStatus(statusCode),
        message: data.message,
        userMessage: this.getUserFriendlyMessage(data.message, statusCode),
        statusCode
      };
    }

    // Erreur générique basée sur le status code
    return {
      type: this.getErrorTypeFromStatus(statusCode),
      message: `HTTP ${statusCode}`,
      userMessage: this.getDefaultUserMessage(statusCode),
      statusCode
    };
  }

  /**
   * Détermine le type d'erreur basé sur le code de statut HTTP
   */
  private static getErrorTypeFromStatus(statusCode: number): ErrorType {
    switch (statusCode) {
      case 400:
        return ErrorType.VALIDATION_ERROR;
      case 401:
        return ErrorType.AUTH_REQUIRED;
      case 403:
        return ErrorType.ACCESS_DENIED;
      case 404:
        return ErrorType.RESOURCE_NOT_FOUND;
      case 409:
        return ErrorType.DUPLICATE_RESOURCE;
      case 413:
        return ErrorType.FILE_TOO_LARGE;
      case 415:
        return ErrorType.FILE_INVALID_TYPE;
      case 422:
        return ErrorType.VALIDATION_ERROR;
      case 429:
        return ErrorType.RATE_LIMIT_EXCEEDED;
      case 500:
        return ErrorType.INTERNAL_ERROR;
      case 503:
        return ErrorType.SERVICE_UNAVAILABLE;
      default:
        return ErrorType.INTERNAL_ERROR;
    }
  }

  /**
   * Obtient un message utilisateur par défaut basé sur le code de statut
   */
  private static getDefaultUserMessage(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return 'Les données fournies ne sont pas valides';
      case 401:
        return 'Vous devez être connecté pour effectuer cette action';
      case 403:
        return 'Vous n\'avez pas l\'autorisation d\'effectuer cette action';
      case 404:
        return 'La ressource demandée est introuvable';
      case 409:
        return 'Cette ressource existe déjà';
      case 413:
        return 'Le fichier est trop volumineux';
      case 415:
        return 'Ce type de fichier n\'est pas supporté';
      case 422:
        return 'Les données fournies ne sont pas valides';
      case 429:
        return 'Trop de requêtes effectuées. Veuillez patienter';
      case 500:
        return 'Une erreur interne s\'est produite';
      case 503:
        return 'Le service est temporairement indisponible';
      default:
        return 'Une erreur s\'est produite';
    }
  }

  /**
   * Améliore un message d'erreur générique en un message plus convivial
   */
  private static getUserFriendlyMessage(message: string, statusCode: number): string {
    const lowerMessage = message.toLowerCase();

    // Messages d'authentification
    if (lowerMessage.includes('authentication') || lowerMessage.includes('unauthorized')) {
      return 'Vous devez être connecté pour effectuer cette action';
    }

    if (lowerMessage.includes('access denied') || lowerMessage.includes('forbidden')) {
      return 'Vous n\'avez pas l\'autorisation d\'effectuer cette action';
    }

    // Messages de fichiers
    if (lowerMessage.includes('file size') || lowerMessage.includes('too large')) {
      return 'Le fichier est trop volumineux (maximum 10 MB)';
    }

    if (lowerMessage.includes('file type') || lowerMessage.includes('not supported')) {
      return 'Ce type de fichier n\'est pas supporté. Formats acceptés : PDF, DOC, DOCX';
    }

    if (lowerMessage.includes('quota') || lowerMessage.includes('limit')) {
      return 'Vous avez atteint la limite de votre forfait';
    }

    // Messages réseau
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'Erreur de connexion. Vérifiez votre connexion internet';
    }

    // Si aucune amélioration spécifique, utiliser le message par défaut
    if (message === `HTTP ${statusCode}`) {
      return this.getDefaultUserMessage(statusCode);
    }

    // Retourner le message original s'il semble déjà convivial
    return message;
  }

  /**
   * Traite les erreurs de réseau (fetch failed, etc.)
   */
  static handleNetworkError(error: Error): ClientError {
    return {
      type: ErrorType.SERVICE_UNAVAILABLE,
      message: error.message,
      userMessage: 'Erreur de connexion. Vérifiez votre connexion internet et réessayez',
      details: error.name === 'TypeError' ? 'Network request failed' : error.message
    };
  }
}

/**
 * Wrapper pour fetch avec gestion d'erreurs automatique
 */
export async function fetchWithErrorHandling<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    return await ClientErrorHandler.handleFetchResponse<T>(response);

  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: ClientErrorHandler.handleNetworkError(error)
      };
    }

    return {
      success: false,
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message: 'Unknown error occurred',
        userMessage: 'Une erreur inattendue s\'est produite',
        details: String(error)
      }
    };
  }
}

/**
 * Utilitaires spécifiques pour les opérations communes
 */
export const ApiUtils = {
  /**
   * Upload de fichiers avec gestion d'erreurs
   */
  async uploadFiles(projectId: string, files: FileList): Promise<ApiResponse> {
    const formData = new FormData();

    // Ajouter tous les fichiers au FormData
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    return fetchWithErrorHandling(`/api/cv/projects/${projectId}/upload`, {
      method: 'POST',
      body: formData,
      headers: {} // Laisser le navigateur définir le Content-Type pour multipart/form-data
    });
  },

  /**
   * Récupération des projets avec gestion d'erreurs
   */
  async getProjects(orgId: string): Promise<ApiResponse> {
    return fetchWithErrorHandling(`/api/cv/projects?orgId=${orgId}`);
  },

  /**
   * Récupération des candidats avec gestion d'erreurs
   */
  async getCandidates(projectId: string): Promise<ApiResponse> {
    return fetchWithErrorHandling(`/api/cv/projects/${projectId}/candidates`);
  },

  /**
   * Création d'un projet avec gestion d'erreurs
   */
  async createProject(projectData: any): Promise<ApiResponse> {
    return fetchWithErrorHandling('/api/cv/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
  }
};

/**
 * Hook React pour gérer les erreurs et les états de chargement
 */
export function createApiHook() {
  return {
    isLoading: false,
    error: null as ClientError | null,
    setLoading: (loading: boolean) => {},
    setError: (error: ClientError | null) => {},
    clearError: () => {}
  };
}