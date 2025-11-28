'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Download, Search } from 'lucide-react';

interface SmartTableProps {
    data: any[];
    columns?: string[];
    title?: string;
    className?: string;
}

export const SmartTable: React.FC<SmartTableProps> = ({ data, columns, title, className = '' }) => {
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Determine Columns (Auto-generate if not provided)
    const tableColumns = useMemo(() => {
        if (columns && columns.length > 0) return columns;
        if (data && data.length > 0) return Object.keys(data[0]);
        return [];
    }, [data, columns]);

    // 2. Filter Data
    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        return data.filter(row =>
            Object.values(row).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [data, searchTerm]);

    // 3. Sort Data
    const sortedData = useMemo(() => {
        if (!sortConfig) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortConfig]);

    // Handler for sorting
    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Handler for CSV Export
    const downloadCSV = () => {
        if (!sortedData || sortedData.length === 0) return;

        const headers = tableColumns.join(',');
        const rows = sortedData.map(row =>
            tableColumns.map(col => {
                const val = row[col];
                // Escape quotes and wrap in quotes if necessary
                const stringVal = String(val === null || val === undefined ? '' : val);
                return `"${stringVal.replace(/"/g, '""')}"`;
            }).join(',')
        ).join('\n');

        const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${title || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!data || data.length === 0) {
        return (
            <div className={`p-6 text-center text-slate-500 italic border border-white/5 rounded-xl bg-slate-900/50 ${className}`}>
                No data available
            </div>
        );
    }

    return (
        <div className={`flex flex-col gap-4 w-full max-w-full min-w-0 ${className}`}>
            {/* Toolbar */}
            <div className="flex justify-between items-center">
                {title && <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider">{title}</h3>}

                <div className="flex gap-2">
                    {/* Search Input */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900/50 border border-white/10 text-white text-xs rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all w-48"
                        />
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={downloadCSV}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-white/5 transition-colors"
                    >
                        <Download size={14} />
                        CSV
                    </button>
                </div>
            </div>

            {/* Table Container (GlassCard style) */}
            <div className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0B1121]/80 backdrop-blur-sm shadow-xl">
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900/80 text-xs uppercase font-medium text-slate-500 border-b border-white/5">
                            <tr>
                                {tableColumns.map((col) => (
                                    <th
                                        key={col}
                                        onClick={() => requestSort(col)}
                                        className="px-6 py-3 cursor-pointer hover:text-indigo-400 transition-colors select-none group"
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.replace(/_/g, ' ')}
                                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                {sortConfig?.key === col ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                                ) : (
                                                    <ChevronDown size={12} className="text-slate-700" />
                                                )}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sortedData.map((row, idx) => (
                                <tr
                                    key={idx}
                                    className="hover:bg-white/[0.02] transition-colors group"
                                >
                                    {tableColumns.map((col) => (
                                        <td key={`${idx}-${col}`} className="px-6 py-3 font-mono text-xs text-slate-300 group-hover:text-white transition-colors">
                                            {/* Simple formatting for amounts or dates could go here */}
                                            {String(row[col])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Pagination (simplified) */}
                <div className="px-6 py-3 border-t border-white/5 bg-slate-900/50 text-xs text-slate-500 flex justify-between">
                    <span>Showing {sortedData.length} rows</span>
                </div>
            </div>
        </div>
    );
};
