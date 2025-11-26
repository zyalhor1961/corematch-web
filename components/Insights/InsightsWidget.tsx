'use client';

import React from 'react';
import { SmartDataGrid } from '@/components/BI/SmartDataGrid';
import type { ColumnConfig } from '@/types/data-grid';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Table, AlertCircle } from 'lucide-react';

interface InsightResult {
    type: 'table' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'metric' | 'text';
    data: any[];
    columns?: string[];
    summary?: string;
}

interface InsightsWidgetProps {
    result: InsightResult | null;
    loading?: boolean;
    error?: string;
    className?: string;
}

const CHART_COLORS = [
    '#14b8a6', // teal-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#f59e0b', // amber-500
];

// Helper for consistent value formatting
function formatValue(value: any, key: string = ''): string {
    const num = Number(value);
    if (isNaN(num) || value === null || value === undefined || value === '') return String(value);

    // Don't format integers that look like IDs or years if they are small/exact
    if (Number.isInteger(num) && num > 1900 && num < 2100 && (key.includes('year') || key.includes('année'))) {
        return String(num);
    }

    const keyLower = key.toLowerCase();

    // Percentage detection
    if (keyLower.includes('percent') || keyLower.includes('taux') || keyLower.includes('%') || keyLower.includes('share') || keyLower.includes('part') || keyLower.includes('rate') || keyLower.includes('ratio') || keyLower.includes('frequence')) {
        return `${num.toFixed(2)}%`;
    }

    // Currency detection
    if (keyLower.includes('amount') || keyLower.includes('montant') || keyLower.includes('price') || keyLower.includes('prix') || keyLower.includes('total') || keyLower.includes('ca') || keyLower.includes('revenue')) {
        return `${num.toFixed(2)} €`;
    }

    // Default number formatting
    // If it's an integer, show as is.
    if (Number.isInteger(num)) return String(num);

    // If it has many decimals (e.g. 63.15789...), force rounding even if key doesn't match
    // This catches cases where column name is generic but value is clearly a calculated rate/amount
    return num.toFixed(2);
}

export function InsightsWidget({ result, loading, error, className = '' }: InsightsWidgetProps) {
    if (loading) {
        return (
            <div className={`p-12 text-center ${className}`}>
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mb-4"></div>
                <p className="text-slate-400">Analyse en cours...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`p-8 bg-red-500/10 border border-red-500/30 rounded-xl ${className}`}>
                <div className="flex items-center gap-3 text-red-400">
                    <AlertCircle size={24} />
                    <div>
                        <h3 className="font-bold mb-1">Erreur d'analyse</h3>
                        <p className="text-sm text-red-300">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!result) {
        return (
            <div className={`p-12 text-center text-slate-500 ${className}`}>
                <BarChart3 size={48} className="mx-auto mb-4 text-slate-600" />
                <p>Posez une question pour voir les insights</p>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Summary Section */}
            {result.summary && (
                <div className="p-6 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/30 rounded-xl backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                        <TrendingUp size={20} className="text-teal-400 mt-1 flex-shrink-0" />
                        <p className="text-white text-sm leading-relaxed">{result.summary}</p>
                    </div>
                </div>
            )}

            {/* Visualization Section */}
            <div className="bg-[#0F172A]/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-2xl space-y-8">
                {result.type === 'table' && (
                    <TableVisualization data={result.data} columns={result.columns} />
                )}

                {result.type === 'bar_chart' && (
                    <>
                        <div className="border-b border-white/10 pb-6 mb-6">
                            <h4 className="text-slate-400 text-sm font-medium mb-4 uppercase tracking-wider">Données Détaillées</h4>
                            <TableVisualization data={result.data} />
                        </div>
                        <BarChartVisualization data={result.data} />
                    </>
                )}

                {result.type === 'line_chart' && (
                    <>
                        <div className="border-b border-white/10 pb-6 mb-6">
                            <h4 className="text-slate-400 text-sm font-medium mb-4 uppercase tracking-wider">Données Détaillées</h4>
                            <TableVisualization data={result.data} />
                        </div>
                        <LineChartVisualization data={result.data} />
                    </>
                )}

                {result.type === 'pie_chart' && (
                    <>
                        <div className="border-b border-white/10 pb-6 mb-6">
                            <h4 className="text-slate-400 text-sm font-medium mb-4 uppercase tracking-wider">Données Détaillées</h4>
                            <TableVisualization data={result.data} />
                        </div>
                        <PieChartVisualization data={result.data} />
                    </>
                )}

                {result.type === 'metric' && (
                    <MetricVisualization data={result.data} />
                )}

                {result.type === 'text' && (
                    <TextVisualization data={result.data} />
                )}
            </div>
        </div>
    );
}

