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
    TrendingUp,
    AlertCircle,
    X,
    ExternalLink,
    Sparkles,
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
import { GlassCard } from '@/components/ui/GlassCard';

// =============================================================================
// Constants
// =============================================================================

const PHASES: SharkPhase[] = ['etude', 'consultation', 'appel_offres', 'travaux', 'termine'];
const SCALES: SharkScale[] = ['Mini', 'Small', 'Medium', 'Large', 'Mega'];
const PRIORITIES: SharkPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const DEFAULT_PAGE_SIZE = 20;

// =============================================================================
// Loading Skeleton
// =============================================================================

function ProjectSkeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-[#0F172A]/40 rounded-xl p-4 animate-pulse">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                            <div className="h-5 bg-slate-700/50 rounded w-3/4" />
                            <div className="h-4 bg-slate-700/30 rounded w-1/2" />
                            <div className="flex gap-2">
                                <div className="h-6 bg-slate-700/40 rounded-lg w-20" />
                                <div className="h-6 bg-slate-700/40 rounded-lg w-16" />
                            </div>
                        </div>
                        <div className="h-12 w-12 bg-slate-700/50 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// =============================================================================
// Sub-components
// =============================================================================

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/20 text-teal-300 text-xs rounded-lg border border-teal-500/30 backdrop-blur-sm">
            {label}
            <button onClick={onRemove} className="hover:text-white transition-colors p-0.5">
                <X size={12} />
            </button>
        </span>
    );
}

