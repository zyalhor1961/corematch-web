'use client';

import { LucideIcon } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/erp/formatters';

interface KPIStatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: number;
  format?: 'currency' | 'number' | 'percent';
  loading?: boolean;
}

export function KPIStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-600 dark:text-blue-400',
  trend,
  format = 'currency',
  loading = false,
}: KPIStatCardProps) {
  const formattedValue = format === 'currency'
    ? formatCurrency(value)
    : format === 'percent'
    ? formatPercent(value)
    : formatNumber(value);

  const isPositive = value >= 0;
  const trendIsPositive = trend !== undefined && trend >= 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
            {title}
          </p>
          {loading ? (
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
          ) : (
            <p className={`text-2xl font-bold mt-1 ${
              format === 'currency' && !isPositive
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-900 dark:text-white'
            }`}>
              {formattedValue}
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1">
          <span className={`text-xs font-medium ${
            trendIsPositive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {trendIsPositive ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            vs mois dernier
          </span>
        </div>
      )}
    </div>
  );
}
