'use client';

import React, { useEffect, useState } from 'react';
import { Sun, CheckCircle, AlertOctagon, FileText, Loader2 } from 'lucide-react';

export default function MorningBriefing() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBriefing = async () => {
            try {
                // Use the public URL from your environment variables
                const brainUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'https://corematch-brain-production.up.railway.app';
                const res = await fetch(`${brainUrl}/morning-briefing`);
                const json = await res.json();
                setData(json);
            } catch (e) {
                console.error("Briefing unavailable", e);
            } finally {
                setLoading(false);
            }
        };

        fetchBriefing();
    }, []);

    if (loading) return <div className="h-48 bg-[#0F172A]/40 rounded-xl animate-pulse mb-8" />;
    if (!data || data.error) return null;

    return (
        <div className="mb-8 relative overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-br from-[#0F172A] via-[#0F172A] to-[#132e35] shadow-2xl">

            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <div className="relative p-6 sm:p-8">
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400 border border-orange-500/20 shadow-[0_0_15px_rgba(251,146,60,0.1)]">
                        <Sun size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-light text-white tracking-tight">Morning Briefing</h2>
                        <p className="text-sm text-slate-400 font-mono mt-1">{data.date}</p>
                    </div>
                </div>

                {/* AI Summary Text */}
                <div className="mb-8 pl-4 border-l-2 border-teal-500/50">
                    <p className="text-slate-200 text-lg font-light leading-relaxed">
                        "{data.summary}"
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-xl p-4 flex items-center gap-4 border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><FileText size={20} /></div>
                        <div>
                            <div className="text-2xl font-bold text-white">{data.stats.total}</div>
                            <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Processed</div>
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4 flex items-center gap-4 border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><CheckCircle size={20} /></div>
                        <div>
                            <div className="text-2xl font-bold text-white">{data.stats.approved}</div>
                            <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Auto-Cleared</div>
                        </div>
                    </div>

                    <div className="bg-amber-500/5 rounded-xl p-4 flex items-center gap-4 border border-amber-500/20 hover:bg-amber-500/10 transition-colors">
                        <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400"><AlertOctagon size={20} /></div>
                        <div>
                            <div className="text-2xl font-bold text-amber-400">{data.stats.flagged}</div>
                            <div className="text-[10px] uppercase text-amber-500/70 font-bold tracking-wider">Action Items</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