function PriorityBadge({ priority }: { priority: SharkPriority }) {
    const glowClass = {
        LOW: '',
        MEDIUM: '',
        HIGH: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]',
        CRITICAL: 'shadow-[0_0_12px_rgba(239,68,68,0.4)]',
    }[priority];

    return (
        <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${PRIORITY_COLORS[priority]} ${glowClass}`}>
            {PRIORITY_LABELS[priority]}
        </span>
    );
}

function PhaseBadge({ phase }: { phase: SharkPhase }) {
    return (
        <span className={`px-2.5 py-1 text-xs font-medium rounded-lg text-white ${PHASE_COLORS[phase]}`}>
            {PHASE_LABELS[phase]}
        </span>
    );
}

function ScoreGauge({ score, priority }: { score: number; priority: SharkPriority }) {
    const colorClass = {
        LOW: 'text-slate-400',
        MEDIUM: 'text-blue-400',
        HIGH: 'text-amber-400',
        CRITICAL: 'text-red-400',
    }[priority];

    const glowClass = {
        LOW: '',
        MEDIUM: '',
        HIGH: 'drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]',
        CRITICAL: 'drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    }[priority];

    return (
        <div className={`flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/80 border border-white/10 ${glowClass}`}>
            <span className={`text-lg font-bold font-mono ${colorClass}`}>{score}</span>
        </div>
    );
}

// =============================================================================
// Project Card (Mobile View)
// =============================================================================

function ProjectCard({ project, orgId }: { project: SharkProjectWithScore; orgId: string }) {
    const router = useRouter();

    return (
        <GlassCard
            hoverEffect
            padding="md"
            className="cursor-pointer"
            onClick={() => router.push(`/org/${orgId}/shark/projects/${project.id}`)}
        >
            <div className="flex items-start gap-4">
                {/* Score Circle */}
                <ScoreGauge score={project.score} priority={project.priority} />

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="font-medium text-white line-clamp-2 leading-tight">
                        {project.title}
                    </h3>

                    <div className="flex flex-wrap gap-2">
                        <PhaseBadge phase={project.phase} />
                        <PriorityBadge priority={project.priority} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-slate-500" />
                            {project.city || project.department || 'Non renseigne'}
                        </span>
                        <span className="flex items-center gap-1">
                            <Building2 size={12} className="text-slate-500" />
                            {project.organization_count} acteur{project.organization_count !== 1 ? 's' : ''}
                        </span>
                        {project.amount_estimate && (
                            <span className="text-teal-400 font-medium">
                                {new Intl.NumberFormat('fr-FR', {
                                    style: 'currency',
                                    currency: 'EUR',
                                    maximumFractionDigits: 0,
                                }).format(project.amount_estimate)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Arrow */}
                <ExternalLink size={16} className="text-slate-500 flex-shrink-0 mt-1" />
            </div>
        </GlassCard>
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
                headers: { 'X-Org-Id': orgId },
            });

            if (!response.ok) {
                throw new Error('Impossible de charger les projets');
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
                headers: { 'X-Org-Id': orgId },
            });
            if (response.ok) {
                const data = await response.json();
                setUnreadAlerts(data.unread_count || 0);
            }
        } catch (err) {
            console.error('Failed to fetch alerts:', err);
        }
    }, [orgId]);

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
            {/* Search & Actions Bar */}
            <div className="flex flex-col gap-4">
                {/* Search Row */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Rechercher un projet, une ville..."
                            className="w-full bg-[#0F172A]/60 backdrop-blur-xl border border-white/10 text-white rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-slate-500"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all min-h-[48px] ${
                                showFilters || hasActiveFilters
                                    ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                                    : 'bg-[#0F172A]/60 backdrop-blur-xl border-white/10 text-slate-300 hover:bg-slate-800/50'
                            }`}
                        >
                            <Filter size={18} />
                            <span className="hidden sm:inline">Filtres</span>
                            {hasActiveFilters && (
                                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                            )}
                        </button>

                        <Link
                            href={`/org/${orgId}/shark/alerts`}
                            className="relative flex items-center gap-2 px-4 py-3 bg-[#0F172A]/60 backdrop-blur-xl hover:bg-slate-800/50 text-slate-300 rounded-xl border border-white/10 transition-all min-h-[48px]"
                        >
                            <Bell size={18} />
                            <span className="hidden sm:inline">Alertes</span>
                            {unreadAlerts > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                                    {unreadAlerts > 9 ? '9+' : unreadAlerts}
                                </span>
                            )}
                        </Link>

                        <button
                            onClick={() => fetchProjects()}
                            disabled={loading}
                            title="Voir si de nouvelles opportunites sont apparues"
                            className="flex items-center justify-center w-12 h-12 bg-[#0F172A]/60 backdrop-blur-xl hover:bg-slate-800/50 text-slate-300 rounded-xl border border-white/10 transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <GlassCard padding="lg">
                    <div className="space-y-6">
                        {/* Phase */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                                Phase du projet
                                <span className="text-xs text-slate-500 font-normal">Plus c&apos;est avance, plus c&apos;est concret</span>
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {PHASES.map((phase) => (
                                    <button
                                        key={phase}
                                        onClick={() => togglePhaseFilter(phase)}
                                        className={`px-4 py-2 text-sm rounded-xl border transition-all min-h-[44px] ${
                                            filters.phases?.includes(phase)
                                                ? `${PHASE_COLORS[phase]} border-transparent text-white shadow-lg`
                                                : 'bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-700/50'
                                        }`}
                                    >
                                        {PHASE_LABELS[phase]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Scale */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-400 mb-3">Envergure du projet</h4>
                            <div className="flex flex-wrap gap-2">
                                {SCALES.map((scale) => (
                                    <button
                                        key={scale}
                                        onClick={() => toggleScaleFilter(scale)}
                                        className={`px-4 py-2 text-sm rounded-xl border transition-all min-h-[44px] ${
                                            filters.scales?.includes(scale)
                                                ? 'bg-teal-500 border-transparent text-white shadow-[0_0_15px_rgba(20,184,166,0.3)]'
                                                : 'bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-700/50'
                                        }`}
                                    >
                                        {scale} <span className="text-xs opacity-70">({SCALE_LABELS[scale]})</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Priority */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-400 mb-3">Niveau d&apos;interet</h4>
                            <div className="flex flex-wrap gap-2">
                                {PRIORITIES.map((priority) => (
                                    <button
                                        key={priority}
                                        onClick={() => togglePriorityFilter(priority)}
                                        className={`px-4 py-2 text-sm rounded-xl border transition-all min-h-[44px] ${
                                            filters.priorities?.includes(priority)
                                                ? `${PRIORITY_COLORS[priority]} border-transparent shadow-lg`
                                                : 'bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-700/50'
                                        }`}
                                    >
                                        {PRIORITY_LABELS[priority]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Clear */}
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
                </GlassCard>
            )}

            {/* Active Filters Display */}
            {hasActiveFilters && !showFilters && (
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm text-slate-500">Filtres:</span>
                    {filters.phases?.map((phase) => (
                        <FilterBadge key={`phase-${phase}`} label={PHASE_LABELS[phase]} onRemove={() => togglePhaseFilter(phase)} />
                    ))}
                    {filters.scales?.map((scale) => (
                        <FilterBadge key={`scale-${scale}`} label={scale} onRemove={() => toggleScaleFilter(scale)} />
                    ))}
                    {filters.priorities?.map((priority) => (
                        <FilterBadge key={`priority-${priority}`} label={PRIORITY_LABELS[priority]} onRemove={() => togglePriorityFilter(priority)} />
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
                    <button onClick={clearAllFilters} className="text-xs text-slate-500 hover:text-slate-300 ml-2">
                        Tout effacer
                    </button>
                </div>
            )}

            {/* Results Stats */}
            <div className="flex items-center justify-between text-sm text-slate-400">
                <span className="flex items-center gap-2">
                    <Sparkles size={14} className="text-teal-500" />
                    {total} opportunite{total !== 1 ? 's' : ''} detectee{total !== 1 ? 's' : ''} par l&apos;IA
                </span>
                {totalPages > 1 && (
                    <span>Page {page} sur {totalPages}</span>
                )}
            </div>

            {/* Error State */}
            {error && (
                <GlassCard className="border-red-500/30 bg-red-500/5">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <AlertCircle size={20} className="text-red-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-red-300 font-medium">Une erreur est survenue</h4>
                            <p className="text-red-300/70 text-sm mt-1">{error}</p>
                        </div>
                        <button
                            onClick={() => fetchProjects()}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
                        >
                            Reessayer
                        </button>
                    </div>
                </GlassCard>
            )}

            {/* Loading State */}
            {loading && <ProjectSkeleton />}

            {/* Projects List - Mobile Cards */}
            {!loading && !error && projects.length > 0 && (
                <>
                    {/* Mobile: Cards */}
                    <div className="lg:hidden space-y-3">
                        {projects.map((project) => (
                            <ProjectCard key={project.id} project={project} orgId={orgId} />
                        ))}
                    </div>

                    {/* Desktop: Table */}
                    <div className="hidden lg:block">
                        <GlassCard padding="none">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Projet</th>
                                            <th className="text-left py-4 px-4 text-sm font-medium text-slate-400 cursor-help" title="Plus la phase est avancee, plus l'opportunite est concrete">
                                                Phase
                                            </th>
                                            <th className="text-left py-4 px-4 text-sm font-medium text-slate-400 cursor-help" title="La taille estimee du projet">
                                                Envergure
                                            </th>
                                            <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">Localisation</th>
                                            <th className="text-left py-4 px-4 text-sm font-medium text-slate-400 cursor-help" title="Analyse IA : synthese du potentiel commercial">
                                                Evaluation
                                            </th>
                                            <th className="text-left py-4 px-4 text-sm font-medium text-slate-400 cursor-help" title="Estimation de l'urgence et de l'interet">
                                                Interet
                                            </th>
                                            <th className="w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {projects.map((project) => (
                                            <tr
                                                key={project.id}
                                                onClick={() => router.push(`/org/${orgId}/shark/projects/${project.id}`)}
                                                className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                                            >
                                                <td className="py-4 px-6">
                                                    <div className="space-y-1">
                                                        <div className="font-medium text-white line-clamp-1 group-hover:text-teal-300 transition-colors">
                                                            {project.title}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <Building2 size={12} />
                                                            {project.organization_count} acteur{project.organization_count !== 1 ? 's' : ''}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <PhaseBadge phase={project.phase} />
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className="text-sm text-slate-300">{project.scale}</span>
                                                    {project.amount_estimate && (
                                                        <div className="text-xs text-teal-400 mt-0.5 font-medium">
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
                                                    <ScoreGauge score={project.score} priority={project.priority} />
                                                </td>
                                                <td className="py-4 px-4">
                                                    <PriorityBadge priority={project.priority} />
                                                </td>
                                                <td className="py-4 px-4">
                                                    <Link
                                                        href={`/org/${orgId}/shark/projects/${project.id}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white inline-block opacity-0 group-hover:opacity-100"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>
                    </div>
                </>
            )}

            {/* Empty State */}
            {!loading && !error && projects.length === 0 && (
                <GlassCard className="py-16">
                    <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center">
                            <Radar size={40} className="text-teal-400" />
                        </div>
                        <h3 className="text-xl font-light text-white mb-3">
                            {hasActiveFilters ? 'Aucun resultat pour ces filtres' : 'Aucune opportunite detectee'}
                        </h3>
                        <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                            {hasActiveFilters
                                ? 'Essayez de modifier ou supprimer vos filtres pour voir plus de resultats.'
                                : 'Notre IA analyse en continu le marche pour vous. Les nouvelles opportunites apparaitront ici automatiquement.'}
                        </p>
                        {hasActiveFilters && (
                            <button
                                onClick={clearAllFilters}
                                className="mt-6 px-6 py-3 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-xl border border-teal-500/30 transition-all"
                            >
                                Effacer les filtres
                            </button>
                        )}
                    </div>
                </GlassCard>
            )}

            {/* Pagination */}
            {totalPages > 1 && !loading && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-3 bg-[#0F172A]/60 hover:bg-slate-800/50 text-slate-300 rounded-xl border border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[48px] min-h-[48px] flex items-center justify-center"
                    >
                        <ChevronLeft size={20} />
                    </button>

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
                                    className={`min-w-[48px] h-12 rounded-xl text-sm font-medium transition-all ${
                                        page === pageNum
                                            ? 'bg-teal-500 text-white shadow-[0_0_20px_rgba(20,184,166,0.3)]'
                                            : 'bg-[#0F172A]/60 text-slate-300 hover:bg-slate-800/50 border border-white/10'
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
                        className="p-3 bg-[#0F172A]/60 hover:bg-slate-800/50 text-slate-300 rounded-xl border border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[48px] min-h-[48px] flex items-center justify-center"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}
