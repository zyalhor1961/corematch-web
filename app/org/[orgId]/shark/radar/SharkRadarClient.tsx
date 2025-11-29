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
    AlertCircle,
    X,
    ExternalLink,
    Sparkles,
    Clock,
    Target,
    Star,
    TrendingUp,
    Zap,
    ArrowRight,
    Rocket,
} from 'lucide-react';
import {
    SharkProjectWithScore,
    SharkRadarFilters,
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

// Score interpretation messages
const SCORE_INTERPRETATIONS: Record<SharkPriority, string> = {
    CRITICAL: 'Opportunite a tres fort potentiel. A traiter en priorite.',
    HIGH: 'Projet interessant, avec plusieurs signaux positifs.',
    MEDIUM: 'Projet a surveiller, peut devenir interessant.',
    LOW: 'Projet identifie, mais priorite moindre pour l\'instant.',
};

// =============================================================================
// Utility Functions
// =============================================================================

function formatTimeAgo(date: Date | string | null | undefined): string {
    if (!date) return 'Analyse en cours...';

    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'A l\'instant';
    if (diffMins < 60) return `il y a ${diffMins} min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    return then.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

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

function TopOpportunitiesSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[#0F172A]/40 rounded-xl p-5 animate-pulse">
                    <div className="space-y-3">
                        <div className="flex justify-between items-start">
                            <div className="h-5 bg-slate-700/50 rounded w-2/3" />
                            <div className="h-10 w-10 bg-slate-700/50 rounded-full" />
                        </div>
                        <div className="h-4 bg-slate-700/30 rounded w-1/2" />
                        <div className="flex gap-2">
                            <div className="h-6 bg-slate-700/40 rounded-lg w-16" />
                            <div className="h-6 bg-slate-700/40 rounded-lg w-20" />
                        </div>
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

// Animated Score Gauge with interpretation
function ScoreGauge({
    score,
    priority,
    showInterpretation = false,
    animate = true,
}: {
    score: number;
    priority: SharkPriority;
    showInterpretation?: boolean;
    animate?: boolean;
}) {
    const [displayScore, setDisplayScore] = useState(animate ? 0 : score);

    useEffect(() => {
        if (!animate) {
            setDisplayScore(score);
            return;
        }

        // Animate score from 0 to actual value
        const duration = 600;
        const startTime = Date.now();
        const startValue = 0;

        const animateScore = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for smooth animation
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentScore = Math.round(startValue + (score - startValue) * easeOut);

            setDisplayScore(currentScore);

            if (progress < 1) {
                requestAnimationFrame(animateScore);
            }
        };

        requestAnimationFrame(animateScore);
    }, [score, animate]);

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

    const ringColor = {
        LOW: 'border-slate-600',
        MEDIUM: 'border-blue-500/50',
        HIGH: 'border-amber-500/50',
        CRITICAL: 'border-red-500/50',
    }[priority];

    return (
        <div className="flex flex-col items-center gap-1">
            <div
                className={`relative flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/80 border-2 ${ringColor} ${glowClass} transition-all duration-300`}
                title={SCORE_INTERPRETATIONS[priority]}
            >
                <span className={`text-lg font-bold font-mono ${colorClass} transition-all duration-300`}>
                    {displayScore}
                </span>
            </div>
            {showInterpretation && (
                <p className="text-[10px] text-slate-500 text-center max-w-[100px] leading-tight mt-1">
                    {SCORE_INTERPRETATIONS[priority].split('.')[0]}
                </p>
            )}
        </div>
    );
}

// Pulsing Dot (for "in progress" states)
function PulsingDot({ color = 'teal' }: { color?: 'teal' | 'amber' | 'blue' }) {
    const colorClass = {
        teal: 'bg-teal-400',
        amber: 'bg-amber-400',
        blue: 'bg-blue-400',
    }[color];

    return (
        <span className={`inline-block w-2 h-2 rounded-full ${colorClass} animate-pulse`} />
    );
}

// Last Updated Badge (with pulsing indicator when analyzing)
function LastUpdatedBadge({
    date,
    isAnalyzing = false
}: {
    date: Date | string | null | undefined;
    isAnalyzing?: boolean;
}) {
    const isLoading = !date || isAnalyzing;

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            isLoading
                ? 'bg-teal-500/10 border-teal-500/30'
                : 'bg-white/5 border-white/10'
        }`}>
            {isLoading ? (
                <>
                    <PulsingDot color="teal" />
                    <span className="text-xs text-teal-300">
                        Analyse en cours...
                    </span>
                </>
            ) : (
                <>
                    <Clock size={12} className="text-slate-400" />
                    <span className="text-xs text-slate-300">
                        Mise a jour : {formatTimeAgo(date)}
                    </span>
                </>
            )}
        </div>
    );
}

