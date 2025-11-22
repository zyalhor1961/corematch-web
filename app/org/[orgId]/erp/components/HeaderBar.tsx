'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  FileText,
  UserPlus,
  Upload,
  MessageSquare,
  Home
} from 'lucide-react';

interface HeaderBarProps {
  orgId: string;
}

export function HeaderBar({ orgId }: HeaderBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link
          href={`/org/${orgId}`}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
        >
          <Home className="h-4 w-4" />
          <span>Corematch</span>
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-900 dark:text-white">ERP</span>
      </nav>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Link href={`/org/${orgId}/erp/invoices/new`}>
            <FileText className="h-4 w-4 mr-2" />
            Nouvelle facture
          </Link>
        </Button>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Link href={`/org/${orgId}/erp/clients`}>
            <UserPlus className="h-4 w-4 mr-2" />
            Nouveau client
          </Link>
        </Button>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Link href={`/org/${orgId}/erp/suppliers`}>
            <Upload className="h-4 w-4 mr-2" />
            Upload facture fournisseur
          </Link>
        </Button>

        <Button
          size="sm"
          asChild
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
        >
          <Link href={`/org/${orgId}/daf`}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Ask DAF
          </Link>
        </Button>
      </div>
    </div>
  );
}
