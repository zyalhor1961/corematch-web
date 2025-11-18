'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DocumentUpload } from '@/components/daf/DocumentUpload';
import { DocumentInbox } from '@/components/daf/DocumentInbox';
import { FileText, Upload, List, Search } from 'lucide-react';

export default function DAFPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId;

  const [activeTab, setActiveTab] = useState<'upload' | 'inbox'>('upload');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadComplete = () => {
    // Refresh inbox after upload
    setRefreshTrigger(prev => prev + 1);
    // Switch to inbox tab
    setTimeout(() => setActiveTab('inbox'), 500);
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Organisation introuvable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Documents DAF
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gérez vos factures et documents comptables
          </p>
        </div>

        {/* Search Button */}
        <Link
          href={`/org/${orgId}/daf/search`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Search className="h-5 w-5" />
          Rechercher
        </Link>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 p-4">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <Upload className="h-4 w-4" />
              Upload
            </button>
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'inbox'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <List className="h-4 w-4" />
              Documents
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'upload' && (
            <DocumentUpload
              orgId={orgId}
              onUploadComplete={handleUploadComplete}
            />
          )}

          {activeTab === 'inbox' && (
            <DocumentInbox
              orgId={orgId}
              refreshTrigger={refreshTrigger}
            />
          )}
        </div>
      </div>
    </div>
  );
}