// Introduction Banner (with social proof)
function IntroBanner() {
    return (
        <GlassCard padding="lg" className="relative overflow-hidden">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-transparent to-cyan-500/5 pointer-events-none" />

            <div className="relative flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl border border-teal-500/20">
                    <Target size={24} className="text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-medium text-white mb-1">
                        Radar d&apos;opportunites
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        CoreMatch analyse en continu les opportunites autour de vous.
                        <br className="hidden sm:block" />
                        <span className="text-slate-500">
                            Chaque nuit, notre IA detecte les projets qui bougent dans votre region.
                        </span>
                    </p>
                    {/* Social proof */}
                    <p className="text-xs text-teal-500/80 mt-2 flex items-center gap-1.5">
                        <Sparkles size={12} />
                        <span>Utilise chaque jour par des professionnels pour reperer des chantiers avant leurs concurrents.</span>
                    </p>
                </div>
            </div>
        </GlassCard>
    );
}

// Top Opportunity Card (for the "Top opportunites du moment" section)
function TopOpportunityCard({
    project,
    orgId,
    rank,
}: {
    project: SharkProjectWithScore;
    orgId: string;
    rank: number;
}) {
    const router = useRouter();

    const rankColors = {
        1: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30',
        2: 'from-slate-400/20 to-slate-300/20 border-slate-400/30',
        3: 'from-orange-600/20 to-orange-500/20 border-orange-600/30',
    };

    const rankIcons = {
        1: <Star size={14} className="text-amber-400 fill-amber-400" />,
        2: <Star size={14} className="text-slate-400" />,
        3: <Star size={14} className="text-orange-500" />,
    };

    return (
        <GlassCard
            hoverEffect
            padding="md"
            className="cursor-pointer group relative overflow-hidden"
            onClick={() => router.push(`/org/${orgId}/shark/projects/${project.id}`)}
        >
            {/* Rank indicator */}
            <div className={`absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-gradient-to-br ${rankColors[rank as 1|2|3] || rankColors[3]} rounded-bl-xl`}>
                {rankIcons[rank as 1|2|3] || rankIcons[3]}
            </div>

            <div className="space-y-3">
                <div className="flex items-start gap-3 pr-8">
                    <ScoreGauge score={project.score} priority={project.priority} animate />
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white line-clamp-2 group-hover:text-teal-300 transition-colors leading-tight">
                            {project.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <MapPin size={10} />
                            {project.city || project.department || 'France'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <PhaseBadge phase={project.phase} />
                    <PriorityBadge priority={project.priority} />
                </div>

                {/* Micro-interpretation */}
                <p className="text-xs text-slate-500 italic border-t border-white/5 pt-2">
                    {project.priority === 'CRITICAL' && 'Signaux forts detectes'}
                    {project.priority === 'HIGH' && 'Plusieurs indicateurs positifs'}
                    {project.priority === 'MEDIUM' && 'A suivre de pres'}
                    {project.priority === 'LOW' && 'En phase d\'observation'}
                </p>
            </div>
        </GlassCard>
    );
}

// =============================================================================
// Project Card (Mobile View) - Enhanced
// =============================================================================

function ProjectCard({ project, orgId }: { project: SharkProjectWithScore; orgId: string }) {
    const router = useRouter();

    return (
        <GlassCard
            hoverEffect
            padding="md"
            className="cursor-pointer group"
            onClick={() => router.push(`/org/${orgId}/shark/projects/${project.id}`)}
        >
            <div className="space-y-3">
                {/* Header with Score */}
                <div className="flex items-start gap-4">
                    <ScoreGauge score={project.score} priority={project.priority} animate />

                    <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-medium text-white line-clamp-2 leading-tight group-hover:text-teal-300 transition-colors">
                            {project.title}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {SCORE_INTERPRETATIONS[project.priority].split('.')[0]}
                        </p>
                    </div>

                    <ExternalLink size={16} className="text-slate-500 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                    <PhaseBadge phase={project.phase} />
                    <PriorityBadge priority={project.priority} />
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-2 border-t border-white/5">
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

                {/* Mobile Actions */}
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/org/${orgId}/shark/projects/${project.id}`);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg text-sm font-medium transition-colors min-h-[44px]"
                    >
                        <ExternalLink size={14} />
                        Voir le detail
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implement bookmark/follow functionality
                        }}
                        className="flex items-center justify-center px-3 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-400 rounded-lg transition-colors min-h-[44px]"
                        title="Suivre ce projet"
                    >
                        <Star size={16} />
                    </button>
                </div>
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

    // Last updated: find the most recent project update
    const lastUpdated = useMemo(() => {
        if (projects.length === 0) return null;
        const dates = projects
            .map(p => p.updated_at || p.created_at)
            .filter(Boolean)
            .map(d => new Date(d as string).getTime());
        if (dates.length === 0) return null;
        return new Date(Math.max(...dates));
    }, [projects]);

    // Top opportunities: top 3 projects by priority then score
    const topOpportunities = useMemo(() => {
        if (projects.length <= 3) return [];

        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

        return [...projects]
            .sort((a, b) => {
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return b.score - a.score;
            })
            .slice(0, 3);
    }, [projects]);

    // Remaining projects (excluding top opportunities if shown)
    const remainingProjects = useMemo(() => {
        if (topOpportunities.length === 0) return projects;
        const topIds = new Set(topOpportunities.map(p => p.id));
        return projects.filter(p => !topIds.has(p.id));
    }, [projects, topOpportunities]);

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
            {/* Introduction Banner */}
            <IntroBanner />

            {/* Header: Last Updated + Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <LastUpdatedBadge date={lastUpdated} isAnalyzing={loading || total === 0} />
                <div className="flex items-center gap-2 text-sm">
                    {total === 0 ? (
                        <>
                            <PulsingDot color="teal" />
                            <span className="text-teal-400">
                                Detection en cours...
                            </span>
                        </>
                    ) : (
                        <>
                            <Sparkles size={14} className="text-teal-500" />
                            <span className="text-slate-400">
                                {total} opportunite{total !== 1 ? 's' : ''} detectee{total !== 1 ? 's' : ''}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Search & Actions Bar */}
            <div className="flex flex-col gap-4">
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
                            title="Actualiser les opportunites"
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

            {/* Error State */}
            {error && (
                <GlassCard className="border-red-500/30 bg-red-500/5">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <AlertCircle size={20} className="text-red-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-red-300 font-medium">Une erreur est survenue</h4>
                            <p className="text-red-300/70 text-sm mt-1">
                                Nous n&apos;avons pas pu charger les opportunites pour le moment.
                                Vous pouvez reessayer dans un instant.
                            </p>
                        </div>
                        <button
                            onClick={() => fetchProjects()}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors min-h-[44px]"
                        >
                            Reessayer
                        </button>
                    </div>
                </GlassCard>
            )}

            {/* Loading State */}
            {loading && (
                <div className="space-y-6">
                    <TopOpportunitiesSkeleton />
                    <ProjectSkeleton />
                </div>
            )}

            {/* Top Opportunities Section */}
            {!loading && !error && topOpportunities.length > 0 && !hasActiveFilters && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-lg">
                            <Zap size={16} className="text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-medium">Top opportunites du moment</h3>
                            <p className="text-xs text-slate-500">Les projets les plus prometteurs detectes recemment</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {topOpportunities.map((project, index) => (
                            <TopOpportunityCard
                                key={project.id}
                                project={project}
                                orgId={orgId}
                                rank={index + 1}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Main Project List Header */}
            {!loading && !error && remainingProjects.length > 0 && (
                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-slate-500" />
                        <span className="text-sm text-slate-400">
                            {topOpportunities.length > 0 && !hasActiveFilters ? 'Autres opportunites' : 'Toutes les opportunites'}
                        </span>
                    </div>
                    {totalPages > 1 && (
                        <span className="text-sm text-slate-500">Page {page} sur {totalPages}</span>
                    )}
                </div>
            )}

            {/* Projects List - Mobile Cards */}
            {!loading && !error && remainingProjects.length > 0 && (
                <>
                    {/* Mobile: Cards */}
                    <div className="lg:hidden space-y-3">
                        {remainingProjects.map((project) => (
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
                                            <th className="text-left py-4 px-4 text-sm font-medium text-slate-400 cursor-help" title="Score IA - plus il est eleve, plus le projet est pertinent pour vous">
                                                Score
                                            </th>
                                            <th className="text-left py-4 px-4 text-sm font-medium text-slate-400 cursor-help" title="Niveau de priorite estime par l'IA">
                                                Priorite
                                            </th>
                                            <th className="w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {remainingProjects.map((project) => (
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
                                                    <div className="group/score relative">
                                                        <ScoreGauge score={project.score} priority={project.priority} animate={false} />
                                                        {/* Tooltip on hover */}
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 rounded-lg text-xs text-slate-300 whitespace-nowrap opacity-0 group-hover/score:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
                                                            {SCORE_INTERPRETATIONS[project.priority]}
                                                        </div>
                                                    </div>
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

            {/* Empty State - Enhanced with psychological optimizations */}
            {!loading && !error && projects.length === 0 && (
                <GlassCard className="py-12 px-6">
                    <div className="text-center max-w-lg mx-auto">
                        {/* Animated radar icon */}
                        <div className="relative w-24 h-24 mx-auto mb-6">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-500/20 to-cyan-500/20 animate-pulse" />
                            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-teal-500/10 to-cyan-500/10" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Radar size={40} className="text-teal-400" />
                            </div>
                            {/* Scanning indicator */}
                            {!hasActiveFilters && (
                                <div className="absolute -top-1 -right-1 flex items-center gap-1 px-2 py-1 bg-teal-500/20 rounded-full border border-teal-500/30">
                                    <PulsingDot color="teal" />
                                    <span className="text-[10px] text-teal-300 font-medium">SCAN</span>
                                </div>
                            )}
                        </div>

                        {hasActiveFilters ? (
                            <>
                                <h3 className="text-xl font-light text-white mb-3">
                                    Aucun resultat pour ces filtres
                                </h3>
                                <p className="text-slate-400 leading-relaxed mb-6">
                                    Essayez de modifier ou supprimer vos filtres pour voir plus de resultats.
                                </p>
                                <button
                                    onClick={clearAllFilters}
                                    className="px-6 py-3 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-xl border border-teal-500/30 transition-all min-h-[48px]"
                                >
                                    Effacer les filtres
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Proactive title - no "0" */}
                                <h3 className="text-xl font-light text-white mb-2">
                                    L&apos;IA collecte les premieres opportunites
                                </h3>

                                {/* Sub-headline with anticipation */}
                                <p className="text-slate-400 leading-relaxed mb-4">
                                    Notre radar analyse votre region pour detecter les projets BTP pertinents.
                                </p>

                                {/* Future value projection */}
                                <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
                                    <p className="text-sm text-slate-300 flex items-start gap-2">
                                        <Rocket size={16} className="text-teal-400 flex-shrink-0 mt-0.5" />
                                        <span>
                                            Des qu&apos;un projet de construction ou renovation bouge dans votre region,
                                            il apparaitra automatiquement ici.
                                        </span>
                                    </p>
                                </div>

                                {/* Next update timestamp */}
                                <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-6">
                                    <Clock size={14} />
                                    <span>Prochaine mise a jour : cette nuit</span>
                                </div>

                                {/* Proactive CTA */}
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-500">
                                        Vous voulez accelerer la detection ?
                                    </p>
                                    <Link
                                        href={`/org/${orgId}/shark/sourcing`}
                                        className="inline-flex items-center gap-2 px-5 py-3 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-xl border border-teal-500/30 transition-all group"
                                    >
                                        <Search size={16} />
                                        <span>Lancer une recherche manuelle</span>
                                        <ArrowRight size={14} className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                                    </Link>
                                </div>

                                {/* Reassurance */}
                                <p className="text-xs text-slate-600 mt-6">
                                    CoreMatch travaille pour vous, meme quand vous dormez.
                                </p>
                            </>
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
