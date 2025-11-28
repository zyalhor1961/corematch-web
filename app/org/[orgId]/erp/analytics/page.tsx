'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { BarChart3, ArrowLeft, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  AnalyticAxesCard,
  AxisEditorModal,
  AnalyticReportCard,
  type AnalyticAxis,
  type AnalyticValue,
  type AnalyticData,
} from '@/components/erp';

type AnalyticsTab = 'axes' | 'reports';

export default function AnalyticsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [activeTab, setActiveTab] = useState<AnalyticsTab>('axes');
  const [isLoading, setIsLoading] = useState(true);
  const [axes, setAxes] = useState<AnalyticAxis[]>([]);
  const [reportData, setReportData] = useState<AnalyticData[]>([]);
  const [selectedAxisId, setSelectedAxisId] = useState<string>('');

  // Modal state
  const [showAxisEditor, setShowAxisEditor] = useState(false);
  const [editingAxis, setEditingAxis] = useState<AnalyticAxis | null>(null);
  const [editorMode, setEditorMode] = useState<'axis' | 'value'>('axis');
  const [editingValue, setEditingValue] = useState<AnalyticValue | null>(null);
  const [editingAxisId, setEditingAxisId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would load from erp_analytic_axes and erp_analytic_data tables
      // For now, using mock data to demonstrate the UI
      const mockAxes: AnalyticAxis[] = [
        {
          id: '1',
          code: 'CC',
          name: 'Centres de coûts',
          description: 'Répartition des charges par centre de coûts',
          type: 'cost_center',
          is_active: true,
          is_mandatory: true,
          created_at: new Date().toISOString(),
          values: [
            { id: '1-1', axis_id: '1', code: 'ADM', name: 'Administration', is_active: true, budget: 50000, spent: 32500 },
            { id: '1-2', axis_id: '1', code: 'COM', name: 'Commercial', is_active: true, budget: 80000, spent: 65200 },
            { id: '1-3', axis_id: '1', code: 'TECH', name: 'Technique', is_active: true, budget: 120000, spent: 95800 },
            { id: '1-4', axis_id: '1', code: 'RH', name: 'Ressources Humaines', is_active: true, budget: 30000, spent: 18500 },
          ],
        },
        {
          id: '2',
          code: 'PROJ',
          name: 'Projets',
          description: 'Suivi des coûts par projet client',
          type: 'project',
          is_active: true,
          is_mandatory: false,
          created_at: new Date().toISOString(),
          values: [
            { id: '2-1', axis_id: '2', code: 'P2024-001', name: 'Migration ERP Dupont', is_active: true, budget: 45000, spent: 38200 },
            { id: '2-2', axis_id: '2', code: 'P2024-002', name: 'Site web Martin SA', is_active: true, budget: 25000, spent: 12800 },
            { id: '2-3', axis_id: '2', code: 'P2024-003', name: 'Application mobile Legrand', is_active: true, budget: 60000, spent: 42500 },
          ],
        },
        {
          id: '3',
          code: 'SITE',
          name: 'Sites',
          description: 'Charges par localisation géographique',
          type: 'location',
          is_active: true,
          is_mandatory: false,
          created_at: new Date().toISOString(),
          values: [
            { id: '3-1', axis_id: '3', code: 'PARIS', name: 'Paris - Siège', is_active: true, budget: 150000, spent: 125000 },
            { id: '3-2', axis_id: '3', code: 'LYON', name: 'Lyon - Agence', is_active: true, budget: 80000, spent: 62000 },
            { id: '3-3', axis_id: '3', code: 'REMOTE', name: 'Télétravail', is_active: true, budget: 20000, spent: 15500 },
          ],
        },
      ];

      setAxes(mockAxes);
      if (mockAxes.length > 0) {
        setSelectedAxisId(mockAxes[0].id);
      }

      // Mock report data
      const mockReportData: AnalyticData[] = [
        { axis_id: '1', value_id: '1-1', period: '2024-11', amount: 8500, transaction_count: 23 },
        { axis_id: '1', value_id: '1-2', period: '2024-11', amount: 15200, transaction_count: 45 },
        { axis_id: '1', value_id: '1-3', period: '2024-11', amount: 28500, transaction_count: 67 },
        { axis_id: '1', value_id: '1-4', period: '2024-11', amount: 4800, transaction_count: 12 },
        { axis_id: '2', value_id: '2-1', period: '2024-11', amount: 12500, transaction_count: 18 },
        { axis_id: '2', value_id: '2-2', period: '2024-11', amount: 5200, transaction_count: 8 },
        { axis_id: '2', value_id: '2-3', period: '2024-11', amount: 18900, transaction_count: 32 },
        { axis_id: '3', value_id: '3-1', period: '2024-11', amount: 35000, transaction_count: 89 },
        { axis_id: '3', value_id: '3-2', period: '2024-11', amount: 18500, transaction_count: 45 },
        { axis_id: '3', value_id: '3-3', period: '2024-11', amount: 4200, transaction_count: 15 },
      ];

      setReportData(mockReportData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Axis handlers
  const handleAddAxis = () => {
    setEditingAxis(null);
    setEditorMode('axis');
    setShowAxisEditor(true);
  };

  const handleEditAxis = (axis: AnalyticAxis) => {
    setEditingAxis(axis);
    setEditorMode('axis');
    setShowAxisEditor(true);
  };

  const handleDeleteAxis = async (axisId: string) => {
    // In a real app, this would delete from database
    setAxes(prev => prev.filter(a => a.id !== axisId));
  };

  const handleToggleAxis = async (axisId: string, isActive: boolean) => {
    setAxes(prev => prev.map(a =>
      a.id === axisId ? { ...a, is_active: isActive } : a
    ));
  };

  const handleSaveAxis = async (axisData: Partial<AnalyticAxis>) => {
    if (axisData.id) {
      // Update existing
      setAxes(prev => prev.map(a =>
        a.id === axisData.id ? { ...a, ...axisData } as AnalyticAxis : a
      ));
    } else {
      // Create new
      const newAxis: AnalyticAxis = {
        ...axisData,
        id: Date.now().toString(),
        values: [],
        created_at: new Date().toISOString(),
      } as AnalyticAxis;
      setAxes(prev => [...prev, newAxis]);
    }
    setShowAxisEditor(false);
  };

  // Value handlers
  const handleAddValue = (axisId: string) => {
    setEditingAxisId(axisId);
    setEditingValue(null);
    setEditorMode('value');
    setShowAxisEditor(true);
  };

  const handleEditValue = (axisId: string, value: AnalyticValue) => {
    setEditingAxisId(axisId);
    setEditingValue(value);
    setEditorMode('value');
    setShowAxisEditor(true);
  };

  const handleDeleteValue = async (axisId: string, valueId: string) => {
    setAxes(prev => prev.map(a => {
      if (a.id !== axisId) return a;
      return {
        ...a,
        values: a.values.filter(v => v.id !== valueId),
      };
    }));
  };

  const handleSaveValue = async (axisId: string, valueData: Partial<AnalyticValue>) => {
    setAxes(prev => prev.map(a => {
      if (a.id !== axisId) return a;

      if (valueData.id) {
        // Update existing
        return {
          ...a,
          values: a.values.map(v =>
            v.id === valueData.id ? { ...v, ...valueData } as AnalyticValue : v
          ),
        };
      } else {
        // Create new
        const newValue: AnalyticValue = {
          ...valueData,
          id: Date.now().toString(),
          axis_id: axisId,
          is_active: true,
        } as AnalyticValue;
        return {
          ...a,
          values: [...a.values, newValue],
        };
      }
    }));
    setShowAxisEditor(false);
  };

  const handleExport = () => {
    console.log('Exporting analytics data...');
    alert('Export CSV en cours de développement');
  };

  const tabs = [
    { id: 'axes' as const, label: 'Configuration', icon: Settings },
    { id: 'reports' as const, label: 'Analyse', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/org/${orgId}/erp/invoices`}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
                  <BarChart3 size={24} className="text-purple-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Comptabilité Analytique</h1>
                  <p className="text-sm text-slate-400">Gérez vos axes et suivez vos budgets</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'axes' && (
          <AnalyticAxesCard
            axes={axes}
            onAddAxis={handleAddAxis}
            onEditAxis={handleEditAxis}
            onDeleteAxis={handleDeleteAxis}
            onToggleAxis={handleToggleAxis}
            onAddValue={handleAddValue}
            onEditValue={handleEditValue}
            onDeleteValue={handleDeleteValue}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'reports' && (
          <AnalyticReportCard
            axes={axes}
            data={reportData}
            selectedAxisId={selectedAxisId}
            onAxisChange={setSelectedAxisId}
            onExport={handleExport}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Modal */}
      <AxisEditorModal
        isOpen={showAxisEditor}
        onClose={() => {
          setShowAxisEditor(false);
          setEditingAxis(null);
          setEditingValue(null);
        }}
        onSave={handleSaveAxis}
        axis={editingAxis}
        mode={editorMode}
        axisId={editingAxisId}
        value={editingValue}
        onSaveValue={handleSaveValue}
      />
    </div>
  );
}
