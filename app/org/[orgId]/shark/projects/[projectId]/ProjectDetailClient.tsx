'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
    Building2,
    Users,
    Newspaper,
    MapPin,
    Calendar,
    Euro,
    TrendingUp,
    RefreshCw,
    ExternalLink,
    Linkedin,
    Mail,
    Phone,
    Globe,
    Clock,
    Target,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import {
    SharkPhase,
    SharkScale,
    SharkPriority,
    PHASE_LABELS,
    PHASE_COLORS,
    PRIORITY_COLORS,
    PRIORITY_LABELS,
} from '@/types/shark';

// =============================================================================
// Types
// =============================================================================

interface ScoreBreakdownItem {
    points: number;
    value?: string | number;
    count?: number;
    reason?: string;
}

interface ScoreDetails {
    raw_total: number;
    final_score: number;
    breakdown: Record<string, ScoreBreakdownItem>;
    time_decay: {
        days_since_last_update: number;
        penalty: number;
    };
}

interface ProjectCore {
    project_id: string;
    name: string;
    type?: string;
    description_short?: string;
    location_city?: string;
    location_region?: string;
    country: string;
    budget_amount?: number;
    budget_currency: string;
    start_date_est?: string;
    end_date_est?: string;
    phase?: string;
    sector_tags: string[];
    estimated_scale?: string;
    score: number;
    priority: string;
    ai_confidence?: number;
    created_at?: string;
    updated_at?: string;
}

interface Organization {
    organization_id: string;
    name: string;
    org_type?: string;
    role_in_project?: string;
    city?: string;
    region?: string;
    website?: string;
    siren?: string;
}

interface Person {
    person_id: string;
    full_name: string;
    title?: string;
    organization_id?: string;
    organization_name?: string;
    linkedin_url?: string;
    email_guess?: string;
    source_confidence?: number;
    is_current_role: boolean;
}

interface NewsItem {
    news_id: string;
    title?: string;
    source_name?: string;
    source_url?: string;
    published_at?: string;
    excerpt?: string;
}

interface ProjectDetail {
    project: ProjectCore;
    score_details?: ScoreDetails;
    organizations: Organization[];
    people: Person[];
    news: NewsItem[];
}

// =============================================================================
// Sub-components
// =============================================================================

function PriorityBadge({ priority }: { priority: SharkPriority }) {
    return (
        <span className={`px-3 py-1 text-sm font-medium rounded-lg ${PRIORITY_COLORS[priority]}`}>
            {PRIORITY_LABELS[priority]}
        </span>
    );
}

function PhaseBadge({ phase }: { phase: SharkPhase }) {
    const safePhase = (phase || 'etude') as SharkPhase;
    return (
        <span className={`px-3 py-1 text-sm font-medium rounded-lg text-white ${PHASE_COLORS[safePhase] || 'bg-slate-500'}`}>
            {PHASE_LABELS[safePhase] || phase}
        </span>
    );
}

function ScoreGauge({ score, priority }: { score: number; priority: SharkPriority }) {
    const gaugeColor = {
        LOW: 'from-slate-500 to-slate-400',
        MEDIUM: 'from-blue-500 to-blue-400',
        HIGH: 'from-amber-500 to-amber-400',
        CRITICAL: 'from-red-500 to-red-400',
    }[priority];

    return (
        <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90">
                <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-slate-700"
                />
                <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="url(#scoreGradient)"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(score / 100) * 352} 352`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                />
                <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" className={`text-${gaugeColor.split(' ')[0].replace('from-', '')}`} stopColor="currentColor" />
                        <stop offset="100%" className={`text-${gaugeColor.split(' ')[1].replace('to-', '')}`} stopColor="currentColor" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{score}</span>
                <span className="text-xs text-slate-400">/ 100</span>
            </div>
        </div>
    );
}

function InfoCard({ icon: Icon, label, value, className = '' }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex items-start gap-3 ${className}`}>
            <div className="p-2 bg-slate-800/50 rounded-lg">
                <Icon size={18} className="text-teal-400" />
            </div>
            <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-sm text-white mt-0.5">{value || '-'}</p>
            </div>
        </div>
    );
}

