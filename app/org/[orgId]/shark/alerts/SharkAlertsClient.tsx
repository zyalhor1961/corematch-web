'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    AlertTriangle,
    TrendingUp,
    ArrowUpRight,
    RefreshCw,
    Bell,
    Target,
    ExternalLink,
    Zap,
} from 'lucide-react';
import {
    SharkAlertsResponse,
    SharkScoreChange,
    SharkRecentProject,
    SharkPriority,
    PRIORITY_COLORS,
    PRIORITY_LABELS,
} from '@/types/shark';

// =============================================================================
// Sub-components
// =============================================================================

function PriorityBadge({ priority }: { priority: SharkPriority }) {
    return (
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[priority]}`}>
            {PRIORITY_LABELS[priority]}
        </span>
    );
}

function CriticalCounter({ count }: { count: number }) {
    return (
        <div className="p-6 bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-xl">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-red-300 font-medium mb-1">Opportunites a ne pas manquer</p>
                    <p className="text-red-200 text-sm">
                        {count > 0
                            ? `${count} opportunite${count > 1 ? 's' : ''} importante${count > 1 ? 's' : ''} detectee${count > 1 ? 's' : ''} cette semaine`
                            : 'Aucune nouvelle opportunite urgente - notre IA continue de surveiller'
                        }
                    </p>
                </div>
                <div className="flex items-center justify-center w-16 h-16 bg-red-500/30 rounded-full">
                    <span className="text-3xl font-bold text-white">{count}</span>
                </div>
            </div>
        </div>
    );
}

function ScoreChangeCard({
    change,
    orgId,
}: {
    change: SharkScoreChange;
    orgId: string;
}) {
    const isPositive = change.change > 0;

    return (
        <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-white/10 rounded-xl hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                    <TrendingUp
                        size={20}
                        className={isPositive ? 'text-green-400' : 'text-red-400 rotate-180'}
                    />
                </div>
                <div>
                    <h4 className="font-medium text-white line-clamp-1">{change.name}</h4>
                    <div className="flex items-center gap-2 mt-1 text-sm">
                        <span className="text-slate-400">{change.old_score}</span>
                        <ArrowUpRight size={14} className="text-slate-500" />
                        <span className="text-white font-medium">{change.new_score}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className={`px-3 py-1 text-sm font-bold rounded-lg ${
                    isPositive
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                }`}>
                    {isPositive ? '+' : ''}{change.change}
                </span>
                <Link
                    href={`/org/${orgId}/shark/projects/${change.project_id}`}
                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                    <ExternalLink size={16} />
                </Link>
            </div>
        </div>
    );
}

function RecentProjectCard({
    project,
    orgId,
}: {
    project: SharkRecentProject;
    orgId: string;
}) {
    return (
        <Link
            href={`/org/${orgId}/shark/projects/${project.project_id}`}
            className="block p-4 bg-slate-900/50 border border-white/10 rounded-xl hover:bg-slate-800/50 hover:border-teal-500/30 transition-all group"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white line-clamp-2 group-hover:text-teal-300 transition-colors">
                        {project.name}
                    </h4>
                    <div className="flex items-center gap-3 mt-2">
                        <PriorityBadge priority={project.priority} />
                        <span className="text-sm text-slate-400">
                            Evaluation: <span className="text-white font-medium">{project.score}/100</span>
                        </span>
                    </div>
                </div>
                <ExternalLink size={16} className="text-slate-500 group-hover:text-teal-400 transition-colors flex-shrink-0 mt-1" />
            </div>
        </Link>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export default function SharkAlertsClient() {
    const params = useParams();
    const orgId = params.orgId as string;

    // State
    const [alerts, setAlerts] = useState<SharkAlertsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // =============================================================================
    // Data Fetching
    // =============================================================================

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/shark/alerts', {
                headers: {
                    'X-Org-Id': orgId,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch alerts');
            }

            const data = await response.json();
            setAlerts(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        if (orgId) {
            fetchAlerts();
        }
    }, [orgId, fetchAlerts]);

    // =============================================================================
    // Render
    // =============================================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw size={32} className="animate-spin text-teal-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
                {error}
            </div>
        );
    }

    if (!alerts) {
        return null;
    }

    const { new_critical_projects_count, score_changes, recent_projects } = alerts;
    const criticalProjects = recent_projects.filter(p => p.priority === 'CRITICAL');
    const hasContent = new_critical_projects_count > 0 || score_changes.length > 0 || recent_projects.length > 0;

    return (
        <div className="space-y-8">
            {/* Header Actions */}
            <div className="flex justify-end">
                <button
                    onClick={fetchAlerts}
                    title="Verifier si l'IA a detecte de nouveaux signaux"
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl border border-white/10 transition-all"
                >
                    <RefreshCw size={18} />
                    Actualiser les alertes
                </button>
            </div>

            {/* Empty State */}
            {!hasContent && (
                <div className="text-center py-12">
                    <Bell size={48} className="mx-auto text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                        Tout est sous controle
                    </h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                        Notre IA surveille le marche pour vous. Vous serez averti des qu&apos;une opportunite importante apparaitra.
                    </p>
                    <p className="text-xs text-slate-500 mt-3">
                        Ne manquez jamais un projet a fort potentiel.
                    </p>
                </div>
            )}

            {hasContent && (
                <>
                    {/* Critical Projects Counter */}
                    <CriticalCounter count={new_critical_projects_count} />

                    {/* Critical Projects List */}
                    {criticalProjects.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={20} className="text-red-400" />
                                <h3 className="text-lg font-medium text-white">A traiter en priorite</h3>
                            </div>
                            <div className="grid md:grid-cols-2 gap-3">
                                {criticalProjects.map((project) => (
                                    <RecentProjectCard
                                        key={project.project_id}
                                        project={project}
                                        orgId={orgId}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Score Changes */}
                    {score_changes.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Zap size={20} className="text-amber-400" />
                                <h3 className="text-lg font-medium text-white">Projets qui bougent</h3>
                                <span className="text-xs text-slate-500">Notre IA a detecte des evolutions</span>
                            </div>
                            <div className="space-y-3">
                                {score_changes.map((change) => (
                                    <ScoreChangeCard
                                        key={change.project_id}
                                        change={change}
                                        orgId={orgId}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent High-Priority Projects */}
                    {recent_projects.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Target size={20} className="text-teal-400" />
                                <h3 className="text-lg font-medium text-white">Dernieres opportunites detectees</h3>
                                <span className="text-xs text-slate-500">Fraichement identifiees pour vous</span>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {recent_projects.map((project) => (
                                    <RecentProjectCard
                                        key={project.project_id}
                                        project={project}
                                        orgId={orgId}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
