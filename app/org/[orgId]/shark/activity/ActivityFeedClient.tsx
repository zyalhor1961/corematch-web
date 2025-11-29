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
} from 'lucide-react';
import {
    SharkActivityItem,
    SharkActivityType,
    ACTIVITY_TYPE_COLORS,
    ACTIVITY_TYPE_LABELS,
} from '@/types/shark';

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
        default:
            return Activity;
    }
}

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
// Sub-components
// =============================================================================

function ActivityTypeBadge({ type }: { type: SharkActivityType }) {
    const Icon = getActivityIcon(type);
    return (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ACTIVITY_TYPE_COLORS[type]}`}>
            <Icon size={16} className="text-white" />
        </div>
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
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-all ${
                active
                    ? `${color || 'bg-teal-500/20'} border-teal-500/50 text-teal-300`
                    : 'bg-slate-800/50 border-white/10 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
            }`}
        >
            {Icon && <Icon size={14} />}
            {label}
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
                headers: {
                    'X-Org-Id': orgId,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch activity feed');
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

        // Filter by type
        if (filterType !== 'all') {
            items = items.filter((item) => item.type === filterType);
        }

        // Filter by search query
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
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher dans les evenements..."
                        className="w-full bg-slate-900/50 border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/30 transition-all placeholder:text-slate-500"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Refresh */}
                <button
                    onClick={fetchActivities}
                    disabled={loading}
                    title="Voir si du nouveau est apparu depuis votre derniere visite"
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl border border-white/10 transition-all disabled:opacity-50"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Actualiser
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

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw size={32} className="animate-spin text-teal-500" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
                    {error}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredActivities.length === 0 && (
                <div className="text-center py-12">
                    <Activity size={48} className="mx-auto text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                        Aucune activite recente
                    </h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                        {searchQuery || filterType !== 'all'
                            ? 'Essayez de modifier vos filtres pour voir plus de resultats'
                            : 'Notre IA surveille le marche en continu. Les nouvelles opportunites apparaitront ici automatiquement.'}
                    </p>
                </div>
            )}

            {/* Timeline */}
            {!loading && !error && groupedActivities.length > 0 && (
                <div className="space-y-8">
                    {groupedActivities.map((group) => (
                        <div key={group.label}>
                            {/* Date Group Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-sm font-medium text-slate-400">{group.label}</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            {/* Activity Items */}
                            <div className="space-y-3">
                                {group.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex gap-4 p-4 bg-slate-900/50 border border-white/10 rounded-xl hover:bg-slate-800/50 transition-colors group"
                                    >
                                        {/* Type Badge */}
                                        <ActivityTypeBadge type={item.type} />

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm leading-relaxed">
                                                {item.summary}
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {formatTime(item.timestamp)}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded ${ACTIVITY_TYPE_COLORS[item.type]}/20 text-slate-300`}>
                                                    {ACTIVITY_TYPE_LABELS[item.type]}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Link to Project */}
                                        {item.project_id && (
                                            <button
                                                onClick={() => router.push(`/org/${orgId}/shark/projects/${item.project_id}`)}
                                                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-slate-700/50 rounded-lg transition-all text-slate-400 hover:text-white"
                                            >
                                                <ExternalLink size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