function SectionHeader({ icon: Icon, title, count, expanded, onToggle, tooltip }: {
    icon: React.ElementType;
    title: string;
    count?: number;
    expanded: boolean;
    onToggle: () => void;
    tooltip?: string;
}) {
    return (
        <button
            onClick={onToggle}
            title={tooltip}
            className="w-full flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl transition-colors"
        >
            <div className="flex items-center gap-3">
                <Icon size={20} className="text-teal-400" />
                <h3 className="text-lg font-medium text-white">{title}</h3>
                {count !== undefined && (
                    <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
                        {count}
                    </span>
                )}
            </div>
            {expanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </button>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export default function ProjectDetailClient() {
    const params = useParams();
    const orgId = params.orgId as string;
    const projectId = params.projectId as string;

    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Section expansion state
    const [expandedSections, setExpandedSections] = useState({
        organizations: true,
        people: true,
        news: true,
        score: false,
    });

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // =============================================================================
    // Data Fetching
    // =============================================================================

    const fetchProject = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/shark/projects/${projectId}`, {
                headers: {
                    'X-Org-Id': orgId,
                },
            });

            if (!response.ok) {
                throw new Error('Projet non trouve');
            }

            const data = await response.json();
            setProject(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    }, [orgId, projectId]);

    const refreshScore = async () => {
        setRefreshing(true);
        try {
            const response = await fetch(`/api/shark/projects/${projectId}/refresh-score`, {
                method: 'POST',
                headers: {
                    'X-Org-Id': orgId,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ force_recompute: true }),
            });

            if (response.ok) {
                await fetchProject();
            }
        } catch (err) {
            console.error('Failed to refresh score:', err);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (orgId && projectId) {
            fetchProject();
        }
    }, [orgId, projectId, fetchProject]);

    // =============================================================================
    // Loading & Error States
    // =============================================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw size={32} className="animate-spin text-teal-500" />
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="text-center py-20">
                <Target size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                    {error || 'Projet non trouve'}
                </h3>
                <p className="text-slate-400">
                    Le projet demande n&apos;existe pas ou n&apos;est pas accessible.
                </p>
            </div>
        );
    }

    const { project: p, score_details, organizations, people, news } = project;

    // =============================================================================
    // Render
    // =============================================================================

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="p-6 bg-slate-900/50 border border-white/10 rounded-xl">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: Project Info */}
                    <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">{p.name}</h2>
                                <div className="flex flex-wrap gap-2">
                                    <PhaseBadge phase={p.phase as SharkPhase} />
                                    <PriorityBadge priority={p.priority as SharkPriority} />
                                    {p.estimated_scale && (
                                        <span className="px-3 py-1 text-sm font-medium rounded-lg bg-slate-700 text-slate-300">
                                            {p.estimated_scale}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {p.description_short && (
                            <p className="text-slate-300 text-sm leading-relaxed">
                                {p.description_short}
                            </p>
                        )}

                        {/* Tags */}
                        {p.sector_tags && p.sector_tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {p.sector_tags.map((tag, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-teal-500/20 text-teal-300 text-xs rounded-lg border border-teal-500/30">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                            <InfoCard
                                icon={MapPin}
                                label="Localisation"
                                value={[p.location_city, p.location_region].filter(Boolean).join(', ') || 'Non renseigne'}
                            />
                            <InfoCard
                                icon={Euro}
                                label="Budget"
                                value={p.budget_amount
                                    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: p.budget_currency, maximumFractionDigits: 0 }).format(p.budget_amount)
                                    : 'Non renseigne'
                                }
                            />
                            <InfoCard
                                icon={Calendar}
                                label="Debut estime"
                                value={p.start_date_est
                                    ? new Date(p.start_date_est).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                                    : 'Non renseigne'
                                }
                            />
                            <InfoCard
                                icon={Clock}
                                label="Derniere MAJ"
                                value={p.updated_at
                                    ? new Date(p.updated_at).toLocaleDateString('fr-FR')
                                    : '-'
                                }
                            />
                        </div>
                    </div>

                    {/* Right: Score Gauge */}
                    <div className="flex flex-col items-center gap-4 p-4 bg-slate-800/30 rounded-xl">
                        <div title="Evaluation calculee automatiquement a partir des signaux detectes par notre IA">
                            <ScoreGauge score={p.score} priority={p.priority as SharkPriority} />
                        </div>
                        <p className="text-xs text-slate-500 text-center max-w-[140px]">
                            Potentiel commercial estime
                        </p>
                        <button
                            onClick={refreshScore}
                            disabled={refreshing}
                            title="Mettre a jour les donnees pour voir si le projet a evolue"
                            className="flex items-center gap-2 px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg border border-teal-500/30 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            Actualiser l&apos;analyse
                        </button>
                    </div>
                </div>
            </div>

            {/* Score Breakdown */}
            {score_details && (
                <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden">
                    <SectionHeader
                        icon={TrendingUp}
                        title="Details de l'analyse"
                        expanded={expandedSections.score}
                        onToggle={() => toggleSection('score')}
                        tooltip="Comment notre IA construit votre evaluation : phase, taille, actualites, acteurs, contacts"
                    />
                    {expandedSections.score && (
                        <div className="p-4 border-t border-white/10">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries(score_details.breakdown).map(([key, item]) => (
                                    <div key={key} className="p-3 bg-slate-800/50 rounded-lg">
                                        <p className="text-xs text-slate-500 uppercase">{key.replace(/_/g, ' ')}</p>
                                        <p className="text-xl font-bold text-white mt-1">
                                            {item.points > 0 ? '+' : ''}{item.points}
                                        </p>
                                        {item.value && <p className="text-xs text-slate-400 mt-1">{String(item.value)}</p>}
                                    </div>
                                ))}
                                {score_details.time_decay.penalty !== 0 && (
                                    <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                                        <p className="text-xs text-red-400 uppercase">Penalite temps</p>
                                        <p className="text-xl font-bold text-red-400 mt-1">
                                            {score_details.time_decay.penalty}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {score_details.time_decay.days_since_last_update} jours
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Organizations */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden">
                <SectionHeader
                    icon={Building2}
                    title="Acteurs du projet"
                    count={organizations.length}
                    expanded={expandedSections.organizations}
                    onToggle={() => toggleSection('organizations')}
                    tooltip="Entreprises impliquees dans ce projet, identifiees automatiquement par notre IA"
                />
                {expandedSections.organizations && (
                    <div className="p-4 border-t border-white/10">
                        {organizations.length === 0 ? (
                            <p className="text-slate-400 text-center py-4">Aucun acteur identifie</p>
                        ) : (
                            <div className="grid gap-3">
                                {organizations.map((org) => (
                                    <div key={org.organization_id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-white">{org.name}</h4>
                                                {org.role_in_project && (
                                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                                                        {org.role_in_project}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                                                {org.org_type && <span>{org.org_type}</span>}
                                                {org.city && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={12} />
                                                        {org.city}
                                                    </span>
                                                )}
                                                {org.siren && <span>SIREN: {org.siren}</span>}
                                            </div>
                                        </div>
                                        {org.website && (
                                            <a
                                                href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                                            >
                                                <Globe size={18} />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* People / Contacts */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden">
                <SectionHeader
                    icon={Users}
                    title="Contacts cles"
                    count={people.length}
                    expanded={expandedSections.people}
                    onToggle={() => toggleSection('people')}
                    tooltip="Les personnes pertinentes pour debloquer cette opportunite"
                />
                {expandedSections.people && (
                    <div className="p-4 border-t border-white/10">
                        {people.length === 0 ? (
                            <p className="text-slate-400 text-center py-4">Aucun contact identifie</p>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-3">
                                {people.map((person) => (
                                    <div key={person.person_id} className="p-4 bg-slate-800/30 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="font-medium text-white">{person.full_name}</h4>
                                                {person.title && (
                                                    <p className="text-sm text-teal-400 mt-0.5">{person.title}</p>
                                                )}
                                                {person.organization_name && (
                                                    <p className="text-xs text-slate-400 mt-1">{person.organization_name}</p>
                                                )}
                                            </div>
                                            {person.source_confidence && (
                                                <span className={`px-2 py-0.5 text-xs rounded ${
                                                    person.source_confidence >= 0.8
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : person.source_confidence >= 0.5
                                                            ? 'bg-amber-500/20 text-amber-400'
                                                            : 'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                    {Math.round(person.source_confidence * 100)}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-3">
                                            {person.linkedin_url && (
                                                <a
                                                    href={person.linkedin_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 bg-[#0077B5]/20 hover:bg-[#0077B5]/30 text-[#0077B5] rounded-lg transition-colors"
                                                >
                                                    <Linkedin size={16} />
                                                </a>
                                            )}
                                            {person.email_guess && (
                                                <a
                                                    href={`mailto:${person.email_guess}`}
                                                    className="p-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                                                >
                                                    <Mail size={16} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* News */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden">
                <SectionHeader
                    icon={Newspaper}
                    title="Actualites"
                    count={news.length}
                    expanded={expandedSections.news}
                    onToggle={() => toggleSection('news')}
                    tooltip="Articles detectes automatiquement pour suivre l'evolution du projet"
                />
                {expandedSections.news && (
                    <div className="p-4 border-t border-white/10">
                        {news.length === 0 ? (
                            <p className="text-slate-400 text-center py-4">Aucune actualite</p>
                        ) : (
                            <div className="space-y-3">
                                {news.map((item) => (
                                    <div key={item.news_id} className="p-4 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-white line-clamp-2">
                                                    {item.title || 'Sans titre'}
                                                </h4>
                                                {item.excerpt && (
                                                    <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                                                        {item.excerpt}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                                    {item.source_name && <span>{item.source_name}</span>}
                                                    {item.published_at && (
                                                        <span>
                                                            {new Date(item.published_at).toLocaleDateString('fr-FR')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {item.source_url && (
                                                <a
                                                    href={item.source_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white flex-shrink-0"
                                                >
                                                    <ExternalLink size={18} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
