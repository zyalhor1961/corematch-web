'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Activity,
    RefreshCw,
    Search,
    Filter,
    Newspaper,
    TrendingUp,
    Users,
    Database,
    ExternalLink,
    Clock,
    X,
    AlertCircle,
    Sparkles,
    Building2,
    FileText,
    Gavel,
    ArrowRight,
    MapPin,
} from 'lucide-react';
import {
    SharkActivityItem,
    SharkActivityType,
    SharkPriority,
    ACTIVITY_TYPE_COLORS,
    ACTIVITY_TYPE_LABELS,
} from '@/types/shark';
import { GlassCard } from '@/components/ui/GlassCard';

// =============================================================================
// Types
// =============================================================================

type FilterType = 'all' | SharkActivityType;

interface GroupedActivities {
    label: string;
    items: SharkActivityItem[];
}

// =============================================================================
// Helpers
// =============================================================================

function getActivityIcon(type: SharkActivityType) {
    switch (type) {
        case 'news':
            return Newspaper;
        case 'score_update':
            return TrendingUp;
        case 'osint_enrichment':
            return Users;
        case 'ingestion':
            return Database;
        case 'tender_detected':
            return Gavel;
        case 'permit_detected':
            return FileText;
        default:
            return Activity;
    }
}

// Priority badge colors
const PRIORITY_COLORS: Record<SharkPriority, { bg: string; text: string; glow: string }> = {
    CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-300', glow: 'shadow-[0_0_10px_rgba(239,68,68,0.3)]' },
    HIGH: { bg: 'bg-orange-500/20', text: 'text-orange-300', glow: 'shadow-[0_0_8px_rgba(249,115,22,0.2)]' },
    MEDIUM: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', glow: '' },
    LOW: { bg: 'bg-slate-500/20', text: 'text-slate-400', glow: '' },
};

const PRIORITY_LABELS: Record<SharkPriority, string> = {
    CRITICAL: 'CRITIQUE',
    HIGH: 'ELEVE',
    MEDIUM: 'MOYEN',
    LOW: 'FAIBLE',
};

// Source type badge config
const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    tender: { label: 'Marche public', color: 'bg-purple-500/20 text-purple-300', icon: Gavel },
    boamp: { label: 'BOAMP', color: 'bg-purple-500/20 text-purple-300', icon: Gavel },
    permit: { label: 'Permis de construire', color: 'bg-amber-500/20 text-amber-300', icon: FileText },
    news: { label: 'Actualite', color: 'bg-blue-500/20 text-blue-300', icon: Newspaper },
    exa: { label: 'Veille web', color: 'bg-cyan-500/20 text-cyan-300', icon: Search },
    manual: { label: 'Manuel', color: 'bg-slate-500/20 text-slate-400', icon: Users },
};

function formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function getDateGroup(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (date >= today) {
        return 'Aujourd\'hui';
    } else if (date >= yesterday) {
        return 'Hier';
    } else if (date >= weekAgo) {
        return 'Cette semaine';
    } else {
        return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
}

function groupActivitiesByDate(items: SharkActivityItem[]): GroupedActivities[] {
    const groups: Map<string, SharkActivityItem[]> = new Map();

    for (const item of items) {
        const label = getDateGroup(item.timestamp);
        if (!groups.has(label)) {
            groups.set(label, []);
        }
        groups.get(label)!.push(item);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({
        label,
        items: items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    }));
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function ActivitySkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="h-4 bg-slate-700/50 rounded w-24 animate-pulse" />
                <div className="flex-1 h-px bg-white/10" />
            </div>
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#0F172A]/40 rounded-xl p-4 animate-pulse">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-slate-700/50 rounded-full" />
                        <div className="flex-1 space-y-3">
                            <div className="h-4 bg-slate-700/50 rounded w-full" />
                            <div className="h-4 bg-slate-700/30 rounded w-3/4" />
                            <div className="flex gap-3">
                                <div className="h-4 bg-slate-700/40 rounded w-16" />
                                <div className="h-4 bg-slate-700/40 rounded w-20" />
                            </div>
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

function ActivityTypeBadge({ type }: { type: SharkActivityType }) {
    const Icon = getActivityIcon(type);
    const glowClass = type === 'score_update' ? 'shadow-[0_0_10px_rgba(20,184,166,0.3)]' : '';

    return (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ACTIVITY_TYPE_COLORS[type]} ${glowClass}`}>
            <Icon size={18} className="text-white" />
        </div>
    );
}

function PriorityBadge({ priority }: { priority?: SharkPriority }) {
    if (!priority) return null;
    const colors = PRIORITY_COLORS[priority];
    return (
        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${colors.bg} ${colors.text} ${colors.glow}`}>
            {PRIORITY_LABELS[priority]}
        </span>
    );
}

