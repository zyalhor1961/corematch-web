'use client';

import React, { useState } from 'react';
import {
    Filter,
    Columns,
    SortAsc,
    SortDesc,
    Plus,
    X,
    Download,
    Sparkles,
} from 'lucide-react';
import { useSmartData } from '@/hooks/useSmartData';
import type {
    SmartDataGridProps,
    FilterCondition,
    FilterOperator,
} from '@/types/data-grid';
import { cn } from '@/lib/utils';

/**
 * SmartDataGrid Component
 * 
 * A highly interactive data grid (Mini-Excel) with:
 * - Column visibility toggling
 * - Multi-condition filtering
 * - Sortable headers
 * - Natural language interface
 * - Glassmorphism styling
 * - Responsive design
 */
export function SmartDataGrid<T extends Record<string, any>>({
    data,
    columns,
    title,
    onNaturalQuery,
    className,
    enableColumnVisibility = true,
    enableFiltering = true,
    enableSorting = true,
    enableNaturalLanguage = true,
}: SmartDataGridProps<T>) {
    const {
        processedData,
        sortConfig,
        setSortConfig,
        filterConditions,
        addFilter,
        removeFilter,
        clearFilters,
        hiddenColumns,
        toggleColumn,
        visibleColumns,
        columnConfigs,
        applyNaturalQuery,
    } = useSmartData({ data, columns });

    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [showFilterBar, setShowFilterBar] = useState(false);
    const [naturalQuery, setNaturalQuery] = useState('');
    const [newFilter, setNewFilter] = useState<Partial<FilterCondition>>({
        column: visibleColumns[0]?.key || '',
        operator: 'contains',
        value: '',
    });

    // Handle sort
    const handleSort = (columnKey: string) => {
        if (!enableSorting) return;

        if (sortConfig?.column === columnKey) {
            // Toggle direction or clear
            if (sortConfig.direction === 'asc') {
                setSortConfig({ column: columnKey, direction: 'desc' });
            } else {
                setSortConfig(null);
            }
        } else {
            setSortConfig({ column: columnKey, direction: 'asc' });
        }
    };

    // Handle add filter
    const handleAddFilter = () => {
        if (newFilter.column && newFilter.operator && newFilter.value !== '' && newFilter.value !== undefined) {
            addFilter({
                id: `filter-${Date.now()}`,
                column: newFilter.column,
                operator: newFilter.operator as FilterOperator,
                value: newFilter.value as string | number,
            });
            setNewFilter({
                column: visibleColumns[0]?.key || '',
                operator: 'contains',
                value: '',
            });
        }
    };

    // Handle natural language query
    const handleNaturalQuery = (e: React.FormEvent) => {
        e.preventDefault();
        if (naturalQuery.trim()) {
            applyNaturalQuery(naturalQuery);
            if (onNaturalQuery) {
                onNaturalQuery(naturalQuery);
            }
        } else {
            clearFilters();
        }
    };

    // Export to CSV
    const exportToCSV = () => {
        if (!processedData || processedData.length === 0) return;

        // Créer les en-têtes
        const headers = visibleColumns.map((col) => col.label).join(',');

        // Créer les lignes de données
        const rows = processedData
            .map((row) =>
                visibleColumns
                    .map((col) => {
                        const val = row[col.key];
                        const formatted = col.formatter ? col.formatter(val) : String(val ?? '');
                        // Échapper les guillemets et entourer de guillemets si nécessaire
                        return `"${formatted.replace(/"/g, '""')}"`;
                    })
                    .join(',')
            )
            .join('\n');

        // Combiner en-têtes et données
        const csvContent = `${headers}\n${rows}`;

        // Ajouter le BOM UTF-8 pour Excel
        const BOM = '\uFEFF';
        const csvWithBOM = BOM + csvContent;

        // Créer un Blob avec l'encodage UTF-8
        const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });

        // Créer un lien de téléchargement
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute(
            'download',
            `${title || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`
        );
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Operator options
    const operatorOptions: { value: FilterOperator; label: string }[] = [
        { value: 'equals', label: 'Equals' },
        { value: 'notEquals', label: 'Not Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'notContains', label: 'Not Contains' },
        { value: 'greaterThan', label: '>' },
        { value: 'lessThan', label: '<' },
        { value: 'greaterThanOrEqual', label: '>=' },
        { value: 'lessThanOrEqual', label: '<=' },
        { value: 'startsWith', label: 'Starts With' },
        { value: 'endsWith', label: 'Ends With' },
    ];

    if (!data || data.length === 0) {
        return (
            <div className={cn('p-8 text-center text-slate-500 italic', className)}>
                No data available
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col gap-4', className)}>
            {/* Natural Language Interface */}
            {enableNaturalLanguage && (
                <form onSubmit={handleNaturalQuery} className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Sparkles size={18} className="text-purple-400 group-focus-within:text-purple-300 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Ask your data... (e.g., 'big expenses', 'recent', 'pending')"
                        value={naturalQuery}
                        onChange={(e) => setNaturalQuery(e.target.value)}
                        className="w-full bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border border-purple-500/30 text-white text-sm rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-purple-400/50 focus:ring-2 focus:ring-purple-500/30 transition-all placeholder:text-slate-500 backdrop-blur-sm"
                    />
                </form>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex items-center gap-3">
                    {title && (
                        <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider">
                            {title}
                        </h3>
                    )}
                    <span className="text-xs text-slate-600">
                        {processedData.length} {processedData.length === 1 ? 'row' : 'rows'}
                    </span>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {/* Column Visibility */}
                    {enableColumnVisibility && columnConfigs.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => setShowColumnMenu(!showColumnMenu)}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium rounded-lg border border-white/10 transition-all backdrop-blur-sm"
                            >
                                <Columns size={14} />
                                Columns
                            </button>
                            {showColumnMenu && (
                                <div className="absolute right-0 mt-2 w-56 bg-[#0F172A]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                                    <div className="p-2 max-h-64 overflow-y-auto">
                                        {columnConfigs.map((col) => (
                                            <label
                                                key={col.key}
                                                className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={!hiddenColumns.has(col.key)}
                                                    onChange={() => toggleColumn(col.key)}
                                                    className="w-4 h-4 rounded border-white/20 bg-slate-800 text-teal-500 focus:ring-2 focus:ring-teal-500/50"
                                                />
                                                <span className="text-xs text-slate-300">{col.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Filter Toggle */}
                    {enableFiltering && (
                        <button
                            onClick={() => setShowFilterBar(!showFilterBar)}
                            className={cn(
                                'flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all backdrop-blur-sm',
                                showFilterBar || filterConditions.length > 0
                                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border-white/10'
                            )}
                        >
                            <Filter size={14} />
                            Filter
                            {filterConditions.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 bg-teal-500 text-white text-[10px] rounded-full">
                                    {filterConditions.length}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Export CSV */}
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium rounded-lg border border-white/10 transition-all backdrop-blur-sm"
                    >
                        <Download size={14} />
                        CSV
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            {enableFiltering && showFilterBar && (
                <div className="bg-[#0F172A]/60 backdrop-blur-xl border border-white/5 rounded-xl p-4 space-y-3">
                    {/* Active Filters */}
                    {filterConditions.length > 0 && (
                        <div className="flex flex-wrap gap-2 pb-3 border-b border-white/5">
                            {filterConditions.map((filter) => (
                                <div
                                    key={filter.id}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 rounded-lg text-xs text-teal-300"
                                >
                                    <span className="font-medium">
                                        {visibleColumns.find((c) => c.key === filter.column)?.label || filter.column}
                                    </span>
                                    <span className="text-teal-400/70">{filter.operator}</span>
                                    <span className="font-mono">{String(filter.value)}</span>
                                    <button
                                        onClick={() => removeFilter(filter.id)}
                                        className="ml-1 hover:text-red-400 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={clearFilters}
                                className="px-3 py-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
                            >
                                Clear All
                            </button>
                        </div>
                    )}

                    {/* Add New Filter */}
                    <div className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-[10px] uppercase text-slate-500 mb-1 tracking-wider">
                                Column
                            </label>
                            <select
                                value={newFilter.column}
                                onChange={(e) => setNewFilter({ ...newFilter, column: e.target.value })}
                                className="w-full bg-slate-900/50 border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50"
                            >
                                {visibleColumns.map((col) => (
                                    <option key={col.key} value={col.key}>
                                        {col.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex-1 min-w-[120px]">
                            <label className="block text-[10px] uppercase text-slate-500 mb-1 tracking-wider">
                                Operator
                            </label>
                            <select
                                value={newFilter.operator}
                                onChange={(e) =>
                                    setNewFilter({ ...newFilter, operator: e.target.value as FilterOperator })
                                }
                                className="w-full bg-slate-900/50 border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50"
                            >
                                {operatorOptions.map((op) => (
                                    <option key={op.value} value={op.value}>
                                        {op.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-[10px] uppercase text-slate-500 mb-1 tracking-wider">
                                Value
                            </label>
                            <input
                                type="text"
                                value={newFilter.value}
                                onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
                                placeholder="Enter value..."
                                className="w-full bg-slate-900/50 border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50"
                            />
                        </div>

                        <button
                            onClick={handleAddFilter}
                            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                        >
                            <Plus size={14} />
                            Add
                        </button>
                    </div>
                </div>
            )}

            {/* Table Container - Glassmorphism */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0F172A]/60 backdrop-blur-xl shadow-2xl">
                {/* Responsive Table Wrapper */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                        {/* Header */}
                        <thead className="bg-slate-900/80 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-white/10">
                            <tr>
                                {visibleColumns.map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => col.sortable !== false && handleSort(col.key)}
                                        className={cn(
                                            'px-6 py-4 select-none group',
                                            col.sortable !== false && enableSorting && 'cursor-pointer hover:text-teal-400 transition-colors'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            {col.label}
                                            {col.sortable !== false && enableSorting && (
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {sortConfig?.column === col.key ? (
                                                        sortConfig.direction === 'asc' ? (
                                                            <SortAsc size={12} className="text-teal-400" />
                                                        ) : (
                                                            <SortDesc size={12} className="text-teal-400" />
                                                        )
                                                    ) : (
                                                        <SortAsc size={12} className="text-slate-700" />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        {/* Body */}
                        <tbody className="divide-y divide-white/5">
                            {processedData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={visibleColumns.length}
                                        className="px-6 py-16 text-center text-slate-600 font-light"
                                    >
                                        No matching data found
                                    </td>
                                </tr>
                            ) : (
                                processedData.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        className="group hover:bg-white/[0.02] transition-colors"
                                    >
                                        {visibleColumns.map((col) => (
                                            <td
                                                key={`${idx}-${col.key}`}
                                                className="px-6 py-3 font-mono text-xs text-slate-300 group-hover:text-white transition-colors"
                                            >
                                                {col.formatter
                                                    ? col.formatter(row[col.key])
                                                    : String(row[col.key] ?? '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-white/5 bg-slate-900/50 text-xs text-slate-500 flex justify-between items-center">
                    <span>
                        Showing {processedData.length} of {data.length} rows
                    </span>
                    {filterConditions.length > 0 && (
                        <span className="text-teal-400">
                            {filterConditions.length} filter{filterConditions.length !== 1 ? 's' : ''} active
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SmartDataGrid;
