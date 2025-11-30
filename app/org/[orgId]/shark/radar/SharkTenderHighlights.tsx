'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    FileText,
    Timer,
    Building2,
    MapPin,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Gavel,
} from 'lucide-react';
import {
    SharkTender,
    getTenderUrgencyColor,
    formatDeadlineCountdown,
    TENDER_STATUS_LABELS,
    TENDER_STATUS_COLORS,
    TenderStatus,
} from '@/types/shark';
import { GlassCard } from '@/components/ui/GlassCard';

// =============================================================================
// Types
// =============================================================================

interface SharkTenderHighlightsProps {
    orgId: string;
    maxItems?: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

function getUrgencyGlow(daysUntilDeadline?: number): string {
    if (daysUntilDeadline === undefined || daysUntilDeadline === null) {
        return '';
    }
    if (daysUntilDeadline <= 0) {
        return 'shadow-[0_0_20px_rgba(239,68,68,0.4)]'; // Red - expired
    }
    if (daysUntilDeadline <= 10) {
        return 'shadow-[0_0_15px_rgba(239,68,68,0.35)] animate-pulse'; // Red pulsing
    }
    if (daysUntilDeadline <= 30) {
        return 'shadow-[0_0_12px_rgba(245,158,11,0.3)]'; // Amber
    }
    return 'shadow-[0_0_8px_rgba(20,184,166,0.2)]'; // Teal
}

function getUrgencyBorderColor(daysUntilDeadline?: number): string {
    if (daysUntilDeadline === undefined || daysUntilDeadline === null) {
        return 'border-slate-700';
    }
    if (daysUntilDeadline <= 0) {
        return 'border-red-500/50';
    }
    if (daysUntilDeadline <= 10) {
        return 'border-red-500/40';
    }
    if (daysUntilDeadline <= 30) {
        return 'border-amber-500/40';
    }
    return 'border-teal-500/30';
}

// =============================================================================
// Sub-components
// =============================================================================

function TenderCard({
    tender,
    orgId,
}: {
    tender: SharkTender;
    orgId: string;
}) {
    const router = useRouter();

    const daysUntilDeadline = tender.days_until_deadline;
    const urgencyColor = getTenderUrgencyColor(daysUntilDeadline);
    const countdownText = formatDeadlineCountdown(daysUntilDeadline);
    const glowClass = getUrgencyGlow(daysUntilDeadline);
    const borderClass = getUrgencyBorderColor(daysUntilDeadline);

    const handleClick = () => {
        if (tender.project_id) {
            router.push(`/org/${orgId}/shark/projects/${tender.project_id}`);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`
                relative p-4 rounded-xl border backdrop-blur-xl
                bg-gradient-to-br from-slate-900/80 to-slate-800/60
                ${borderClass} ${glowClass}
                transition-all duration-300 cursor-pointer
                hover:scale-[1.02] hover:bg-slate-800/70
                group
            `}
        >
            {/* Urgency indicator */}
            {daysUntilDeadline !== undefined && daysUntilDeadline <= 10 && (
                <div className="absolute -top-1.5 -right-1.5 flex items-center gap-1 px-2 py-0.5 bg-red-500 rounded-full shadow-lg">
                    <AlertTriangle size={10} className="text-white" />
                    <span className="text-[10px] font-bold text-white">URGENT</span>
                </div>
            )}

            <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`
                        p-2.5 rounded-lg
                        ${daysUntilDeadline !== undefined && daysUntilDeadline <= 10
                            ? 'bg-red-500/20'
                            : daysUntilDeadline !== undefined && daysUntilDeadline <= 30
                                ? 'bg-amber-500/20'
                                : 'bg-purple-500/20'
                        }
                    `}>
                        <Gavel size={18} className={
                            daysUntilDeadline !== undefined && daysUntilDeadline <= 10
                                ? 'text-red-400'
                                : daysUntilDeadline !== undefined && daysUntilDeadline <= 30
                                    ? 'text-amber-400'
                                    : 'text-purple-400'
                        } />
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white line-clamp-2 leading-tight group-hover:text-teal-300 transition-colors">
                            {tender.title || tender.external_id}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            {tender.buyer_name && (
                                <span className="flex items-center gap-1 truncate max-w-[150px]">
                                    <Building2 size={10} />
                                    {tender.buyer_name}
                                </span>
                            )}
                            {tender.location_city && (
                                <span className="flex items-center gap-1">
                                    <MapPin size={10} />
                                    {tender.location_city}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Deadline countdown */}
                <div className={`
                    flex items-center justify-between gap-2 p-2 rounded-lg
                    bg-slate-800/50 border border-white/5
                `}>
                    <div className="flex items-center gap-2">
                        <Timer size={14} className={urgencyColor} />
                        <span className={`text-sm font-medium ${urgencyColor}`}>
                            {countdownText}
                        </span>
                    </div>
                    {tender.deadline_at && (
                        <span className="text-xs text-slate-500">
                            {new Date(tender.deadline_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                            })}
                        </span>
                    )}
                </div>

                {/* CPV codes */}
                {tender.cpv_codes && tender.cpv_codes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {tender.cpv_codes.slice(0, 3).map((cpv, idx) => (
                            <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded border border-blue-500/20"
                                title={`Code CPV: ${cpv}`}
                            >
                                {cpv}
                            </span>
                        ))}
                        {tender.cpv_codes.length > 3 && (
                            <span className="text-[10px] text-slate-500">
                                +{tender.cpv_codes.length - 3}
                            </span>
                        )}
                    </div>
                )}

