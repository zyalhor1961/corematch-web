'use client';

import React, { useState, useEffect } from 'react';

interface HSCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function HSCodeInput({
  value,
  onChange,
  disabled = false,
  className = ''
}: HSCodeInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    // Format display value as XXXX.XX.XX
    if (value) {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 8) {
        setDisplayValue(`${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`);
        setIsValid(true);
      } else {
        setDisplayValue(value);
        setIsValid(false);
      }
    } else {
      setDisplayValue('');
      setIsValid(false);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Remove all non-digits
    const digits = input.replace(/\D/g, '');

    // Limit to 8 digits
    const limited = digits.slice(0, 8);

    // Format for display
    let formatted = limited;
    if (limited.length > 4) {
      formatted = `${limited.slice(0, 4)}.${limited.slice(4)}`;
    }
    if (limited.length > 6) {
      formatted = `${limited.slice(0, 4)}.${limited.slice(4, 6)}.${limited.slice(6)}`;
    }

    setDisplayValue(formatted);
    setIsValid(limited.length === 8);

    // Pass clean digits to parent
    onChange(limited);
  };

  const handleBlur = () => {
    // Reformat on blur
    const digits = displayValue.replace(/\D/g, '');
    if (digits.length === 8) {
      setDisplayValue(`${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder="0000.00.00"
        maxLength={10}
        className={`
          w-32 px-2 py-1 font-mono text-sm border rounded
          focus:ring-2 focus:ring-blue-500 focus:outline-none
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${isValid ? 'border-gray-300' : 'border-red-300 bg-red-50'}
        `}
      />
      {!isValid && displayValue && (
        <span className="absolute -bottom-5 left-0 text-xs text-red-600">
          Must be 8 digits
        </span>
      )}
    </div>
  );
}