// Table Visualization using SmartDataGrid
function TableVisualization({ data, columns }: { data: any[]; columns?: string[] }) {
    if (!data || data.length === 0) {
        return <p className="text-center text-slate-500 py-8">Aucune donnée à afficher</p>;
    }

    // Auto-detect columns if not provided
    const detectedColumns = columns || Object.keys(data[0]);

    // Create column configs for SmartDataGrid
    const columnConfigs: ColumnConfig[] = detectedColumns.map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        type: typeof data[0][key] === 'number' ? 'number' : 'string',
        sortable: true,
        filterable: true,
        formatter: (value) => formatValue(value, key),
    }));

    return (
        <SmartDataGrid
            data={data}
            columns={columnConfigs}
            enableColumnVisibility={true}
            enableFiltering={true}
            enableSorting={true}
            enableNaturalLanguage={false}
        />
    );
}

// Bar Chart Visualization
function BarChartVisualization({ data }: { data: any[] }) {
    if (!data || data.length === 0) {
        return <p className="text-center text-slate-500 py-8">Aucune donnée à afficher</p>;
    }

    // Detect x and y keys
    const keys = Object.keys(data[0]);
    const xKey = keys[0];
    const yKey = keys[1];

    return (
        <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis
                        dataKey={xKey}
                        stroke="#94a3b8"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickFormatter={(val) => String(val).length > 15 ? String(val).substring(0, 15) + '...' : String(val)}
                    />
                    <YAxis
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickFormatter={(val) => formatValue(val, yKey)}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                        }}
                        formatter={(value: any) => [formatValue(value, yKey), yKey]}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8' }} />
                    <Bar dataKey={yKey} fill="#14b8a6" radius={[8, 8, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// Line Chart Visualization
function LineChartVisualization({ data }: { data: any[] }) {
    if (!data || data.length === 0) {
        return <p className="text-center text-slate-500 py-8">Aucune donnée à afficher</p>;
    }

    const keys = Object.keys(data[0]);
    const xKey = keys[0];
    const yKey = keys[1];

    return (
        <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis dataKey={xKey} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickFormatter={(val) => formatValue(val, yKey)}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                        }}
                        formatter={(value: any) => [formatValue(value, yKey), yKey]}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8' }} />
                    <Line
                        type="monotone"
                        dataKey={yKey}
                        stroke="#14b8a6"
                        strokeWidth={3}
                        dot={{ fill: '#14b8a6', r: 5 }}
                        activeDot={{ r: 7 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// Pie Chart Visualization
function PieChartVisualization({ data }: { data: any[] }) {
    if (!data || data.length === 0) {
        return <p className="text-center text-slate-500 py-8">Aucune donnée à afficher</p>;
    }

    const keys = Object.keys(data[0]);
    const nameKey = keys[0];
    const valueKey = keys[1];

    // Transform data for pie chart
    const pieData = data.map((item) => ({
        name: item[nameKey],
        value: item[valueKey],
    }));

    return (
        <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                        }}
                        formatter={(value: any) => [formatValue(value, valueKey), valueKey]}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8' }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// Metric Visualization (single KPI)
function MetricVisualization({ data }: { data: any }) {
    const value = data.value || data;
    const label = data.label || 'Résultat';

    // Try to format the value if it's a number
    const formattedValue = typeof value === 'number' || !isNaN(Number(value))
        ? formatValue(value, label)
        : value;

    return (
        <div className="text-center py-12">
            <div className="text-slate-500 text-sm uppercase font-bold tracking-wider mb-2">{label}</div>
            <div className="text-6xl text-white font-mono font-bold">{formattedValue}</div>
        </div>
    );
}

// Text Visualization
function TextVisualization({ data }: { data: any }) {
    const text = data.value || JSON.stringify(data);

    return (
        <div className="p-8 text-center">
            <p className="text-white text-lg">{text}</p>
        </div>
    );
}

export default InsightsWidget;