                {/* Status badge */}
                <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${TENDER_STATUS_COLORS[tender.status as TenderStatus] || 'bg-slate-500/20 text-slate-400'}`}>
                        {TENDER_STATUS_LABELS[tender.status as TenderStatus] || tender.status}
                    </span>
                    {tender.procedure_type && (
                        <span className="text-[10px] text-slate-500">
                            {tender.procedure_type}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 bg-slate-900/50 rounded-xl border border-white/10 animate-pulse">
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-slate-700/50 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-700/50 rounded w-3/4" />
                                <div className="h-3 bg-slate-700/30 rounded w-1/2" />
                            </div>
                        </div>
                        <div className="h-8 bg-slate-700/40 rounded-lg" />
                        <div className="flex gap-1">
                            <div className="h-4 bg-slate-700/30 rounded w-12" />
                            <div className="h-4 bg-slate-700/30 rounded w-12" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export default function SharkTenderHighlights({
    orgId,
    maxItems = 3,
}: SharkTenderHighlightsProps) {
    const [tenders, setTenders] = useState<SharkTender[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);

    const fetchTenders = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/shark/tenders/recent?days=30&page_size=10&status=published`,
                {
                    headers: { 'X-Org-Id': orgId },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch tenders');
            }

            const data = await response.json();

            // Sort by deadline (most urgent first)
            const sortedTenders = (data.items || []).sort((a: SharkTender, b: SharkTender) => {
                const daysA = a.days_until_deadline ?? 999;
                const daysB = b.days_until_deadline ?? 999;
                return daysA - daysB;
            });

            setTenders(sortedTenders);
        } catch (err) {
            console.error('[TenderHighlights] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        if (orgId) {
            fetchTenders();
        }
    }, [orgId, fetchTenders]);

    // Pagination
    const totalPages = Math.ceil(tenders.length / maxItems);
    const visibleTenders = tenders.slice(
        currentPage * maxItems,
        (currentPage + 1) * maxItems
    );

    const goToPrev = () => setCurrentPage((p) => Math.max(0, p - 1));
    const goToNext = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1));

    // Don't render if no tenders
    if (!loading && tenders.length === 0) {
        return null;
    }

    return (
        <GlassCard padding="lg" className="relative overflow-hidden">
            {/* Header gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-amber-500/5 pointer-events-none" />

            <div className="relative space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500/20 to-amber-500/20 rounded-lg border border-purple-500/20">
                            <FileText size={18} className="text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-medium">Appels d&apos;offres recents</h3>
                            <p className="text-xs text-slate-500">
                                Marches publics a traiter en priorite
                            </p>
                        </div>
                    </div>

                    {/* Navigation */}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={goToPrev}
                                disabled={currentPage === 0}
                                className="p-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white rounded-lg border border-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs text-slate-500">
                                {currentPage + 1}/{totalPages}
                            </span>
                            <button
                                onClick={goToNext}
                                disabled={currentPage >= totalPages - 1}
                                className="p-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white rounded-lg border border-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <LoadingSkeleton />
                ) : error ? (
                    <p className="text-center text-slate-500 py-4">
                        {error}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {visibleTenders.map((tender) => (
                            <TenderCard
                                key={tender.tender_id}
                                tender={tender}
                                orgId={orgId}
                            />
                        ))}
                    </div>
                )}
            </div>
        </GlassCard>
    );
}
