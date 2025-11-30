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
    tenders?: SharkTender[];
    permits?: SharkPermit[];
}

export interface SharkActivityItem {
    id: string;
    project_id: string | null;
    type: SharkActivityType;
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

export type SharkActivityType = 'news' | 'score_update' | 'osint_enrichment' | 'ingestion' | 'permit_detected' | 'tender_detected';

export const ACTIVITY_TYPE_COLORS: Record<SharkActivityType, string> = {
    news: 'bg-blue-500',
    score_update: 'bg-teal-500',
    osint_enrichment: 'bg-purple-500',
    ingestion: 'bg-slate-500',
    permit_detected: 'bg-amber-500',
    tender_detected: 'bg-purple-500',
};

export const ACTIVITY_TYPE_LABELS: Record<SharkActivityType, string> = {
    news: 'Actualite',
    score_update: 'Activite projet',
    osint_enrichment: 'Recherche Web',
    ingestion: 'Analyse IA',
    permit_detected: 'Permis detecte',
    tender_detected: 'Marche public',
};

// =============================================================================
// Sourcing → Shark Ingestion Types
// =============================================================================

/**
 * Request body for /api/shark/from-sourcing
 * Sent from the Sourcing page when user clicks "Ajouter au radar"
 */
export interface SharkFromSourcingRequest {
    sourceUrl: string;
    sourceName?: string;
    title?: string;
    snippet?: string;
}

/**
 * Response from /api/shark/from-sourcing
 */
export interface SharkFromSourcingResponse {
    status: 'ok' | 'error';
    project_id: string | null;
    news_id: string | null;
    created_project: boolean;
    reused_existing_project: boolean;
    message: string;
}

// =============================================================================
// Public Tenders (Marches Publics / BOAMP)
// =============================================================================

export type TenderStatus =
    | 'published'
    | 'awarded'
    | 'closed'
    | 'cancelled';

export interface SharkTender {
    tender_id: string;
    external_id: string;
    reference?: string;
    title?: string;
    description?: string;
    procedure_type?: string;
    published_at?: string;
    deadline_at?: string;
    status: TenderStatus;
    location_city?: string;
    location_region?: string;
    location_department?: string;
    buyer_name?: string;
    buyer_siret?: string;
    cpv_codes: string[];
    awarded_at?: string;
    awarded_amount?: number;
    days_until_deadline?: number;
    project_id?: string;
    project_name?: string;
}

export const TENDER_STATUS_LABELS: Record<TenderStatus, string> = {
    published: 'Publie',
    awarded: 'Attribue',
    closed: 'Clos',
    cancelled: 'Annule',
};

export const TENDER_STATUS_COLORS: Record<TenderStatus, string> = {
    published: 'text-green-400 bg-green-500/20',
    awarded: 'text-blue-400 bg-blue-500/20',
    closed: 'text-slate-400 bg-slate-500/20',
    cancelled: 'text-red-400 bg-red-500/20',
};

/**
 * Get urgency color based on days until deadline
 */
export function getTenderUrgencyColor(daysUntilDeadline?: number): string {
    if (daysUntilDeadline === undefined || daysUntilDeadline === null) {
        return 'text-slate-400';
    }
    if (daysUntilDeadline <= 0) {
        return 'text-red-500'; // Expired
    }
    if (daysUntilDeadline <= 7) {
        return 'text-red-400'; // Very urgent
    }
    if (daysUntilDeadline <= 14) {
        return 'text-amber-400'; // Urgent
    }
    if (daysUntilDeadline <= 30) {
        return 'text-yellow-400'; // Coming soon
    }
    return 'text-green-400'; // Plenty of time
}

/**
 * Format deadline countdown for display
 */
export function formatDeadlineCountdown(daysUntilDeadline?: number): string {
    if (daysUntilDeadline === undefined || daysUntilDeadline === null) {
        return '-';
    }
    if (daysUntilDeadline <= 0) {
        return 'Expire';
    }
    if (daysUntilDeadline === 1) {
        return '1 jour';
    }
    return `${daysUntilDeadline} jours`;
}

// =============================================================================
// Building Permits (Permis de Construire)
// =============================================================================

export type PermitStatus =
    | 'filed'
    | 'accepted'
    | 'refused'
    | 'cancelled'
    | 'unknown';

export interface SharkPermit {
    permit_id: string;
    external_id: string;
    reference?: string;
    permit_type?: string;
    status: PermitStatus;
    applicant_name?: string;
    project_address?: string;
    city?: string;
    postcode?: string;
    region?: string;
    country: string;
    description?: string;
    estimated_surface?: number;
    estimated_units?: number;
    submission_date?: string;
    decision_date?: string;
    project_id?: string;
    project_name?: string;
}

export const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
    filed: 'Depose',
    accepted: 'Accorde',
    refused: 'Refuse',
    cancelled: 'Annule',
    unknown: 'Inconnu',
};

export const PERMIT_STATUS_COLORS: Record<PermitStatus, string> = {
    filed: 'text-blue-400 bg-blue-500/20',
    accepted: 'text-green-400 bg-green-500/20',
    refused: 'text-red-400 bg-red-500/20',
    cancelled: 'text-slate-400 bg-slate-500/20',
    unknown: 'text-slate-400 bg-slate-500/20',
};

export const PERMIT_TYPE_LABELS: Record<string, string> = {
    PC: 'Permis de Construire',
    PCMI: 'Permis Maison Individuelle',
    DP: 'Declaration Prealable',
    PA: 'Permis d\'Amenager',
    PD: 'Permis de Demolir',
};

// =============================================================================
// Extended Project with Tenders/Permits
// =============================================================================

export interface SharkProjectWithTenders extends SharkProjectWithScore {
    is_public_tender?: boolean;
    tender_deadline?: string;
    tender_count?: number;
    permit_count?: number;
    tenders?: SharkTender[];
    permits?: SharkPermit[];
}
