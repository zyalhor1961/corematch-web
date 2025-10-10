'use client';

/**
 * Custom Field View Component
 *
 * Allows users to create and save custom views with specific fields
 * Users can add multiple custom views and switch between them
 */

import React, { useState, useCallback } from 'react';
import {
  Plus,
  Save,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  GripVertical,
  Settings
} from 'lucide-react';

export interface CustomView {
  id: string;
  name: string;
  description?: string;
  selectedFields: string[]; // Field IDs to display
  createdAt: Date;
  updatedAt: Date;
}

interface CustomFieldViewProps {
  availableFields: {
    id: string;
    name: string;
    value: any;
    confidence: number;
  }[];
  orgId: string;
  isDarkMode?: boolean;
}

export const CustomFieldView: React.FC<CustomFieldViewProps> = ({
  availableFields,
  orgId,
  isDarkMode = false
}) => {
  const [views, setViews] = useState<CustomView[]>(() => {
    // Load saved views from localStorage
    const saved = localStorage.getItem(`custom-views-${orgId}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [activeViewId, setActiveViewId] = useState<string | null>(
    views.length > 0 ? views[0].id : null
  );
  const [isCreatingView, setIsCreatingView] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState('');
  const [newViewDescription, setNewViewDescription] = useState('');
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());

  // Save views to localStorage
  const saveViews = useCallback((updatedViews: CustomView[]) => {
    localStorage.setItem(`custom-views-${orgId}`, JSON.stringify(updatedViews));
    setViews(updatedViews);
  }, [orgId]);

  // Create new view
  const handleCreateView = useCallback(() => {
    if (!newViewName.trim()) return;

    const newView: CustomView = {
      id: `view-${Date.now()}`,
      name: newViewName.trim(),
      description: newViewDescription.trim() || undefined,
      selectedFields: Array.from(selectedFieldIds),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedViews = [...views, newView];
    saveViews(updatedViews);
    setActiveViewId(newView.id);
    setIsCreatingView(false);
    setNewViewName('');
    setNewViewDescription('');
    setSelectedFieldIds(new Set());
  }, [newViewName, newViewDescription, selectedFieldIds, views, saveViews]);

  // Update existing view
  const handleUpdateView = useCallback((viewId: string) => {
    const updatedViews = views.map(view =>
      view.id === viewId
        ? {
            ...view,
            selectedFields: Array.from(selectedFieldIds),
            updatedAt: new Date()
          }
        : view
    );
    saveViews(updatedViews);
    setEditingViewId(null);
  }, [views, selectedFieldIds, saveViews]);

  // Delete view
  const handleDeleteView = useCallback((viewId: string) => {
    const updatedViews = views.filter(v => v.id !== viewId);
    saveViews(updatedViews);
    if (activeViewId === viewId) {
      setActiveViewId(updatedViews.length > 0 ? updatedViews[0].id : null);
    }
  }, [views, activeViewId, saveViews]);

  // Toggle field selection
  const toggleFieldSelection = useCallback((fieldId: string) => {
    const newSelection = new Set(selectedFieldIds);
    if (newSelection.has(fieldId)) {
      newSelection.delete(fieldId);
    } else {
      newSelection.add(fieldId);
    }
    setSelectedFieldIds(newSelection);
  }, [selectedFieldIds]);

  // Get active view
  const activeView = views.find(v => v.id === activeViewId);

  // Get displayed fields based on active view
  const displayedFields = activeView
    ? availableFields.filter(f => activeView.selectedFields.includes(f.id))
    : availableFields;

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Header with View Selector */}
      <div className={`p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Custom Field Views
          </h2>
          <button
            onClick={() => {
              setIsCreatingView(true);
              setSelectedFieldIds(new Set());
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
              isDarkMode
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            New View
          </button>
        </div>

        {/* View Tabs */}
        {views.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {views.map(view => (
              <button
                key={view.id}
                onClick={() => setActiveViewId(view.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  activeViewId === view.id
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-600 text-white'
                    : isDarkMode
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Eye className="w-4 h-4" />
                {view.name}
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  activeViewId === view.id
                    ? 'bg-white/20'
                    : isDarkMode
                      ? 'bg-slate-700'
                      : 'bg-slate-200'
                }`}>
                  {view.selectedFields.length}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isCreatingView || editingViewId ? (
          <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {editingViewId ? 'Edit View' : 'Create New View'}
            </h3>

            {!editingViewId && (
              <>
                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    View Name *
                  </label>
                  <input
                    type="text"
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    placeholder="e.g., Invoice Essential Fields"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Description (optional)
                  </label>
                  <textarea
                    value={newViewDescription}
                    onChange={(e) => setNewViewDescription(e.target.value)}
                    placeholder="Brief description of this view..."
                    rows={2}
                    className={`w-full px-4 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </>
            )}

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Select Fields ({selectedFieldIds.size} selected)
              </label>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableFields.map(field => (
                  <label
                    key={field.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedFieldIds.has(field.id)
                        ? isDarkMode
                          ? 'bg-blue-900/30 border-blue-500'
                          : 'bg-blue-50 border-blue-500'
                        : isDarkMode
                          ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFieldIds.has(field.id)}
                      onChange={() => toggleFieldSelection(field.id)}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {field.name}
                      </div>
                      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {String(field.value).substring(0, 50)}
                        {String(field.value).length > 50 ? '...' : ''}
                      </div>
                    </div>
                    <div className={`text-xs font-medium ${
                      field.confidence >= 0.95 ? 'text-green-600' :
                      field.confidence >= 0.80 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {(field.confidence * 100).toFixed(0)}%
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (editingViewId) {
                    handleUpdateView(editingViewId);
                  } else {
                    handleCreateView();
                  }
                }}
                disabled={!editingViewId && !newViewName.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  isDarkMode
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                } disabled:opacity-50`}
              >
                <Save className="w-4 h-4" />
                {editingViewId ? 'Update View' : 'Create View'}
              </button>
              <button
                onClick={() => {
                  setIsCreatingView(false);
                  setEditingViewId(null);
                  setNewViewName('');
                  setNewViewDescription('');
                  setSelectedFieldIds(new Set());
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : activeView ? (
          <div>
            {/* View Info */}
            <div className={`flex items-start justify-between mb-4 p-4 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
              <div>
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {activeView.name}
                </h3>
                {activeView.description && (
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {activeView.description}
                  </p>
                )}
                <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                  {activeView.selectedFields.length} fields · Updated {new Date(activeView.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingViewId(activeView.id);
                    setSelectedFieldIds(new Set(activeView.selectedFields));
                  }}
                  className={`p-2 rounded-lg transition-all ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200'}`}
                  title="Edit view"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteView(activeView.id)}
                  className={`p-2 rounded-lg transition-all ${isDarkMode ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-100 text-red-600'}`}
                  title="Delete view"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Display Selected Fields */}
            <div className="text-center py-8">
              <Settings className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
              <p className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Custom view active
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Showing {displayedFields.length} selected fields in the extraction panel
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <EyeOff className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
            <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              No Custom Views
            </h3>
            <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Create your first custom view to organize extracted fields
            </p>
            <button
              onClick={() => setIsCreatingView(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium mx-auto transition-all ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              Create First View
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
