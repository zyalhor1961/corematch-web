'use client';

/**
 * DEB Validation Interface
 *
 * Complete validation interface for DEB documents with:
 * - VAT control summary
 * - Line items table with editable HS codes and weights
 * - Confidence indicators
 * - Source badges
 * - Batch validation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Loader2, Save, Send } from 'lucide-react';
import { VATControlSummary } from './VATControlSummary';
import { HSCodeInput } from './HSCodeInput';
import { EnrichmentBadge } from './EnrichmentBadge';

interface LineItem {
  lineId: string;
  description: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  hsCode: string;
  weightKg: number;
  confidence: number;
  source: 'reference_db' | 'openai' | 'user_corrected' | 'azure_extracted';
  reasoning?: string;
  validated: boolean;
}

interface DEBValidationInterfaceProps {
  documentId: string;
  orgId: string;
  onComplete?: () => void;
}

export function DEBValidationInterface({
  documentId,
  orgId,
  onComplete
}: DEBValidationInterfaceProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vatControlStatus, setVatControlStatus] = useState<any>(null);

  // Load document data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load VAT controls
      const vatResponse = await fetch(`/api/deb/documents/${documentId}/vat-control`);
      const vatData = await vatResponse.json();
      if (vatData.success) {
        setVatControlStatus(vatData.controls);
      }

      // Load enrichments
      const enrichResponse = await fetch(`/api/deb/documents/${documentId}/enrich-hs-codes`);
      const enrichData = await enrichResponse.json();

      if (enrichData.success) {
        setLineItems(enrichData.enrichments.map((item: any) => ({
          lineId: item.lineId,
          description: item.description,
          sku: item.sku,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          lineAmount: item.valueHT || 0,
          hsCode: item.hsCode || '',
          weightKg: item.weightKg || 0,
          confidence: item.confidence || 0,
          source: item.source,
          reasoning: item.reasoning,
          validated: false
        })));
      }
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Run enrichment
  const runEnrichment = async () => {
    setEnriching(true);
    try {
      const response = await fetch(`/api/deb/documents/${documentId}/enrich-hs-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true })
      });

      const data = await response.json();
      if (data.success) {
        await loadData();
      } else {
        setError('Enrichment failed');
      }
    } catch (err: any) {
      setError(`Enrichment error: ${err.message}`);
    } finally {
      setEnriching(false);
    }
  };

  // Update line item
  const updateLineItem = (lineId: string, updates: Partial<LineItem>) => {
    setLineItems(prev =>
      prev.map(item =>
        item.lineId === lineId
          ? { ...item, ...updates, validated: false }
          : item
      )
    );
  };

  // Validate single line
  const validateLine = async (lineId: string) => {
    const item = lineItems.find(l => l.lineId === lineId);
    if (!item) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/deb/documents/${documentId}/validate-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineId,
          hsCode: item.hsCode,
          weightKg: item.weightKg,
          description: item.description,
          sku: item.sku
        })
      });

      const data = await response.json();
      if (data.success) {
        setLineItems(prev =>
          prev.map(l =>
            l.lineId === lineId
              ? { ...l, validated: true, source: 'user_corrected' }
              : l
          )
        );
      } else {
        setError(`Validation failed: ${data.error}`);
      }
    } catch (err: any) {
      setError(`Validation error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Validate all lines
  const validateAll = async () => {
    setSaving(true);
    try {
      const validations = lineItems.map(item => ({
        lineId: item.lineId,
        hsCode: item.hsCode,
        weightKg: item.weightKg,
        description: item.description,
        sku: item.sku
      }));

      const response = await fetch(`/api/deb/documents/${documentId}/validate-line`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validations })
      });

      const data = await response.json();
      if (data.success) {
        setLineItems(prev =>
          prev.map(item => ({ ...item, validated: true, source: 'user_corrected' }))
        );
      }
    } catch (err: any) {
      setError(`Batch validation error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Prepare for archiving
  const prepareArchive = async () => {
    try {
      const response = await fetch(`/api/deb/documents/${documentId}/prepare-archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success && data.archiveReady) {
        onComplete?.();
      } else {
        setError(`Not ready for archiving: ${data.message}`);
      }
    } catch (err: any) {
      setError(`Archive preparation error: ${err.message}`);
    }
  };

  const allValidated = lineItems.length > 0 && lineItems.every(item => item.validated);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3">Loading document data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">DEB Validation</h1>
        <div className="flex gap-2">
          <button
            onClick={runEnrichment}
            disabled={enriching}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {enriching ? 'Enriching...' : 'Re-run Enrichment'}
          </button>
          <button
            onClick={validateAll}
            disabled={saving || allValidated}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Validate All
          </button>
          <button
            onClick={prepareArchive}
            disabled={!allValidated}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Prepare for Export
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* VAT Control Summary */}
      {vatControlStatus && (
        <VATControlSummary controls={vatControlStatus} />
      )}

      {/* Line Items Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">HS Code</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Weight (kg)</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Source</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lineItems.map((item) => (
                <tr key={item.lineId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {item.validated ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm max-w-xs">
                    <div className="truncate" title={item.description}>
                      {item.description}
                    </div>
                    {item.reasoning && (
                      <div className="text-xs text-gray-500 mt-1 truncate" title={item.reasoning}>
                        {item.reasoning}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{item.sku || '-'}</td>
                  <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                  <td className="px-4 py-3">
                    <HSCodeInput
                      value={item.hsCode}
                      onChange={(value) => updateLineItem(item.lineId, { hsCode: value })}
                      disabled={item.validated}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.001"
                      value={item.weightKg}
                      onChange={(e) =>
                        updateLineItem(item.lineId, { weightKg: parseFloat(e.target.value) || 0 })
                      }
                      disabled={item.validated}
                      className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <EnrichmentBadge
                      source={item.source}
                      confidence={item.confidence}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!item.validated && (
                      <button
                        onClick={() => validateLine(item.lineId)}
                        disabled={saving}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Validate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
        <div className="text-sm text-gray-600">
          {lineItems.filter(item => item.validated).length} of {lineItems.length} lines validated
        </div>
        {allValidated && (
          <div className="flex items-center gap-2 text-green-700 font-semibold">
            <CheckCircle className="w-5 h-5" />
            All lines validated - Ready for export
          </div>
        )}
      </div>
    </div>
  );
}
