'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Home, ChevronRight, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIPoweredBadge } from './AIPoweredBadge';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  breadcrumbs: BreadcrumbItem[];
  backHref?: string;
  actions?: React.ReactNode;
  aiPowered?: boolean;
  helpContent?: {
    title: string;
    description: string;
    examples?: string[];
  };
}

export function PageHeader({
  title,
  subtitle,
  icon,
  iconColor = 'text-blue-600 dark:text-blue-400',
  breadcrumbs,
  backHref,
  actions,
  aiPowered = false,
  helpContent,
}: PageHeaderProps) {
  const [showHelp, setShowHelp] = React.useState(false);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
              {index === 0 ? (
                <Link
                  href={item.href || '/'}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  <Home className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium text-gray-900 dark:text-white">
                  {item.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Help button */}
        {helpContent && (
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(!showHelp)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Aide"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>

            {/* Help tooltip */}
            {showHelp && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowHelp(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {helpContent.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {helpContent.description}
                  </p>
                  {helpContent.examples && helpContent.examples.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                        Exemples
                      </p>
                      <ul className="space-y-1">
                        {helpContent.examples.map((example, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                          >
                            <span className="text-blue-500">→</span>
                            {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {backHref && (
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Link href={backHref} aria-label="Retour">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                {icon && <span className={iconColor}>{icon}</span>}
                {title}
              </h1>
              {aiPowered && <AIPoweredBadge />}
            </div>
            {subtitle && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
