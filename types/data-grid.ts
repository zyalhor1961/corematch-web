/**
 * SmartDataGrid Type Definitions
 * Type-safe interfaces for the interactive data grid component
 */

export type FilterOperator =
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'greaterThan'
    | 'lessThan'
    | 'greaterThanOrEqual'
    | 'lessThanOrEqual'
    | 'startsWith'
    | 'endsWith';

export type ColumnType = 'string' | 'number' | 'date' | 'boolean';

export interface ColumnConfig {
    key: string;
    label: string;
    type?: ColumnType;
    formatter?: (value: any) => string;
    sortable?: boolean;
    filterable?: boolean;
    hidden?: boolean;
}

export interface FilterCondition {
    id: string;
    column: string;
    operator: FilterOperator;
    value: string | number;
}

export interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

export interface SmartDataGridProps<T = any> {
    data: T[];
    columns?: ColumnConfig[];
    title?: string;
    onNaturalQuery?: (query: string) => void;
    className?: string;
    enableColumnVisibility?: boolean;
    enableFiltering?: boolean;
    enableSorting?: boolean;
    enableNaturalLanguage?: boolean;
}

export interface UseSmartDataOptions<T = any> {
    data: T[];
    columns?: ColumnConfig[];
    initialSort?: SortConfig | null;
    initialFilters?: FilterCondition[];
    initialHiddenColumns?: string[];
}

export interface UseSmartDataReturn<T = any> {
    processedData: T[];
    sortConfig: SortConfig | null;
    setSortConfig: (config: SortConfig | null) => void;
    filterConditions: FilterCondition[];
    addFilter: (filter: FilterCondition) => void;
    removeFilter: (filterId: string) => void;
    updateFilter: (filterId: string, updates: Partial<FilterCondition>) => void;
    clearFilters: () => void;
    hiddenColumns: Set<string>;
    toggleColumn: (columnKey: string) => void;
    showColumn: (columnKey: string) => void;
    hideColumn: (columnKey: string) => void;
    visibleColumns: ColumnConfig[];
    columnConfigs: ColumnConfig[];
    applyNaturalQuery: (query: string) => void;
}
