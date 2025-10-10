'use client';

/**
 * Unified IDP System Demo Page
 *
 * This page demonstrates the complete enterprise-grade IDP system
 * integrating features from Rossum, Docsumo, Azure AI, and Apryse.
 *
 * Features showcased:
 * - Real-time document processing queue
 * - High-fidelity PDF viewer with 30+ annotation types
 * - Side-by-side PDF-data sync with confidence scoring
 * - Drag-and-drop workflow builder
 * - Audit trail and activity logging
 * - Custom extraction model management
 * - Cross-browser compatible
 * - Optimized for large PDFs
 */

import { useParams } from 'next/navigation';
import { useTheme } from '@/app/components/ThemeProvider';
import { UnifiedIDPDashboard } from '@/app/components/idp/UnifiedIDPDashboard';

export default function UnifiedIDPPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const { isDarkMode } = useTheme();

  return (
    <div className="w-full h-screen">
      <UnifiedIDPDashboard
        orgId={orgId}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
