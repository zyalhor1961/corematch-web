'use client';

import React from 'react';
import { AlertTriangle, X, Info, CheckCircle, XCircle } from 'lucide-react';
import { ErrorType } from '@/lib/errors/error-types';

export interface ErrorInfo {
  type?: ErrorType | string;
  message: string;
  details?: string;
  fileName?: string;
}

export interface ErrorDisplayProps {
  errors: ErrorInfo[];
  onDismiss?: (index: number) => void;
  onDismissAll?: () => void;
  className?: string;
}

export interface SingleErrorProps {
  error: ErrorInfo;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Obtient l'icône et la couleur appropriées pour un type d'erreur
 */
function getErrorAppearance(type?: string) {
  switch (type) {
    case ErrorType.FILE_TOO_LARGE:
    case ErrorType.FILE_INVALID_TYPE:
    case ErrorType.FILE_CORRUPTED:
      return {
        icon: AlertTriangle,
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        borderColor: 'border-orange-200 dark:border-orange-800',
        textColor: 'text-orange-800 dark:text-orange-200',
        iconColor: 'text-orange-600 dark:text-orange-400'
      };

    case ErrorType.AUTH_REQUIRED:
    case ErrorType.ACCESS_DENIED:
      return {
        icon: XCircle,
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        textColor: 'text-red-800 dark:text-red-200',
        iconColor: 'text-red-600 dark:text-red-400'
      };

    case ErrorType.QUOTA_EXCEEDED:
    case ErrorType.RATE_LIMIT_EXCEEDED:
      return {
        icon: Info,
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        textColor: 'text-blue-800 dark:text-blue-200',
        iconColor: 'text-blue-600 dark:text-blue-400'
      };

    default:
      return {
        icon: AlertTriangle,
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        textColor: 'text-red-800 dark:text-red-200',
        iconColor: 'text-red-600 dark:text-red-400'
      };
  }
}

/**
 * Composant pour afficher une seule erreur
 */
export function SingleError({ error, onDismiss, className = '' }: SingleErrorProps) {
  const appearance = getErrorAppearance(error.type);
  const Icon = appearance.icon;

  return (
    <div className={`
      ${appearance.bgColor} ${appearance.borderColor} ${appearance.textColor}
      border rounded-lg p-4 relative
      ${className}
    `}>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`
            absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10
            ${appearance.iconColor}
          `}
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      )}

      <div className="flex items-start space-x-3">
        <Icon size={20} className={`${appearance.iconColor} flex-shrink-0 mt-0.5`} />

        <div className="flex-1 min-w-0">
          {error.fileName && (
            <div className="font-medium text-sm mb-1">
              📄 {error.fileName}
            </div>
          )}

          <div className="text-sm font-medium">
            {error.message}
          </div>

          {error.details && (
            <div className="text-xs mt-1 opacity-80">
              {error.details}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Composant pour afficher une liste d'erreurs
 */
export function ErrorDisplay({ errors, onDismiss, onDismissAll, className = '' }: ErrorDisplayProps) {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header avec bouton "Fermer tout" si multiple erreurs */}
      {errors.length > 1 && onDismissAll && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {errors.length} erreur(s) détectée(s)
          </span>
          <button
            onClick={onDismissAll}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
          >
            Fermer tout
          </button>
        </div>
      )}

      {/* Liste des erreurs */}
      {errors.map((error, index) => (
        <SingleError
          key={index}
          error={error}
          onDismiss={onDismiss ? () => onDismiss(index) : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Composant pour afficher un message de succès
 */
export interface SuccessDisplayProps {
  message: string;
  details?: string;
  onDismiss?: () => void;
  className?: string;
}

export function SuccessDisplay({ message, details, onDismiss, className = '' }: SuccessDisplayProps) {
  return (
    <div className={`
      bg-green-50 dark:bg-green-900/20
      border border-green-200 dark:border-green-800
      text-green-800 dark:text-green-200
      rounded-lg p-4 relative
      ${className}
    `}>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-green-600 dark:text-green-400"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      )}

      <div className="flex items-start space-x-3">
        <CheckCircle size={20} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">
            {message}
          </div>

          {details && (
            <div className="text-xs mt-1 opacity-80">
              {details}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook pour gérer l'état des erreurs
 */
export function useErrorState() {
  const [errors, setErrors] = React.useState<ErrorInfo[]>([]);

  const addError = (error: ErrorInfo) => {
    setErrors(prev => [...prev, error]);
  };

  const removeError = (index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  };

  const clearErrors = () => {
    setErrors([]);
  };

  const addErrors = (newErrors: ErrorInfo[]) => {
    setErrors(prev => [...prev, ...newErrors]);
  };

  return {
    errors,
    addError,
    removeError,
    clearErrors,
    addErrors,
    hasErrors: errors.length > 0
  };
}

/**
 * Utilitaire pour convertir une réponse API en erreurs affichables
 */
export function parseApiErrors(response: any): ErrorInfo[] {
  if (!response) return [];

  // Réponse avec erreurs multiples (upload)
  if (response.data?.errors && Array.isArray(response.data.errors)) {
    return response.data.errors.map((err: any) => ({
      type: err.type,
      message: err.error || err.message,
      details: err.details,
      fileName: err.fileName
    }));
  }

  // Réponse avec une seule erreur
  if (response.error) {
    return [{
      type: response.error.type,
      message: response.error.userMessage || response.error.message || response.error,
      details: response.error.details
    }];
  }

  // Format d'erreur simple
  if (typeof response === 'string') {
    return [{ message: response }];
  }

  return [];
}

/**
 * Messages d'erreur prédéfinis pour les cas courants
 */
export const CommonErrors = {
  networkError: {
    type: ErrorType.SERVICE_UNAVAILABLE,
    message: 'Erreur de connexion. Vérifiez votre connexion internet.',
    details: 'Impossible de communiquer avec le serveur'
  },

  sessionExpired: {
    type: ErrorType.AUTH_EXPIRED,
    message: 'Votre session a expiré',
    details: 'Veuillez vous reconnecter pour continuer'
  },

  unexpectedError: {
    type: ErrorType.INTERNAL_ERROR,
    message: 'Une erreur inattendue s\'est produite',
    details: 'Notre équipe technique a été notifiée'
  }
};