'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Calendar, X } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface DateInputProps {
  value?: string; // Format ISO: yyyy-mm-dd
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Composant DateInput français
 * - Saisie au format jj/mm/aaaa
 * - Stocke la valeur au format ISO (yyyy-mm-dd)
 */
export function DateInput({
  value,
  onChange,
  placeholder = 'jj/mm/aaaa',
  className,
  disabled,
  id,
}: DateInputProps) {
  // Convertir ISO vers français pour l'affichage
  const isoToFrench = (iso: string): string => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length !== 3) return '';
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Convertir français vers ISO pour le stockage
  const frenchToIso = (french: string): string => {
    if (!french) return '';
    const parts = french.split('/');
    if (parts.length !== 3) return '';
    const [day, month, year] = parts;
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const [inputValue, setInputValue] = React.useState(isoToFrench(value || ''));
  const [showCalendar, setShowCalendar] = React.useState(false);

  // Sync avec la valeur externe
  React.useEffect(() => {
    const newValue = isoToFrench(value || '');
    if (newValue !== inputValue && value) {
      setInputValue(newValue);
    }
  }, [value]);

  // Formater automatiquement pendant la saisie
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    // Supprimer tout sauf les chiffres
    const digits = val.replace(/\D/g, '');

    // Formater avec les slashes
    let formatted = '';
    if (digits.length > 0) {
      formatted = digits.substring(0, 2);
    }
    if (digits.length > 2) {
      formatted += '/' + digits.substring(2, 4);
    }
    if (digits.length > 4) {
      formatted += '/' + digits.substring(4, 8);
    }

    setInputValue(formatted);

    // Si la date est complète, mettre à jour la valeur
    if (formatted.length === 10) {
      const iso = frenchToIso(formatted);
      if (iso && isValidDate(formatted)) {
        onChange?.(iso);
      }
    } else if (formatted === '') {
      onChange?.('');
    }
  };

  // Valider la date
  const isValidDate = (french: string): boolean => {
    const parts = french.split('/');
    if (parts.length !== 3) return false;
    const [day, month, year] = parts.map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2100) return false;
    // Vérification plus précise
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
  };

  // Gérer le blur pour valider
  const handleBlur = () => {
    if (inputValue && inputValue.length === 10) {
      if (!isValidDate(inputValue)) {
        // Date invalide, reset
        setInputValue(isoToFrench(value || ''));
      }
    }
  };

  // Sélection depuis le calendrier natif
  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value;
    if (iso) {
      onChange?.(iso);
      setInputValue(isoToFrench(iso));
    }
    setShowCalendar(false);
  };

  // Effacer la date
  const handleClear = () => {
    setInputValue('');
    onChange?.('');
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={10}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-16 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        />
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              tabIndex={-1}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          <Popover open={showCalendar} onOpenChange={setShowCalendar}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                tabIndex={-1}
              >
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <input
                type="date"
                value={value || ''}
                onChange={handleCalendarChange}
                className="border rounded p-2 text-sm"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

/**
 * Composant DateDisplay - Affiche une date au format français
 */
interface DateDisplayProps {
  date: string | Date | undefined | null;
  format?: 'short' | 'long' | 'numeric';
  className?: string;
  fallback?: string;
}

export function DateDisplay({ date, format = 'numeric', className, fallback = '-' }: DateDisplayProps) {
  if (!date) return <span className={className}>{fallback}</span>;

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return <span className={className}>{fallback}</span>;

  let formatted: string;
  switch (format) {
    case 'long':
      formatted = dateObj.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      break;
    case 'short':
      formatted = dateObj.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      break;
    case 'numeric':
    default:
      formatted = dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
  }

  return <span className={className}>{formatted}</span>;
}
