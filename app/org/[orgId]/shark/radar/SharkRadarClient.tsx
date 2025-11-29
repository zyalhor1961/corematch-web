'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Radar,
    Filter,
    Bell,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Search,
    MapPin,
    Building2,
    Calendar,
    TrendingUp,
    AlertCircle,
    X,
    ExternalLink,
} from 'lucide-react';
import {
    SharkProjectWithScore,
    SharkRadarFilters,
    SharkAlert,
    SharkPhase,
    SharkScale,
    SharkPriority,
    PHASE_LABELS,
    PHASE_COLORS,
    SCALE_LABELS,
    PRIORITY_COLORS,
    PRIORITY_LABELS,
} from '@/types/shark';

// =============================================================================
// Constants
// =============================================================================

const PHASES: SharkPhase[] = ['etude', 'consultation', 'appel_offres', 'travaux', 'termine'];
const SCALES: SharkScale[] = ['Mini', 'Small', 'Medium', 'Large', 'Mega'];
const PRIORITIES: SharkPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const DEFAULT_PAGE_SIZE = 20;

// =============================================================================
// Sub-components
// =============================================================================

interface FilterBadgeProps {
    label: string;
    onRemove: () => void;
}

function FilterBadge({ label, onRemove }: FilterBadgeProps) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-500/20 text-teal-300 text-xs rounded-lg border border-teal-500/30">
            {label}
            <button onClick={onRemove} className="hover:text-white transition-colors">
                <X size={12} />
            </button>
        </span>
    );
}

interface PriorityBadgeProps {
    priority: SharkPriority;
}

