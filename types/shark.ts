/**
 * Shark Hunter Type Definitions
 * Types for the Shark Radar B2B CRM module
 */

// =============================================================================
// Enums
// =============================================================================

export type SharkPhase =
    | 'etude'
    | 'consultation'
    | 'appel_offres'
    | 'travaux'
    | 'termine';

export type SharkScale =
    | 'Mini'
    | 'Small'
    | 'Medium'
    | 'Large'
    | 'Mega';

export type SharkPriority =
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';

export type SharkActionType =
    | 'call'
    | 'email'
    | 'rdv'
    | 'note'
    | 'status_change';

export type SherlockRole =
    | 'dg'
    | 'dga'
    | 'directeur_travaux'
    | 'conducteur_travaux'
    | 'responsable_achats'
    | 'chef_chantier'
    | 'commercial'
    | 'assistant'
    | 'autre';

// =============================================================================
// Core Entities
// =============================================================================

export interface SharkProject {
    id: string;
    bpce_id: string;
    title: string;
    description: string | null;
    phase: SharkPhase;
    scale: SharkScale;
    amount_estimate: number | null;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    department: string | null;
    region: string | null;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface SharkOrganization {
    id: string;
    bpce_id: string;
    name: string;
    siren: string | null;
    siret: string | null;
    role: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    created_at: string;
    updated_at: string;
}

export interface SharkPerson {
    id: string;
    organization_id: string;
    full_name: string;
    role: SherlockRole;
    job_title: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    confidence_score: number;
    is_current: boolean;
    source: string;
    created_at: string;
    updated_at: string;
}

export interface SharkNews {
    id: string;
    project_id: string;
    title: string;
    summary: string | null;
    source_url: string | null;
    published_at: string | null;
    created_at: string;
}

export interface SharkAction {
    id: string;
    project_id: string;
    organization_id: string | null;
    person_id: string | null;
    type: SharkActionType;
    title: string;
    notes: string | null;
    due_date: string | null;
    completed_at: string | null;
    created_by: string;
    created_at: string;
}

export interface SharkAlert {
    id: string;
    project_id: string;
    type: 'phase_change' | 'deadline_approaching' | 'new_actor' | 'score_spike';
    message: string;
    priority: SharkPriority;
    read: boolean;
    created_at: string;
}

// =============================================================================
// Composite / View Types
// =============================================================================

export interface SharkScoreBreakdown {
    phase_points: number;
    scale_points: number;
    date_points: number;
    news_points: number;
    org_points: number;
    people_points: number;
    time_decay: number;
}

export interface SharkProjectWithScore extends SharkProject {
    score: number;
    priority: SharkPriority;
    score_breakdown: SharkScoreBreakdown;
    organization_count: number;
    news_count: number;
    last_action_at: string | null;
}

export interface SharkProjectDetail extends SharkProjectWithScore {
    organizations: SharkOrganization[];
    people: SharkPerson[];
    news: SharkNews[];
    actions: SharkAction[];
}

export interface SharkActivityItem {
    id: string;
    project_id: string | null;
    type: 'news' | 'score_update' | 'osint_enrichment' | 'ingestion';
    timestamp: string;
    summary: string;
    details?: Record<string, unknown>;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface SharkRadarFilters {
    phases?: SharkPhase[];
    scales?: SharkScale[];
    priorities?: SharkPriority[];
    regions?: string[];
    departments?: string[];
    search?: string;
    // Geo filter
    lat?: number;
    lon?: number;
    radius_km?: number;
}

export interface SharkRadarResponse {
    projects: SharkProjectWithScore[];
    total: number;
    page: number;
    page_size: number;
    filters_applied: SharkRadarFilters;
}

export interface SharkProjectResponse {
    project: SharkProjectDetail;
}

export interface SharkScoreChange {
    project_id: string;
    name: string;
    old_score: number;
    new_score: number;
    change: number;
}

export interface SharkRecentProject {
    project_id: string;
    name: string;
    score: number;
    priority: SharkPriority;
}

export interface SharkAlertsResponse {
    new_critical_projects_count: number;
    score_changes: SharkScoreChange[];
    recent_projects: SharkRecentProject[];
}

export interface SharkActivityFeedResponse {
    items: SharkActivityItem[];
}

// =============================================================================
// UI State Types
// =============================================================================

export interface SharkRadarState {
    projects: SharkProjectWithScore[];
    loading: boolean;
    error: string | null;
    filters: SharkRadarFilters;
    pagination: {
        page: number;
        pageSize: number;
        total: number;
    };
    alerts: {
        items: SharkAlert[];
        unreadCount: number;
    };
}

export interface SharkProjectDrawerState {
    isOpen: boolean;
    projectId: string | null;
    project: SharkProjectDetail | null;
    loading: boolean;
    activeTab: 'overview' | 'organizations' | 'people' | 'news' | 'actions';
}

// =============================================================================
// Helper Types
// =============================================================================

export const PHASE_LABELS: Record<SharkPhase, string> = {
    etude: 'Etude',
    consultation: 'Consultation',
    appel_offres: 'Appel d\'offres',
    travaux: 'Travaux',
    termine: 'Termine',
};

export const PHASE_COLORS: Record<SharkPhase, string> = {
    etude: 'bg-slate-500',
    consultation: 'bg-blue-500',
    appel_offres: 'bg-amber-500',
    travaux: 'bg-green-500',
    termine: 'bg-gray-400',
};

export const SCALE_LABELS: Record<SharkScale, string> = {
    Mini: '< 100K',
    Small: '100K - 500K',
    Medium: '500K - 2M',
    Large: '2M - 10M',
    Mega: '> 10M',
};

export const PRIORITY_COLORS: Record<SharkPriority, string> = {
    LOW: 'text-slate-400 bg-slate-500/20',
    MEDIUM: 'text-blue-400 bg-blue-500/20',
    HIGH: 'text-amber-400 bg-amber-500/20',
    CRITICAL: 'text-red-400 bg-red-500/20',
};

export const PRIORITY_LABELS: Record<SharkPriority, string> = {
    LOW: 'Faible',
    MEDIUM: 'Moyen',
    HIGH: 'Eleve',
    CRITICAL: 'Critique',
};

export type SharkActivityType = 'news' | 'score_update' | 'osint_enrichment' | 'ingestion';

export const ACTIVITY_TYPE_COLORS: Record<SharkActivityType, string> = {
    news: 'bg-blue-500',
    score_update: 'bg-teal-500',
    osint_enrichment: 'bg-purple-500',
    ingestion: 'bg-slate-500',
};

export const ACTIVITY_TYPE_LABELS: Record<SharkActivityType, string> = {
    news: 'Actualite',
    score_update: 'Activite projet',
    osint_enrichment: 'Recherche Web',
    ingestion: 'Analyse IA',
};
