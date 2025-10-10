'use client';

/**
 * Extraction Model Manager - Azure AI / Custom model configuration
 */

import React, { useState } from 'react';
import { Zap, Plus, Edit2, Trash2, Save } from 'lucide-react';

interface ExtractionModelManagerProps {
  orgId: string;
  isDarkMode?: boolean;
}

interface ExtractionModel {
  id: string;
  name: string;
  type: 'prebuilt' | 'custom';
  fields: string[];
  accuracy: number;
}

export const ExtractionModelManager: React.FC<ExtractionModelManagerProps> = ({
  orgId,
  isDarkMode = false
}) => {
  const [models, setModels] = useState<ExtractionModel[]>([
    {
      id: '1',
      name: 'Invoice Model',
      type: 'prebuilt',
      fields: ['invoice_number', 'date', 'total'],
      accuracy: 0.96
    },
    {
      id: '2',
      name: 'Custom DEB Model',
      type: 'custom',
      fields: ['hs_code', 'country_origin', 'weight'],
      accuracy: 0.92
    }
  ]);

  return (
    <div className={`rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-6 shadow-lg`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Extraction Models
        </h2>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
            isDarkMode
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Plus className="w-4 h-4" />
          New Model
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map(model => (
          <div
            key={model.id}
            className={`p-5 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {model.name}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  model.type === 'prebuilt'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {model.type}
                </span>
              </div>
              <div className="flex gap-1">
                <button className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-200'}`}>
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-600'}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className={`text-sm mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {model.fields.length} fields • {Math.round(model.accuracy * 100)}% accuracy
            </p>

            <div className="flex flex-wrap gap-1">
              {model.fields.map(field => (
                <span
                  key={field}
                  className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
