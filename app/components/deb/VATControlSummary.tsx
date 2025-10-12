'use client';

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

interface ControlDetail {
  passed: boolean;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  expected?: number;
  actual?: number;
  difference?: number;
}

interface VATControls {
  arithmeticTTC: ControlDetail;
  intraEUClassification: ControlDetail;
  vatZeroVerification: ControlDetail;
}

interface VATControlSummaryProps {
  controls: {
    passed: boolean;
    overallStatus: 'passed' | 'warning' | 'failed';
    controls: VATControls;
    needsManualReview: boolean;
  };
}

export function VATControlSummary({ controls }: VATControlSummaryProps) {
  const getStatusIcon = (status: 'passed' | 'warning' | 'failed') => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusColor = (status: 'passed' | 'warning' | 'failed') => {
    switch (status) {
      case 'passed':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
    }
  };

  const getOverallColor = (status: 'passed' | 'warning' | 'failed') => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 border-b border-gray-200 ${getOverallColor(controls.overallStatus)}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {getStatusIcon(controls.overallStatus)}
            VAT Financial Controls
          </h2>
          <span className="text-sm font-medium uppercase tracking-wide">
            {controls.overallStatus}
          </span>
        </div>
        {controls.needsManualReview && (
          <p className="mt-2 text-sm">
            ⚠️ Manual review required - please verify financial data
          </p>
        )}
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
        {/* Arithmetic TTC */}
        <ControlCard
          title="Arithmetic TTC"
          detail={controls.controls.arithmeticTTC}
          description="Net + Tax = Total validation"
        />

        {/* Intra-EU Classification */}
        <ControlCard
          title="Intra-EU Classification"
          detail={controls.controls.intraEUClassification}
          description="EU transaction classification"
        />

        {/* VAT Zero Verification */}
        <ControlCard
          title="VAT Zero Verification"
          detail={controls.controls.vatZeroVerification}
          description="Reverse charge validation"
        />
      </div>
    </div>
  );
}

function ControlCard({
  title,
  detail,
  description
}: {
  title: string;
  detail: ControlDetail;
  description: string;
}) {
  const getStatusIcon = (status: 'passed' | 'warning' | 'failed') => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getCardColor = (status: 'passed' | 'warning' | 'failed') => {
    switch (status) {
      case 'passed':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
    }
  };

  return (
    <div className={`rounded-lg border-2 p-4 ${getCardColor(detail.status)}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-gray-600 mt-0.5">{description}</p>
        </div>
        {getStatusIcon(detail.status)}
      </div>

      <p className="text-sm mt-3">{detail.message}</p>

      {/* Show numerical details if available */}
      {detail.expected !== undefined && detail.actual !== undefined && (
        <div className="mt-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Expected:</span>
            <span className="font-mono">{detail.expected.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Actual:</span>
            <span className="font-mono">{detail.actual.toFixed(2)}</span>
          </div>
          {detail.difference !== undefined && (
            <div className="flex justify-between font-semibold">
              <span className="text-gray-600">Difference:</span>
              <span className="font-mono">{detail.difference.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
