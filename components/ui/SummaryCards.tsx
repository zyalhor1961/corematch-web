'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    label?: string;
    positive?: boolean;
  };
  subtext?: string;
  onClick?: () => void;
}

interface SummaryCardsProps {
  cards: SummaryCardProps[];
  columns?: 2 | 3 | 4 | 5;
}

function formatValue(value: string | number): string {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('fr-FR').format(value);
  }
  return value;
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-blue-500',
  trend,
  subtext,
  onClick,
}: SummaryCardProps) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${
        onClick
          ? 'cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
          : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </p>
        {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatValue(value)}
        </p>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.positive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {trend.positive ? '+' : ''}
            {trend.value}%
            {trend.label && ` ${trend.label}`}
          </span>
        )}
      </div>
      {subtext && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {subtext}
        </p>
      )}
    </Wrapper>
  );
}

export function SummaryCards({ cards, columns = 4 }: SummaryCardsProps) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
    5: 'md:grid-cols-3 lg:grid-cols-5',
  };

  return (
    <div className={`grid grid-cols-1 ${gridCols[columns]} gap-4`}>
      {cards.map((card, index) => (
        <SummaryCard key={index} {...card} />
      ))}
    </div>
  );
}

// Currency formatter helper
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
