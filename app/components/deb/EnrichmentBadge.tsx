'use client';

import React from 'react';
import { Database, Brain, User, FileText } from 'lucide-react';

interface EnrichmentBadgeProps {
  source: 'reference_db' | 'openai' | 'user_corrected' | 'azure_extracted';
  confidence: number;
}

export function EnrichmentBadge({ source, confidence }: EnrichmentBadgeProps) {
  const getSourceConfig = () => {
    switch (source) {
      case 'reference_db':
        return {
          icon: Database,
          label: 'Reference DB',
          color: 'bg-green-100 text-green-800 border-green-300',
          tooltip: 'From auto-learning reference database'
        };
      case 'openai':
        return {
          icon: Brain,
          label: 'AI Suggested',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          tooltip: 'AI-powered suggestion from OpenAI'
        };
      case 'user_corrected':
        return {
          icon: User,
          label: 'User Validated',
          color: 'bg-purple-100 text-purple-800 border-purple-300',
          tooltip: 'Validated and corrected by user'
        };
      case 'azure_extracted':
        return {
          icon: FileText,
          label: 'Extracted',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          tooltip: 'Extracted from document by Azure'
        };
    }
  };

  const config = getSourceConfig();
  const Icon = config.icon;
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${config.color}`}
        title={config.tooltip}
      >
        <Icon className="w-3 h-3" />
        <span>{config.label}</span>
      </div>

      {source !== 'user_corrected' && (
        <div className="flex items-center gap-1">
          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                confidencePercent >= 80
                  ? 'bg-green-500'
                  : confidencePercent >= 60
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 font-mono">
            {confidencePercent}%
          </span>
        </div>
      )}
    </div>
  );
}
