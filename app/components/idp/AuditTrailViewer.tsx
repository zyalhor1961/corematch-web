'use client';

/**
 * Audit Trail Viewer - Complete activity logging and compliance tracking
 */

import React from 'react';
import { History, User, FileText, Clock } from 'lucide-react';
import { AuditLogEntry } from './UnifiedIDPDashboard';

interface AuditTrailViewerProps {
  auditLog: AuditLogEntry[];
  isDarkMode?: boolean;
}

export const AuditTrailViewer: React.FC<AuditTrailViewerProps> = ({
  auditLog,
  isDarkMode = false
}) => {
  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (action: string) => {
    if (action.includes('opened')) return FileText;
    if (action.includes('modified')) return User;
    return History;
  };

  return (
    <div className={`rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-6 shadow-lg`}>
      <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        Audit Trail
      </h2>

      <div className="space-y-3">
        {auditLog.length === 0 ? (
          <div className={`text-center py-12 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No audit entries yet</p>
          </div>
        ) : (
          auditLog.map(entry => {
            const Icon = getActionIcon(entry.action);

            return (
              <div
                key={entry.id}
                className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {entry.userName}
                    </p>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {entry.action.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
