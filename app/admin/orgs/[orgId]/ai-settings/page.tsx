'use client';

/**
 * Admin: Organization AI Settings
 *
 * Allows org admins to configure custom AI instructions
 * that are injected into prompts at runtime.
 *
 * Fields:
 * - general_instructions: Applied to all AI interactions
 * - daf_instructions: DAF (funding application) analysis
 * - cv_instructions: CV screening and candidate analysis
 * - deb_instructions: DEB (customs declaration) processing
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OrgAISettings } from '@/lib/types';

const MAX_INSTRUCTION_LENGTH = 10000;

interface InstructionFieldProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function InstructionField({ label, description, value, onChange, placeholder }: InstructionFieldProps) {
  const charCount = value?.length || 0;
  const isNearLimit = charCount > MAX_INSTRUCTION_LENGTH * 0.9;
  const isOverLimit = charCount > MAX_INSTRUCTION_LENGTH;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <label className="block text-sm font-medium text-gray-900">{label}</label>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <span
          className={`text-xs ${
            isOverLimit ? 'text-red-600 font-medium' : isNearLimit ? 'text-yellow-600' : 'text-gray-400'
          }`}
        >
          {charCount.toLocaleString()} / {MAX_INSTRUCTION_LENGTH.toLocaleString()}
        </span>
      </div>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder={placeholder}
        className={`w-full border rounded-md px-3 py-2 text-gray-900 bg-white font-mono text-sm ${
          isOverLimit ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
        }`}
      />
    </div>
  );
}

export default function OrgAISettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasCustomSettings, setHasCustomSettings] = useState(false);

  // Form state
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [dafInstructions, setDafInstructions] = useState('');
  const [cvInstructions, setCvInstructions] = useState('');
  const [debInstructions, setDebInstructions] = useState('');

  useEffect(() => {
    fetchSettings();
  }, [orgId]);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/orgs/${orgId}/ai-settings`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch AI settings');
      }

      if (result.data) {
        setGeneralInstructions(result.data.general_instructions || '');
        setDafInstructions(result.data.daf_instructions || '');
        setCvInstructions(result.data.cv_instructions || '');
        setDebInstructions(result.data.deb_instructions || '');
        setHasCustomSettings(true);
      } else {
        setHasCustomSettings(false);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    // Validate lengths
    const fields = [
      { name: 'General instructions', value: generalInstructions },
      { name: 'DAF instructions', value: dafInstructions },
      { name: 'CV instructions', value: cvInstructions },
      { name: 'DEB instructions', value: debInstructions },
    ];

    for (const field of fields) {
      if (field.value && field.value.length > MAX_INSTRUCTION_LENGTH) {
        setError(`${field.name} exceeds maximum length of ${MAX_INSTRUCTION_LENGTH} characters`);
        setSaving(false);
        return;
      }
    }

    try {
      const response = await fetch(`/api/admin/orgs/${orgId}/ai-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          general_instructions: generalInstructions || null,
          daf_instructions: dafInstructions || null,
          cv_instructions: cvInstructions || null,
          deb_instructions: debInstructions || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save AI settings');
      }

      setSuccess('AI settings saved successfully');
      setHasCustomSettings(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset to default settings? This will delete all custom instructions.')) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/orgs/${orgId}/ai-settings`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset AI settings');
      }

      // Clear form
      setGeneralInstructions('');
      setDafInstructions('');
      setCvInstructions('');
      setDebInstructions('');
      setHasCustomSettings(false);
      setSuccess('AI settings reset to defaults');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading AI settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <Link href="/admin/graphs" className="text-blue-600 hover:underline mb-2 block">
              &larr; Back to Admin
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">AI Settings</h1>
            <p className="text-gray-600 mt-2">
              Configure custom instructions that are injected into AI prompts at runtime.
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Organization ID: <code className="bg-gray-100 px-1 rounded">{orgId}</code>
            </p>
          </div>
          <div className="flex gap-2">
            {hasCustomSettings && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
              >
                Reset to Defaults
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Info banner */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-1">How instructions work</h3>
          <p className="text-sm text-blue-800">
            Custom instructions are appended to the base AI prompts when processing documents or CVs.
            Domain-specific instructions (CV, DAF, DEB) take precedence over general instructions.
            Leave a field empty to use the system default for that domain.
          </p>
        </div>

        {/* Settings indicator */}
        <div className="mb-6">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
              hasCustomSettings
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {hasCustomSettings ? 'Custom settings active' : 'Using default settings'}
          </span>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* General Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <InstructionField
              label="General Instructions"
              description="Applied to all AI interactions when no domain-specific instruction exists"
              value={generalInstructions}
              onChange={setGeneralInstructions}
              placeholder="Example: Always respond in French. Prioritize precision over speed. Be conservative in scoring."
            />
          </div>

          {/* CV Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full bg-purple-500"></span>
              <span className="text-sm font-medium text-gray-500">CV SCREENING</span>
            </div>
            <InstructionField
              label="CV Instructions"
              description="Applied to CV screening and candidate analysis prompts"
              value={cvInstructions}
              onChange={setCvInstructions}
              placeholder="Example: Give extra weight to candidates with startup experience. Consider freelance work as relevant experience. Flag candidates who changed jobs more than 3 times in 2 years."
            />
          </div>

          {/* DAF Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-sm font-medium text-gray-500">DAF ANALYSIS</span>
            </div>
            <InstructionField
              label="DAF Instructions"
              description="Applied to DAF (funding application) analysis prompts"
              value={dafInstructions}
              onChange={setDafInstructions}
              placeholder="Example: Focus on budget justification. Flag any missing supporting documents. Verify alignment with program objectives."
            />
          </div>

          {/* DEB Instructions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span>
              <span className="text-sm font-medium text-gray-500">DEB PROCESSING</span>
            </div>
            <InstructionField
              label="DEB Instructions"
              description="Applied to DEB (customs declaration) document processing prompts"
              value={debInstructions}
              onChange={setDebInstructions}
              placeholder="Example: Default country of origin is CN if not specified. Use standard HS codes for electronic components. Flag invoices without VAT numbers."
            />
          </div>
        </div>

        {/* Save button (bottom) */}
        <div className="mt-8 flex justify-end gap-2">
          {hasCustomSettings && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
            >
              Reset to Defaults
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