function SourceTypeBadge({ sourceType }: { sourceType?: string }) {
    if (!sourceType) return null;
    const config = SOURCE_TYPE_CONFIG[sourceType];
    if (!config) return null;
    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${config.color}`}>
            <Icon size={12} />
            {config.label}
        </span>
    );
}

function ScoreChange({ before, after }: { before?: number; after?: number }) {
    if (before === undefined || after === undefined) return null;
    const isIncrease = after > before;
    const change = after - before;

    return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <span className="text-slate-400">{before}</span>
            <ArrowRight size={14} className={isIncrease ? 'text-teal-400' : 'text-red-400'} />
            <span className={isIncrease ? 'text-teal-300' : 'text-red-300'}>{after}</span>
            <span className={`text-xs ${isIncrease ? 'text-teal-500' : 'text-red-500'}`}>
                ({isIncrease ? '+' : ''}{change})
            </span>
        </span>
    );
}

function FilterButton({
    active,
    label,
    onClick,
    icon: Icon,
    color,
    tooltip,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
    icon?: React.ElementType;
    color?: string;
    tooltip?: string;
}) {
    return (
        <button
            onClick={onClick}
            title={tooltip}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border transition-all min-h-[44px] ${
                active
                    ? `${color || 'bg-teal-500/20'} border-teal-500/50 text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.2)]`
                    : 'bg-[#0F172A]/60 backdrop-blur-xl border-white/10 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
            }`}
        >
            {Icon && <Icon size={16} />}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export default function ActivityFeedClient() {
    const params = useParams();
    const router = useRouter();
    const orgId = params.orgId as string;

    // State
    const [activities, setActivities] = useState<SharkActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // =============================================================================
    // Data Fetching
    // =============================================================================

    const fetchActivities = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/shark/activity?limit=100', {
                headers: { 'X-Org-Id': orgId },
            });

            if (!response.ok) {
                throw new Error('Impossible de charger l\'historique');
            }

            const data = await response.json();
            setActivities(data.items || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
            setActivities([]);
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        if (orgId) {
            fetchActivities();
        }
    }, [orgId, fetchActivities]);

    // =============================================================================
    // Filtering
    // =============================================================================

    const filteredActivities = useMemo(() => {
        let items = activities;

        if (filterType !== 'all') {
            items = items.filter((item) => item.type === filterType);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            items = items.filter((item) => item.summary.toLowerCase().includes(query));
        }

        return items;
    }, [activities, filterType, searchQuery]);

    const groupedActivities = useMemo(() => {
        return groupActivitiesByDate(filteredActivities);
    }, [filteredActivities]);

    // =============================================================================
    // Render
    // =============================================================================

    return (
        <div className="space-y-6">
            {/* Search & Refresh Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher dans l'historique..."
                        className="w-full bg-[#0F172A]/60 backdrop-blur-xl border border-white/10 text-white rounded-xl pl-11 pr-10 py-3 focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 transition-all placeholder:text-slate-500"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <button
                    onClick={fetchActivities}
                    disabled={loading}
                    title="Voir si du nouveau est apparu depuis votre derniere visite"
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-[#0F172A]/60 backdrop-blur-xl hover:bg-slate-800/50 text-slate-300 rounded-xl border border-white/10 transition-all disabled:opacity-50 min-h-[48px]"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    <span className="hidden sm:inline">Actualiser</span>
                </button>
            </div>

            {/* Type Filters */}
            <div className="flex flex-wrap gap-2">
                <FilterButton
                    active={filterType === 'all'}
                    label="Tous"
                    onClick={() => setFilterType('all')}
                    icon={Filter}
                    tooltip="Voir toutes les activites detectees"
                />
                <FilterButton
                    active={filterType === 'score_update'}
                    label="Activite projet"
                    onClick={() => setFilterType('score_update')}
                    icon={TrendingUp}
                    color="bg-teal-500/20"
                    tooltip="Evolutions et mouvements importants du marche"
                />
                <FilterButton
                    active={filterType === 'news'}
                    label="Actualites"
                    onClick={() => setFilterType('news')}
                    icon={Newspaper}
                    color="bg-blue-500/20"
                    tooltip="Articles pertinents detectes automatiquement"
                />
                <FilterButton
                    active={filterType === 'osint_enrichment'}
                    label="Recherche Web"
                    onClick={() => setFilterType('osint_enrichment')}
                    icon={Users}
                    color="bg-purple-500/20"
                    tooltip="Informations trouvees via des sources publiques"
                />
                <FilterButton
                    active={filterType === 'ingestion'}
                    label="Analyse IA"
                    onClick={() => setFilterType('ingestion')}
                    icon={Database}
                    color="bg-slate-500/20"
                    tooltip="Traitement intelligent des articles et donnees"
                />
            </div>

            {/* Stats */}
            {!loading && !error && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Sparkles size={14} className="text-teal-500" />
                    <span>{filteredActivities.length} evenement{filteredActivities.length !== 1 ? 's' : ''} detecte{filteredActivities.length !== 1 ? 's' : ''}</span>
                </div>
            )}

            {/* Loading State */}
            {loading && <ActivitySkeleton />}

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
                            onClick={fetchActivities}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
                        >
                            Reessayer
                        </button>
                    </div>
                </GlassCard>
            )}

            {/* Empty State */}
            {!loading && !error && filteredActivities.length === 0 && (
                <GlassCard className="py-16">
                    <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                            <Activity size={40} className="text-purple-400" />
                        </div>
                        <h3 className="text-xl font-light text-white mb-3">
                            Pas encore d&apos;activite enregistree
                        </h3>
                        <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                            {searchQuery || filterType !== 'all'
                                ? 'Essayez de modifier vos filtres pour voir plus de resultats.'
                                : 'Des qu\'un projet bouge, il apparaitra ici. Notre IA surveille le marche en continu pour vous.'}
                        </p>
                    </div>
                </GlassCard>
            )}

            {/* Timeline */}
            {!loading && !error && groupedActivities.length > 0 && (
                <div className="space-y-8">
                    {groupedActivities.map((group) => (
                        <div key={group.label}>
                            {/* Date Group Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-sm font-medium text-slate-400 whitespace-nowrap">{group.label}</span>
                                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                            </div>

                            {/* Activity Items */}
                            <div className="space-y-3">
                                {group.items.map((item) => (
                                    <GlassCard
                                        key={item.id}
                                        padding="md"
                                        hoverEffect
                                        className={item.project_id ? 'cursor-pointer' : ''}
                                        onClick={item.project_id ? () => router.push(`/org/${orgId}/shark/projects/${item.project_id}`) : undefined}
                                    >
                                        <div className="flex gap-4">
                                            {/* Type Badge */}
                                            <ActivityTypeBadge type={item.type} />

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                {/* Title Line - enriched display */}
                                                {item.type === 'score_update' && item.title ? (
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <span className="text-white font-medium">Score mis a jour :</span>
                                                        <ScoreChange before={item.score_before} after={item.score_after} />
                                                        <PriorityBadge priority={item.priority_after} />
                                                    </div>
                                                ) : (
                                                    <p className="text-white font-medium mb-1">
                                                        {item.title || item.summary}
                                                    </p>
                                                )}

                                                {/* Subtitle Line - location + context */}
                                                {item.subtitle && (
                                                    <p className="text-slate-400 text-sm mb-2">
                                                        {item.subtitle}
                                                    </p>
                                                )}

                                                {/* Location info when available */}
                                                {(item.project_city || item.project_region) && !item.subtitle && (
                                                    <div className="flex items-center gap-1.5 text-slate-400 text-sm mb-2">
                                                        <MapPin size={12} />
                                                        <span>
                                                            {item.project_city}
                                                            {item.project_city && item.project_region && ' – '}
                                                            {item.project_region}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Badges row */}
                                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                                    <span className="flex items-center gap-1 text-slate-500 text-xs">
                                                        <Clock size={12} />
                                                        {formatTime(item.timestamp)}
                                                    </span>

                                                    {/* Source type badge */}
                                                    <SourceTypeBadge sourceType={item.source_type} />

                                                    {/* Activity type badge (fallback) */}
                                                    {!item.source_type && (
                                                        <span className={`px-2 py-0.5 rounded-lg ${ACTIVITY_TYPE_COLORS[item.type]} text-white/90 text-xs`}>
                                                            {ACTIVITY_TYPE_LABELS[item.type]}
                                                        </span>
                                                    )}

                                                    {/* Project name if available */}
                                                    {item.project_name && item.type !== 'score_update' && (
                                                        <span className="text-xs text-slate-500 truncate max-w-[200px]">
                                                            {item.project_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Link Arrow */}
                                            {item.project_id && (
                                                <div className="hidden sm:flex items-center">
                                                    <ExternalLink size={16} className="text-slate-500" />
                                                </div>
                                            )}
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
