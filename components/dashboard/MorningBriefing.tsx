'use client';

import React, { useEffect, useState } from 'react';
import { Sun, CheckCircle, AlertOctagon, FileText } from 'lucide-react';

export default function MorningBriefing() {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        // Call your Python Brain
        const fetchBriefing = async () => {
            // Note: We use the public URL of your Python service directly here for the demo
            // In prod, go through Next.js API proxy to hide the URL
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'https://corematch-brain-production.up.railway.app'}/morning-briefing`);
                const json = await res.json();
                setData(json);
            } catch (e) {
                console.error("Briefing unavailable", e);
            }
        };

        fetchBriefing();
    }, []);

    if (!data) return null; // Hide if loading or error

    return (
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-[#0F172A] to-[#1e293b] p-1 border border-white/10 shadow-2xl">
            <div className="bg-[#020617]/80 backdrop-blur-sm rounded-xl p-6">

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
                        <Sun size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Morning Briefing</h2>
                        <p className="text-sm text-slate-400">{data.date}</p>
                    </div>
                </div>

                {/* AI Summary */}
                <p className="text-slate-300 text-sm leading-relaxed border-l-2 border-teal-500 pl-4 mb-6 italic">
                    "{data.summary}"
                </p>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
                        <FileText className="text-blue-400" size={20} />
                        <div>
                            <div className="text-2xl font-bold text-white">{data.stats.total}</div>
                            <div className="text-[10px] uppercase text-slate-500 font-bold">Processed</div>
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
                        <CheckCircle className="text-emerald-400" size={20} />
                        <div>
                            <div className="text-2xl font-bold text-white">{data.stats.approved}</div>
                            <div className="text-[10px] uppercase text-slate-500 font-bold">Auto-Cleared</div>
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-3 flex items-center gap-3 border border-amber-500/20 bg-amber-500/5">
                        <AlertOctagon className="text-amber-400" size={20} />
                        <div>
                            <div className="text-2xl font-bold text-amber-400">{data.stats.flagged}</div>
                            <div className="text-[10px] uppercase text-amber-500/70 font-bold">Action Items</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
