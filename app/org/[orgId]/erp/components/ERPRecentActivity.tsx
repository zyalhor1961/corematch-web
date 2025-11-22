'use client';

import {
  FileText,
  CreditCard,
  AlertCircle,
  Receipt,
  ShoppingCart,
  Clock
} from 'lucide-react';
import { formatCurrency, formatTimeAgo } from '@/lib/erp/formatters';
import type { RecentActivity } from '@/lib/erp/queries';

interface ERPRecentActivityProps {
  activities: RecentActivity[];
  loading?: boolean;
}

const activityConfig = {
  invoice_created: {
    icon: FileText,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500',
  },
  payment_received: {
    icon: CreditCard,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  invoice_overdue: {
    icon: AlertCircle,
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    dotColor: 'bg-red-500',
  },
  expense_added: {
    icon: Receipt,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    dotColor: 'bg-orange-500',
  },
  supplier_purchase: {
    icon: ShoppingCart,
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    dotColor: 'bg-purple-500',
  },
};

export function ERPRecentActivity({ activities, loading = false }: ERPRecentActivityProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Activité récente
        </h3>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Activité récente
        </h3>
        <div className="text-center py-8">
          <Clock className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Aucune activité récente</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Vos dernières actions apparaîtront ici
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Activité récente
      </h3>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-6">
          {activities.map((activity, index) => {
            const config = activityConfig[activity.type];
            const Icon = config.icon;

            return (
              <div key={activity.id} className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div className={`absolute left-4 top-5 w-2 h-2 rounded-full ${config.dotColor} ring-4 ring-white dark:ring-gray-800`} />

                {/* Icon */}
                <div className={`relative z-10 p-2.5 rounded-lg ${config.iconBg}`}>
                  <Icon className={`h-5 w-5 ${config.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {activity.title}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {activity.detail}
                  </p>
                  {activity.amount !== undefined && (
                    <p className={`text-sm font-medium mt-1 ${
                      activity.type === 'payment_received'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : activity.type === 'invoice_overdue'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {formatCurrency(activity.amount)}
                    </p>
                  )}
                </div>

                {/* Timestamp */}
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {formatTimeAgo(activity.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