function PriorityBadge({ priority }: PriorityBadgeProps) {
    return (
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[priority]}`}>
            {PRIORITY_LABELS[priority]}
        </span>
    );
}

interface PhaseBadgeProps {
    phase: SharkPhase;
}

function PhaseBadge({ phase }: PhaseBadgeProps) {
    return (
        <span className={`px-2 py-0.5 text-xs font-medium rounded text-white ${PHASE_COLORS[phase]}`}>
            {PHASE_LABELS[phase]}
        </span>
    );
}

interface ScoreBarProps {
    score: number;
    priority: SharkPriority;
}

function ScoreBar({ score, priority }: ScoreBarProps) {
    const barColor = {
        LOW: 'bg-slate-500',
        MEDIUM: 'bg-blue-500',
        HIGH: 'bg-amber-500',
        CRITICAL: 'bg-red-500',
    }[priority];

    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${barColor} transition-all duration-300`}
                    style={{ width: `${Math.min(score, 100)}%` }}
                />
            </div>
            <span className="text-sm font-medium text-white">{score}</span>
        </div>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export default function SharkRadarClient() {
    const params = useParams();
    const router = useRouter();
    const orgId = params.orgId as string;

    // State
    const [projects, setProjects] = useState<SharkProjectWithScore[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<SharkRadarFilters>({});
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [alerts, setAlerts] = useState<SharkAlert[]>([]);
    const [unreadAlerts, setUnreadAlerts] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Derived state
    const totalPages = useMemo(() => Math.ceil(total / DEFAULT_PAGE_SIZE), [total]);
    const hasActiveFilters = useMemo(() => {
        return (
            (filters.phases?.length ?? 0) > 0 ||
            (filters.scales?.length ?? 0) > 0 ||
            (filters.priorities?.length ?? 0) > 0 ||
            (filters.regions?.length ?? 0) > 0 ||
            (filters.search?.length ?? 0) > 0
        );
    }, [filters]);

    // =============================================================================
    // Data Fetching
    // =============================================================================

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const queryParams = new URLSearchParams();
            queryParams.set('page', String(page));
            queryParams.set('page_size', String(DEFAULT_PAGE_SIZE));

            if (filters.phases?.length) {
                queryParams.set('phases', filters.phases.join(','));
            }
            if (filters.scales?.length) {
                queryParams.set('scales', filters.scales.join(','));
            }
            if (filters.priorities?.length) {
                queryParams.set('priorities', filters.priorities.join(','));
            }
            if (filters.regions?.length) {
                queryParams.set('regions', filters.regions.join(','));
            }
            if (filters.search) {
                queryParams.set('search', filters.search);
            }
            if (filters.lat && filters.lon && filters.radius_km) {
                queryParams.set('lat', String(filters.lat));
                queryParams.set('lon', String(filters.lon));
                queryParams.set('radius_km', String(filters.radius_km));
            }

            const response = await fetch(`/api/shark/projects/top?${queryParams.toString()}`, {
                headers: {
                    'X-Org-Id': orgId,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }

            const data = await response.json();
            setProjects(data.projects || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
            setProjects([]);
        } finally {
            setLoading(false);
        }
    }, [orgId, page, filters]);

    const fetchAlerts = useCallback(async () => {
        try {
            const response = await fetch('/api/shark/alerts?unread_only=true', {
                headers: {
                    'X-Org-Id': orgId,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setAlerts(data.alerts || []);
                setUnreadAlerts(data.unread_count || 0);
            }
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
        }
    }, [orgId]);

    // Initial load
    useEffect(() => {
        if (orgId) {
            fetchProjects();
            fetchAlerts();
        }
    }, [orgId, fetchProjects, fetchAlerts]);

    // =============================================================================
    // Filter Handlers
    // =============================================================================

    const handleSearch = () => {
        setFilters((prev) => ({ ...prev, search: searchQuery || undefined }));
        setPage(1);
    };

    const togglePhaseFilter = (phase: SharkPhase) => {
        setFilters((prev) => {
            const current = prev.phases || [];
            const updated = current.includes(phase)
                ? current.filter((p) => p !== phase)
                : [...current, phase];
            return { ...prev, phases: updated.length ? updated : undefined };
        });
        setPage(1);
    };

    const toggleScaleFilter = (scale: SharkScale) => {
        setFilters((prev) => {
            const current = prev.scales || [];
            const updated = current.includes(scale)
                ? current.filter((s) => s !== scale)
                : [...current, scale];
            return { ...prev, scales: updated.length ? updated : undefined };
        });
        setPage(1);
    };

    const togglePriorityFilter = (priority: SharkPriority) => {
        setFilters((prev) => {
            const current = prev.priorities || [];
            const updated = current.includes(priority)
                ? current.filter((p) => p !== priority)
                : [...current, priority];
            return { ...prev, priorities: updated.length ? updated : undefined };
        });
        setPage(1);
    };

    const clearAllFilters = () => {
        setFilters({});
        setSearchQuery('');
        setPage(1);
    };

    // =============================================================================
    // Render
    // =============================================================================

    return (
        <div className="space-y-6">
            {/* Header Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Rechercher un projet..."
                        className="w-full bg-slate-900/50 border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/30 transition-all placeholder:text-slate-500"
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                    {/* Filter Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                            showFilters || hasActiveFilters
                                ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                                : 'bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-700/50'
                        }`}
                    >
                        <Filter size={18} />
                        Filtres
                        {hasActiveFilters && (
                            <span className="w-2 h-2 rounded-full bg-teal-400" />
                        )}
                    </button>

                    {/* Alerts */}
                    <Link
                        href={`/org/${orgId}/shark/alerts`}
                        className="relative flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl border border-white/10 transition-all"
                    >
                        <Bell size={18} />
                        Alertes
                        {unreadAlerts > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
                                {unreadAlerts > 9 ? '9+' : unreadAlerts}
                            </span>
                        )}
                    </Link>

                    {/* Refresh */}
                    <button
                        onClick={() => fetchProjects()}
                        disabled={loading}
                        title="Voir si de nouvelles opportunites sont apparues"
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl border border-white/10 transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="p-6 bg-slate-900/50 border border-white/10 rounded-xl space-y-6">
                    {/* Phase Filters */}
                    <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-3">Phase</h4>
                        <div className="flex flex-wrap gap-2">
                            {PHASES.map((phase) => (
                                <button
                                    key={phase}
                                    onClick={() => togglePhaseFilter(phase)}
                                    className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                                        filters.phases?.includes(phase)
                                            ? `${PHASE_COLORS[phase]} border-transparent text-white`
                                            : 'bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-700/50'
                                    }`}
                                >
                                    {PHASE_LABELS[phase]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scale Filters */}
                    <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-3">Envergure</h4>
                        <div className="flex flex-wrap gap-2">
                            {SCALES.map((scale) => (
                                <button
                                    key={scale}
                                    onClick={() => toggleScaleFilter(scale)}
                                    className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                                        filters.scales?.includes(scale)
                                            ? 'bg-teal-500 border-transparent text-white'
                                            : 'bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-700/50'
                                    }`}
                                >
                                    {scale} ({SCALE_LABELS[scale]})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Priority Filters */}
                    <div>
                        <h4 className="text-sm font-medium text-slate-400 mb-3">Niveau d&apos;interet</h4>
                        <div className="flex flex-wrap gap-2">
                            {PRIORITIES.map((priority) => (
                                <button
                                    key={priority}
                                    onClick={() => togglePriorityFilter(priority)}
                                    className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                                        filters.priorities?.includes(priority)
                                            ? `${PRIORITY_COLORS[priority]} border-transparent`
                                            : 'bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-700/50'
                                    }`}
                                >
                                    {PRIORITY_LABELS[priority]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <div className="pt-4 border-t border-white/10">
                            <button
                                onClick={clearAllFilters}
                                className="text-sm text-red-400 hover:text-red-300 transition-colors"
                            >
                                Effacer tous les filtres
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Active Filters Display */}
            {hasActiveFilters && !showFilters && (
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm text-slate-400">Filtres actifs:</span>
                    {filters.phases?.map((phase) => (
                        <FilterBadge
                            key={`phase-${phase}`}
                            label={PHASE_LABELS[phase]}
                            onRemove={() => togglePhaseFilter(phase)}
                        />
                    ))}
                    {filters.scales?.map((scale) => (
                        <FilterBadge
                            key={`scale-${scale}`}
                            label={scale}
                            onRemove={() => toggleScaleFilter(scale)}
                        />
                    ))}
                    {filters.priorities?.map((priority) => (
                        <FilterBadge
                            key={`priority-${priority}`}
                            label={PRIORITY_LABELS[priority]}
                            onRemove={() => togglePriorityFilter(priority)}
                        />
                    ))}
                    {filters.search && (
                        <FilterBadge
                            label={`"${filters.search}"`}
                            onRemove={() => {
                                setFilters((prev) => ({ ...prev, search: undefined }));
                                setSearchQuery('');
                            }}
                        />
                    )}
                    <button
                        onClick={clearAllFilters}
                        className="text-xs text-slate-500 hover:text-slate-300 ml-2"
                    >
                        Tout effacer
                    </button>
                </div>
            )}

            {/* Results Stats */}
            <div className="flex items-center justify-between text-sm text-slate-400">
                <span>
                    {total} projet{total !== 1 ? 's' : ''} trouve{total !== 1 ? 's' : ''}
                </span>
                <span>
                    Page {page} sur {totalPages || 1}
                </span>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-300">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw size={32} className="animate-spin text-teal-500" />
                </div>
            )}

            {/* Projects Table */}
            {!loading && !error && projects.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                                    Projet
                                </th>
                                <th
                                    className="text-left py-3 px-4 text-sm font-medium text-slate-400 cursor-help"
                                    title="Plus la phase est avancee, plus l'opportunite est concrete"
                                >
                                    Phase
                                </th>
                                <th
                                    className="text-left py-3 px-4 text-sm font-medium text-slate-400 cursor-help"
                                    title="La taille estimee du projet par notre IA"
                                >
                                    Envergure
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                                    Localisation
                                </th>
                                <th
                                    className="text-left py-3 px-4 text-sm font-medium text-slate-400 cursor-help"
                                    title="Analyse IA : synthese automatique du potentiel commercial"
                                >
                                    Evaluation
                                </th>
                                <th
                                    className="text-left py-3 px-4 text-sm font-medium text-slate-400 cursor-help"
                                    title="Estimation de l'urgence et de l'interet du projet"
                                >
                                    Interet
                                </th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map((project) => (
                                <tr
                                    key={project.id}
                                    onClick={() => router.push(`/org/${orgId}/shark/projects/${project.id}`)}
                                    className="border-b border-white/5 hover:bg-slate-800/30 transition-colors cursor-pointer"
                                >
                                    <td className="py-4 px-4">
                                        <div className="space-y-1">
                                            <div className="font-medium text-white line-clamp-1">
                                                {project.title}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Building2 size={12} />
                                                {project.organization_count} acteur
                                                {project.organization_count !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <PhaseBadge phase={project.phase} />
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="text-sm text-slate-300">
                                            {project.scale}
                                        </span>
                                        {project.amount_estimate && (
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {new Intl.NumberFormat('fr-FR', {
                                                    style: 'currency',
                                                    currency: 'EUR',
                                                    maximumFractionDigits: 0,
                                                }).format(project.amount_estimate)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-2 text-sm text-slate-300">
                                            <MapPin size={14} className="text-slate-500" />
                                            {project.city || project.department || 'Non renseigne'}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <ScoreBar score={project.score} priority={project.priority} />
                                    </td>
                                    <td className="py-4 px-4">
                                        <PriorityBadge priority={project.priority} />
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <Link
                                            href={`/org/${orgId}/shark/projects/${project.id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white inline-block"
                                        >
                                            <ExternalLink size={16} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && projects.length === 0 && (
                <div className="text-center py-12">
                    <Radar size={48} className="mx-auto text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                        Aucune opportunite detectee
                    </h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                        {hasActiveFilters
                            ? 'Essayez de modifier vos filtres pour voir plus de resultats'
                            : 'Notre IA travaille en continu pour detecter de nouvelles opportunites. Revenez bientot !'}
                    </p>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg border border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (page <= 3) {
                                pageNum = i + 1;
                            } else if (page >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = page - 2 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                                        page === pageNum
                                            ? 'bg-teal-500 text-white'
                                            : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg border border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}
        </div>
    );
}
