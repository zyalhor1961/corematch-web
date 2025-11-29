'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
    AlertCircle,
    Sparkles,
    CheckCircle,
} from 'lucide-react';
import {
    SharkAlertsResponse,
    SharkScoreChange,
    SharkRecentProject,
    SharkPriority,
    PRIORITY_COLORS,
    PRIORITY_LABELS,
} from '@/types/shark';
import { GlassCard } from '@/components/ui/GlassCard';

// =============================================================================
// Loading Skeleton
// =============================================================================

function AlertsSkeleton() {
    return (
        <div className="space-y-6">
            {/* Critical Counter Skeleton */}
            <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-xl p-6 animate-pulse">
                <div className="flex items-center justify-between">
                    <div className="space-y-3">
                        <div className="h-4 bg-red-500/20 rounded w-40" />
                        <div className="h-4 bg-red-500/10 rounded w-64" />
                    </div>
                    <div className="w-16 h-16 bg-red-500/20 rounded-full" />
                </div>
            </div>

            {/* Cards Skeleton */}
            <div className="grid md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-[#0F172A]/40 rounded-xl p-4 animate-pulse">
                        <div className="space-y-3">
                            <div className="h-5 bg-slate-700/50 rounded w-3/4" />
                            <div className="flex gap-2">
                                <div className="h-6 bg-slate-700/40 rounded w-16" />
                                <div className="h-6 bg-slate-700/40 rounded w-20" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// =============================================================================
// Sub-components
// =============================================================================

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

function CriticalCounter({ count }: { count: number }) {
    return (
        <GlassCard
            className={`${
                count > 0
                    ? 'bg-gradient-to-br from-red-500/15 to-orange-500/15 border-red-500/30'
                    : 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20'
            }`}
            glow={count > 0 ? 'none' : 'teal'}
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className={`text-sm font-medium mb-2 ${count > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                        {count > 0 ? 'Opportunites a ne pas manquer' : 'Tout est sous controle'}
                    </p>
                    <p className={`text-sm ${count > 0 ? 'text-red-200/80' : 'text-emerald-200/80'}`}>
                        {count > 0
                            ? `${count} opportunite${count > 1 ? 's' : ''} importante${count > 1 ? 's' : ''} detectee${count > 1 ? 's' : ''} cette semaine`
                            : 'Notre IA continue de surveiller le marche pour vous'}
                    </p>
                </div>
                <div className={`flex items-center justify-center w-16 h-16 rounded-full ${
                    count > 0
                        ? 'bg-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                        : 'bg-emerald-500/20'
                }`}>
                    {count > 0 ? (
                        <span className="text-3xl font-bold text-white">{count}</span>
                    ) : (
                        <CheckCircle size={28} className="text-emerald-400" />
                    )}
                </div>
            </div>
        </GlassCard>
    );
}

function ScoreChangeCard({ change, orgId }: { change: SharkScoreChange; orgId: string }) {
    const isPositive = change.change > 0;

    return (
        <GlassCard hoverEffect padding="md">
            <Link href={`/org/${orgId}/shark/projects/${change.project_id}`} className="block">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isPositive
                                ? 'bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                : 'bg-red-500/20'
                        }`}>
                            <TrendingUp
                                size={22}
                                className={isPositive ? 'text-emerald-400' : 'text-red-400 rotate-180'}
                            />
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-medium text-white line-clamp-1">{change.name}</h4>
                            <div className="flex items-center gap-2 mt-1 text-sm">
                                <span className="text-slate-400 font-mono">{change.old_score}</span>
                                <ArrowUpRight size={14} className="text-slate-500" />
                                <span className="text-white font-mono font-medium">{change.new_score}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`px-3 py-1.5 text-sm font-bold rounded-lg ${
                            isPositive
                                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                : 'bg-red-500/20 text-red-400'
                        }`}>
                            {isPositive ? '+' : ''}{change.change}
                        </span>
                        <ExternalLink size={16} className="text-slate-500" />
                    </div>
                </div>
            </Link>
        </GlassCard>
    );
}

function RecentProjectCard({ project, orgId }: { project: SharkRecentProject; orgId: string }) {
    return (
        <GlassCard hoverEffect padding="md">
            <Link href={`/org/${orgId}/shark/projects/${project.project_id}`} className="block">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white line-clamp-2 leading-tight">
                            {project.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <PriorityBadge priority={project.priority} />
                            <span className="text-sm text-slate-400">
                                <span className="text-teal-400 font-mono font-medium">{project.score}</span>/100
                            </span>
                        </div>
                    </div>
                    <ExternalLink size={16} className="text-slate-500 flex-shrink-0 mt-1" />
                </div>
            </Link>
        </GlassCard>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export default function SharkAlertsClient() {
    const params = useParams();
    const orgId = params.orgId as string;

    const [alerts, setAlerts] = useState<SharkAlertsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/shark/alerts', {
                headers: { 'X-Org-Id': orgId },
            });

            if (!response.ok) {
                throw new Error('Impossible de charger les alertes');
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

    // Loading
    if (loading) {
        return <AlertsSkeleton />;
    }

    // Error
    if (error) {
        return (
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
                        onClick={fetchAlerts}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
                    >
                        Reessayer
                    </button>
                </div>
            </GlassCard>
        );
    }

    if (!alerts) return null;

    const { new_critical_projects_count, score_changes, recent_projects } = alerts;
    const criticalProjects = recent_projects.filter(p => p.priority === 'CRITICAL');
    const hasContent = new_critical_projects_count > 0 || score_changes.length > 0 || recent_projects.length > 0;

    return (
        <div className="space-y-8">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Sparkles size={14} className="text-teal-500" />
                    <span>Nous vous prevenons des qu&apos;une opportunite importante apparait</span>
                </div>
                <button
                    onClick={fetchAlerts}
                    title="Verifier si l'IA a detecte de nouveaux signaux"
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-[#0F172A]/60 backdrop-blur-xl hover:bg-slate-800/50 text-slate-300 rounded-xl border border-white/10 transition-all min-h-[48px]"
                >
                    <RefreshCw size={18} />
                    <span>Actualiser les alertes</span>
                </button>
            </div>

            {/* Critical Counter */}
            <CriticalCounter count={new_critical_projects_count} />

            {/* Empty State */}
            {!hasContent && (
                <GlassCard className="py-16">
                    <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                            <Bell size={40} className="text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-light text-white mb-3">
                            Aucune alerte critique pour le moment
                        </h3>
                        <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                            C&apos;est plutot bon signe. Notre IA continue de surveiller le marche et vous alertera des qu&apos;un projet a fort potentiel apparaitra.
                        </p>
                        <p className="text-xs text-slate-500 mt-4">
                            Ne manquez jamais un projet a fort potentiel.
                        </p>
                    </div>
                </GlassCard>
            )}

            {hasContent && (
                <>
                    {/* Critical Projects */}
                    {criticalProjects.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-500/20 rounded-lg">
                                    <AlertTriangle size={18} className="text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-white">A traiter en priorite</h3>
                                    <p className="text-xs text-slate-500">Ces projets meritent votre attention immediate</p>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-3">
                                {criticalProjects.map((project) => (
                                    <RecentProjectCard key={project.project_id} project={project} orgId={orgId} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Score Changes */}
                    {score_changes.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/20 rounded-lg">
                                    <Zap size={18} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-white">Projets qui bougent</h3>
                                    <p className="text-xs text-slate-500">Un projet est soudainement devenu plus interessant</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {score_changes.map((change) => (
                                    <ScoreChangeCard key={change.project_id} change={change} orgId={orgId} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Projects */}
                    {recent_projects.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-teal-500/20 rounded-lg">
                                    <Target size={18} className="text-teal-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-white">Dernieres opportunites detectees</h3>
                                    <p className="text-xs text-slate-500">Fraichement identifiees pour vous par notre IA</p>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {recent_projects.map((project) => (
                                    <RecentProjectCard key={project.project_id} project={project} orgId={orgId} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
