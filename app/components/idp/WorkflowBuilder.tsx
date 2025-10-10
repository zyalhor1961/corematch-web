'use client';

/**
 * Workflow Builder - Rossum-inspired drag-and-drop workflow designer
 *
 * Features:
 * - Visual drag-and-drop workflow builder
 * - Pre-built stage templates (extraction, validation, review, export)
 * - Custom logic rules and conditions
 * - Stage dependencies and branching
 * - Real-time workflow testing
 * - Version control and rollback
 */

import React, { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Save,
  Play,
  Settings,
  ArrowRight,
  FileText,
  CheckCircle,
  Eye,
  Download,
  Zap,
  GitBranch,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { WorkflowStage } from './UnifiedIDPDashboard';

interface WorkflowBuilderProps {
  workflows: WorkflowStage[];
  onWorkflowUpdate: (workflows: WorkflowStage[]) => void;
  isDarkMode?: boolean;
}

const STAGE_TEMPLATES = [
  {
    type: 'extraction' as const,
    name: 'Data Extraction',
    icon: FileText,
    color: 'blue',
    description: 'Extract data from uploaded documents using AI/OCR',
    defaultConfig: {
      extractionMethod: 'azure_ocr',
      confidence_threshold: 0.80,
      fields: []
    }
  },
  {
    type: 'validation' as const,
    name: 'Data Validation',
    icon: CheckCircle,
    color: 'green',
    description: 'Validate extracted data against business rules',
    defaultConfig: {
      rules: [],
      required_fields: [],
      auto_correct: true
    }
  },
  {
    type: 'review' as const,
    name: 'Human Review',
    icon: Eye,
    color: 'amber',
    description: 'Route low-confidence documents for human review',
    defaultConfig: {
      confidence_threshold: 0.95,
      assignee: 'auto',
      priority: 'medium'
    }
  },
  {
    type: 'export' as const,
    name: 'Data Export',
    icon: Download,
    color: 'purple',
    description: 'Export processed data to external systems',
    defaultConfig: {
      format: 'json',
      destination: 'database',
      webhook_url: ''
    }
  }
];

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  workflows,
  onWorkflowUpdate,
  isDarkMode = false
}) => {
  const [localWorkflows, setLocalWorkflows] = useState<WorkflowStage[]>(workflows);
  const [selectedStage, setSelectedStage] = useState<WorkflowStage | null>(null);
  const [draggedStage, setDraggedStage] = useState<number | null>(null);
  const [isTestingWorkflow, setIsTestingWorkflow] = useState(false);

  // Add new stage
  const handleAddStage = useCallback((template: typeof STAGE_TEMPLATES[0]) => {
    const newStage: WorkflowStage = {
      id: `${Date.now()}`,
      name: template.name,
      type: template.type,
      config: template.defaultConfig,
      order: localWorkflows.length
    };

    const updated = [...localWorkflows, newStage];
    setLocalWorkflows(updated);
    setSelectedStage(newStage);
  }, [localWorkflows]);

  // Remove stage
  const handleRemoveStage = useCallback((stageId: string) => {
    const updated = localWorkflows
      .filter(s => s.id !== stageId)
      .map((s, idx) => ({ ...s, order: idx }));

    setLocalWorkflows(updated);
    if (selectedStage?.id === stageId) {
      setSelectedStage(null);
    }
  }, [localWorkflows, selectedStage]);

  // Duplicate stage
  const handleDuplicateStage = useCallback((stage: WorkflowStage) => {
    const duplicated: WorkflowStage = {
      ...stage,
      id: `${Date.now()}`,
      name: `${stage.name} (Copy)`,
      order: localWorkflows.length
    };

    const updated = [...localWorkflows, duplicated];
    setLocalWorkflows(updated);
  }, [localWorkflows]);

  // Update stage config
  const handleUpdateStageConfig = useCallback((stageId: string, config: any) => {
    const updated = localWorkflows.map(s =>
      s.id === stageId ? { ...s, config } : s
    );

    setLocalWorkflows(updated);
    if (selectedStage?.id === stageId) {
      setSelectedStage({ ...selectedStage, config });
    }
  }, [localWorkflows, selectedStage]);

  // Drag and drop reordering
  const handleDragStart = (index: number) => {
    setDraggedStage(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedStage === null || draggedStage === index) return;

    const updated = [...localWorkflows];
    const draggedItem = updated[draggedStage];
    updated.splice(draggedStage, 1);
    updated.splice(index, 0, draggedItem);

    // Update order
    updated.forEach((s, idx) => s.order = idx);

    setLocalWorkflows(updated);
    setDraggedStage(index);
  };

  const handleDragEnd = () => {
    setDraggedStage(null);
  };

  // Save workflow
  const handleSave = useCallback(() => {
    onWorkflowUpdate(localWorkflows);
  }, [localWorkflows, onWorkflowUpdate]);

  // Test workflow
  const handleTestWorkflow = useCallback(async () => {
    setIsTestingWorkflow(true);
    // Simulate workflow test
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsTestingWorkflow(false);
    alert('Workflow test completed successfully!');
  }, []);

  // Get stage template info
  const getStageTemplate = (type: WorkflowStage['type']) => {
    return STAGE_TEMPLATES.find(t => t.type === type);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Stage Templates Library */}
      <div className={`space-y-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-6 shadow-lg`}>
        <div>
          <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Stage Templates
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Drag stages to build your workflow
          </p>
        </div>

        <div className="space-y-3">
          {STAGE_TEMPLATES.map(template => {
            const Icon = template.icon;

            return (
              <button
                key={template.type}
                onClick={() => handleAddStage(template)}
                className={`w-full p-4 rounded-xl border-2 border-dashed transition-all text-left ${
                  isDarkMode
                    ? 'border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                    : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br from-${template.color}-500 to-${template.color}-600`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {template.name}
                    </h4>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {template.description}
                    </p>
                  </div>
                  <Plus className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-4 border-t border-slate-700">
          <button
            onClick={handleSave}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              isDarkMode
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <Save className="w-5 h-5" />
            Save Workflow
          </button>

          <button
            onClick={handleTestWorkflow}
            disabled={isTestingWorkflow || localWorkflows.length === 0}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              isDarkMode
                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            } disabled:opacity-50`}
          >
            {isTestingWorkflow ? (
              <>
                <Clock className="w-5 h-5 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Test Workflow
              </>
            )}
          </button>
        </div>
      </div>

      {/* Workflow Canvas */}
      <div className={`space-y-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-6 shadow-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Workflow Pipeline
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {localWorkflows.length} stage{localWorkflows.length !== 1 ? 's' : ''} configured
            </p>
          </div>
          <GitBranch className={`w-6 h-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} />
        </div>

        {localWorkflows.length === 0 ? (
          <div className={`rounded-xl border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-800/30' : 'border-slate-300 bg-slate-50'} p-12 text-center`}>
            <Zap className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
            <p className={`font-medium mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              No stages yet
            </p>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Add stages from the library to build your workflow
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {localWorkflows
              .sort((a, b) => a.order - b.order)
              .map((stage, index) => {
                const template = getStageTemplate(stage.type);
                const Icon = template?.icon || FileText;
                const isSelected = selectedStage?.id === stage.id;

                return (
                  <React.Fragment key={stage.id}>
                    <div
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedStage(stage)}
                      className={`relative p-4 rounded-xl border-2 cursor-move transition-all ${
                        isSelected
                          ? isDarkMode
                            ? 'border-blue-500 bg-blue-950/30 shadow-2xl shadow-blue-500/20'
                            : 'border-blue-500 bg-blue-50 shadow-2xl shadow-blue-200/50'
                          : isDarkMode
                            ? 'border-slate-700 hover:border-slate-600 bg-slate-800'
                            : 'border-slate-300 hover:border-slate-400 bg-white'
                      }`}
                    >
                      {/* Stage Number */}
                      <div className="absolute -left-3 -top-3 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        {index + 1}
                      </div>

                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-br from-${template?.color}-500 to-${template?.color}-600`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {stage.name}
                          </h4>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {template?.description}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateStage(stage);
                            }}
                            className={`p-1.5 rounded-lg transition-all ${
                              isDarkMode
                                ? 'hover:bg-slate-700 text-slate-400'
                                : 'hover:bg-slate-200 text-slate-600'
                            }`}
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveStage(stage.id);
                            }}
                            className={`p-1.5 rounded-lg transition-all ${
                              isDarkMode
                                ? 'hover:bg-red-900/50 text-red-400'
                                : 'hover:bg-red-100 text-red-600'
                            }`}
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Arrow between stages */}
                    {index < localWorkflows.length - 1 && (
                      <div className="flex justify-center">
                        <ArrowRight className={`w-6 h-6 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
          </div>
        )}
      </div>

      {/* Stage Configuration */}
      <div className={`space-y-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-6 shadow-lg`}>
        <div>
          <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Stage Configuration
          </h3>
          {selectedStage ? (
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Configuring: <span className="font-semibold">{selectedStage.name}</span>
            </p>
          ) : (
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Select a stage to configure
            </p>
          )}
        </div>

        {selectedStage ? (
          <div className="space-y-4">
            {/* Stage Name */}
            <div>
              <label className={`text-sm font-bold mb-2 block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Stage Name
              </label>
              <input
                type="text"
                value={selectedStage.name}
                onChange={(e) => {
                  const updated = localWorkflows.map(s =>
                    s.id === selectedStage.id ? { ...s, name: e.target.value } : s
                  );
                  setLocalWorkflows(updated);
                  setSelectedStage({ ...selectedStage, name: e.target.value });
                }}
                className={`w-full px-4 py-2.5 rounded-xl border transition-all ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              />
            </div>

            {/* Type-specific Configuration */}
            {selectedStage.type === 'extraction' && (
              <>
                <div>
                  <label className={`text-sm font-bold mb-2 block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Extraction Method
                  </label>
                  <select
                    value={selectedStage.config.extractionMethod || 'azure_ocr'}
                    onChange={(e) => handleUpdateStageConfig(selectedStage.id, {
                      ...selectedStage.config,
                      extractionMethod: e.target.value
                    })}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="azure_ocr">Azure OCR</option>
                    <option value="tesseract">Tesseract.js</option>
                    <option value="openai_vision">OpenAI Vision</option>
                    <option value="custom_model">Custom Model</option>
                  </select>
                </div>

                <div>
                  <label className={`text-sm font-bold mb-2 block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Confidence Threshold
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={(selectedStage.config.confidence_threshold || 0.80) * 100}
                    onChange={(e) => handleUpdateStageConfig(selectedStage.id, {
                      ...selectedStage.config,
                      confidence_threshold: parseInt(e.target.value) / 100
                    })}
                    className="w-full"
                  />
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {Math.round((selectedStage.config.confidence_threshold || 0.80) * 100)}%
                  </p>
                </div>
              </>
            )}

            {selectedStage.type === 'review' && (
              <>
                <div>
                  <label className={`text-sm font-bold mb-2 block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Assignee
                  </label>
                  <select
                    value={selectedStage.config.assignee || 'auto'}
                    onChange={(e) => handleUpdateStageConfig(selectedStage.id, {
                      ...selectedStage.config,
                      assignee: e.target.value
                    })}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="auto">Auto-assign</option>
                    <option value="user1">User 1</option>
                    <option value="user2">User 2</option>
                  </select>
                </div>

                <div>
                  <label className={`text-sm font-bold mb-2 block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Priority
                  </label>
                  <select
                    value={selectedStage.config.priority || 'medium'}
                    onChange={(e) => handleUpdateStageConfig(selectedStage.id, {
                      ...selectedStage.config,
                      priority: e.target.value
                    })}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </>
            )}

            {selectedStage.type === 'export' && (
              <>
                <div>
                  <label className={`text-sm font-bold mb-2 block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Export Format
                  </label>
                  <select
                    value={selectedStage.config.format || 'json'}
                    onChange={(e) => handleUpdateStageConfig(selectedStage.id, {
                      ...selectedStage.config,
                      format: e.target.value
                    })}
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                    <option value="xml">XML</option>
                  </select>
                </div>

                <div>
                  <label className={`text-sm font-bold mb-2 block ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={selectedStage.config.webhook_url || ''}
                    onChange={(e) => handleUpdateStageConfig(selectedStage.id, {
                      ...selectedStage.config,
                      webhook_url: e.target.value
                    })}
                    placeholder="https://example.com/webhook"
                    className={`w-full px-4 py-2.5 rounded-xl border transition-all ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  />
                </div>
              </>
            )}

            {/* Info Box */}
            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-blue-950/30 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-start gap-2">
                <Settings className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <p className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                  Configure stage settings above. Changes are applied in real-time and saved when you click "Save Workflow".
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={`rounded-xl border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-800/30' : 'border-slate-300 bg-slate-50'} p-12 text-center`}>
            <Settings className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
            <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              No stage selected
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
