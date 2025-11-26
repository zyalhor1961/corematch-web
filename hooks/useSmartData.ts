'use client';

import { useState, useMemo, useCallback } from 'react';
import type {
    UseSmartDataOptions,
    UseSmartDataReturn,
    FilterCondition,
    SortConfig,
    ColumnConfig,
    FilterOperator,
} from '@/types/data-grid';

/**
 * useSmartData Hook
 * 
 * Manages client-side data processing for SmartDataGrid:
 * - Column visibility toggling
 * - Multi-condition filtering with AND logic
 * - Sorting (ASC/DESC)
 * - Natural language query parsing
 * 
 * Optimized for datasets < 1000 rows
 */
export function useSmartData<T extends Record<string, any>>({
    data,
    columns,
    initialSort = null,
    initialFilters = [],
    initialHiddenColumns = [],
}: UseSmartDataOptions<T>): UseSmartDataReturn<T> {
    // State management
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(initialSort);
    const [filterConditions, setFilterConditions] = useState<FilterCondition[]>(initialFilters);
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
        new Set(initialHiddenColumns)
    );

    // Generate column configs if not provided
    const columnConfigs = useMemo<ColumnConfig[]>(() => {
        if (columns && columns.length > 0) return columns;
        if (data && data.length > 0) {
            return Object.keys(data[0]).map((key) => ({
                key,
                label: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
                type: inferColumnType(data[0][key]),
                sortable: true,
                filterable: true,
                hidden: false,
            }));
        }
        return [];
    }, [data, columns]);

    // Get visible columns
    const visibleColumns = useMemo(() => {
        return columnConfigs.filter((col) => !hiddenColumns.has(col.key));
    }, [columnConfigs, hiddenColumns]);

    // Apply filters
    const filteredData = useMemo(() => {
        if (filterConditions.length === 0) return data;

        return data.filter((row) => {
            // AND logic: all conditions must pass
            return filterConditions.every((condition) => {
                const value = row[condition.column];
                return evaluateFilter(value, condition.operator, condition.value);
            });
        });
    }, [data, filterConditions]);

    // Apply sorting
    const processedData = useMemo(() => {
        if (!sortConfig) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.column];
            const bVal = b[sortConfig.column];

            // Handle null/undefined
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            // Type-aware comparison
            let comparison = 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            } else if (aVal instanceof Date && bVal instanceof Date) {
                comparison = aVal.getTime() - bVal.getTime();
            } else {
                comparison = String(aVal).localeCompare(String(bVal));
            }

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [filteredData, sortConfig]);

    // Filter management
    const addFilter = useCallback((filter: FilterCondition) => {
        setFilterConditions((prev) => [...prev, filter]);
    }, []);

    const removeFilter = useCallback((filterId: string) => {
        setFilterConditions((prev) => prev.filter((f) => f.id !== filterId));
    }, []);

    const updateFilter = useCallback(
        (filterId: string, updates: Partial<FilterCondition>) => {
            setFilterConditions((prev) =>
                prev.map((f) => (f.id === filterId ? { ...f, ...updates } : f))
            );
        },
        []
    );

    const clearFilters = useCallback(() => {
        setFilterConditions([]);
    }, []);

    // Column visibility management
    const toggleColumn = useCallback((columnKey: string) => {
        setHiddenColumns((prev) => {
            const next = new Set(prev);
            if (next.has(columnKey)) {
                next.delete(columnKey);
            } else {
                next.add(columnKey);
            }
            return next;
        });
    }, []);

    const showColumn = useCallback((columnKey: string) => {
        setHiddenColumns((prev) => {
            const next = new Set(prev);
            next.delete(columnKey);
            return next;
        });
    }, []);

    const hideColumn = useCallback((columnKey: string) => {
        setHiddenColumns((prev) => new Set(prev).add(columnKey));
    }, []);

    // Natural language query parser
    const applyNaturalQuery = useCallback(
        (query: string) => {
            const lowerQuery = query.toLowerCase().trim();
            if (!lowerQuery) {
                clearFilters();
                return;
            }

            // Simple pattern matching for common queries
            const newFilters: FilterCondition[] = [];

            // "big expenses" or "large amounts"
            if (lowerQuery.includes('big') || lowerQuery.includes('large')) {
                const amountColumn = columnConfigs.find(
                    (col) => col.key.toLowerCase().includes('amount') || col.key.toLowerCase().includes('total')
                );
                if (amountColumn) {
                    newFilters.push({
                        id: `nl-${Date.now()}-1`,
                        column: amountColumn.key,
                        operator: 'greaterThan',
                        value: 1000,
                    });
                }
            }

            // "recent" - last 30 days
            if (lowerQuery.includes('recent')) {
                const dateColumn = columnConfigs.find(
                    (col) => col.type === 'date' || col.key.toLowerCase().includes('date')
                );
                if (dateColumn) {
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    newFilters.push({
                        id: `nl-${Date.now()}-2`,
                        column: dateColumn.key,
                        operator: 'greaterThanOrEqual',
                        value: thirtyDaysAgo.toISOString().split('T')[0],
                    });
                }
            }

            // "pending" or "approved" status
            const statusMatch = lowerQuery.match(/\b(pending|approved|paid|overdue)\b/i);
            if (statusMatch) {
                const statusColumn = columnConfigs.find(
                    (col) => col.key.toLowerCase().includes('status')
                );
                if (statusColumn) {
                    newFilters.push({
                        id: `nl-${Date.now()}-3`,
                        column: statusColumn.key,
                        operator: 'contains',
                        value: statusMatch[1],
                    });
                }
            }

            // Extract "contains" patterns: "vendor amazon" or "client acme"
            const containsMatch = lowerQuery.match(/(\w+)\s+contains?\s+(\w+)/i);
            if (containsMatch) {
                const [, columnName, searchValue] = containsMatch;
                const column = columnConfigs.find((col) =>
                    col.key.toLowerCase().includes(columnName.toLowerCase())
                );
                if (column) {
                    newFilters.push({
                        id: `nl-${Date.now()}-4`,
                        column: column.key,
                        operator: 'contains',
                        value: searchValue,
                    });
                }
            }

            // Apply the parsed filters
            if (newFilters.length > 0) {
                setFilterConditions(newFilters);
            }
        },
        [columnConfigs, clearFilters]
    );

    return {
        processedData,
        sortConfig,
        setSortConfig,
        filterConditions,
        addFilter,
        removeFilter,
        updateFilter,
        clearFilters,
        hiddenColumns,
        toggleColumn,
        showColumn,
        hideColumn,
        visibleColumns,
        columnConfigs,
        applyNaturalQuery,
    };
}

// Helper: Infer column type from value
function inferColumnType(value: any): 'string' | 'number' | 'date' | 'boolean' {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && !isNaN(Date.parse(value))) return 'date';
    return 'string';
}

// Helper: Evaluate a single filter condition
function evaluateFilter(
    value: any,
    operator: FilterOperator,
    filterValue: string | number
): boolean {
    // Handle null/undefined
    if (value == null) return false;

    const strValue = String(value).toLowerCase();
    const strFilterValue = String(filterValue).toLowerCase();

    switch (operator) {
        case 'equals':
            return strValue === strFilterValue;
        case 'notEquals':
            return strValue !== strFilterValue;
        case 'contains':
            return strValue.includes(strFilterValue);
        case 'notContains':
            return !strValue.includes(strFilterValue);
        case 'startsWith':
            return strValue.startsWith(strFilterValue);
        case 'endsWith':
            return strValue.endsWith(strFilterValue);
        case 'greaterThan':
            return Number(value) > Number(filterValue);
        case 'lessThan':
            return Number(value) < Number(filterValue);
        case 'greaterThanOrEqual':
            return Number(value) >= Number(filterValue);
        case 'lessThanOrEqual':
            return Number(value) <= Number(filterValue);
        default:
            return false;
    }
}
